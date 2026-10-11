'use server'

import { prisma } from '@/lib/db'
import { requireUser, requireAdminUser, tenantScope, assertTenantScope } from '@/lib/admin-auth'
import { applyMovement } from '@/lib/stock'
import { audit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const saleSchema = z.object({
  locationId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
        unitPriceCents: z.number().int().min(0),
        discountCents: z.number().int().min(0).default(0),
      }),
    )
    .min(1),
  discountCents: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE', 'OTHER']).default('CASH'),
  cashTenderedCents: z.number().int().min(0).optional(),
  paymentRef: z.string().optional(),
  note: z.string().optional(),
  clientKey: z.string().optional(),
  provisionalNumber: z.string().optional(),
  offlineCreated: z.boolean().default(false),
})

/**
 * Complete a sale: creates Sale + items + SALE movements + stock decrement,
 * all in one transaction. Idempotent via clientKey (offline sync / retries).
 */
export async function completeSale(
  input: unknown,
): Promise<{ error?: string; saleId?: string; saleNumber?: number; changeCents?: number }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid sale data' }
  const d = parsed.data

  if (d.clientKey) {
    const dup = await prisma.sale.findUnique({ where: { clientKey: d.clientKey } })
    if (dup) return { saleId: dup.id, saleNumber: dup.saleNumber, changeCents: dup.changeCents ?? 0 }
  }

  const location = await prisma.location.findFirst({ where: { id: d.locationId, tenantId } })
  if (!location) return { error: 'Unknown location' }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const productIds = d.items.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId, isActive: true },
  })
  if (products.length !== new Set(productIds).size) return { error: 'Unknown product in cart' }
  const productMap = new Map(products.map((p) => [p.id, p]))

  // Totals
  const subtotalCents = d.items.reduce((s, i) => s + i.quantity * i.unitPriceCents - i.discountCents, 0)
  const totalBeforeTax = subtotalCents - d.discountCents
  const taxRate = tenant.taxRate ?? 0
  const taxCents = tenant.taxInclusive
    ? Math.round(totalBeforeTax - totalBeforeTax / (1 + taxRate / 100))
    : Math.round((totalBeforeTax * taxRate) / 100)
  const totalCents = tenant.taxInclusive ? totalBeforeTax : totalBeforeTax + taxCents
  const changeCents =
    d.paymentMethod === 'CASH' && d.cashTenderedCents != null
      ? Math.max(0, d.cashTenderedCents - totalCents)
      : 0

  // Stock check (when negative stock disallowed)
  if (!tenant.allowNegativeStock) {
    const levels = await prisma.stockLevel.findMany({
      where: { productId: { in: productIds }, locationId: d.locationId },
    })
    const levelMap = new Map(levels.map((l) => [l.productId, l.quantity]))
    for (const item of d.items) {
      if ((levelMap.get(item.productId) ?? 0) < item.quantity) {
        return { error: `Insufficient stock for ${productMap.get(item.productId)?.name}` }
      }
    }
  }

  const attempt = async () =>
    prisma.$transaction(async (tx) => {
      const max = await tx.sale.aggregate({ where: { tenantId }, _max: { saleNumber: true } })
      const saleNumber = (max._max.saleNumber ?? 0) + 1

      const sale = await tx.sale.create({
        data: {
          tenantId,
          locationId: d.locationId,
          saleNumber,
          provisionalNumber: d.provisionalNumber ?? null,
          subtotalCents,
          discountCents: d.discountCents,
          taxCents,
          totalCents,
          paymentMethod: d.paymentMethod,
          cashTenderedCents: d.cashTenderedCents ?? null,
          changeCents,
          paymentRef: d.paymentRef ?? null,
          note: d.note ?? null,
          userId: session.user.id,
          clientKey: d.clientKey ?? null,
          offlineCreated: d.offlineCreated,
          items: {
            create: d.items.map((i) => ({
              tenantId,
              productId: i.productId,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
              unitCostCents: productMap.get(i.productId)?.costPriceCents ?? 0,
              discountCents: i.discountCents,
              lineTotalCents: i.quantity * i.unitPriceCents - i.discountCents,
            })),
          },
        },
      })

      for (const item of d.items) {
        await applyMovement(tx, {
          tenantId,
          productId: item.productId,
          locationId: d.locationId,
          type: 'SALE',
          qtyDelta: -item.quantity,
          unitCostCents: productMap.get(item.productId)?.costPriceCents ?? 0,
          referenceType: 'sale',
          referenceId: sale.id,
          userId: session.user.id,
        })
      }
      return sale
    })

  let sale
  try {
    sale = await attempt()
  } catch (e: any) {
    // saleNumber unique race → retry once
    if (e?.code === 'P2002' && !d.clientKey) sale = await attempt()
    else if (e?.code === 'P2002') {
      const dup = await prisma.sale.findUnique({ where: { clientKey: d.clientKey! } })
      if (dup) return { saleId: dup.id, saleNumber: dup.saleNumber, changeCents: dup.changeCents ?? 0 }
      throw e
    } else throw e
  }

  revalidatePath('/sales')
  revalidatePath('/dashboard')
  return { saleId: sale.id, saleNumber: sale.saleNumber, changeCents }
}

/** Void a completed sale — posts reversing movements so stock is restored. */
export async function voidSale(saleId: string, reason: string): Promise<{ error?: string }> {
  const session = await requireAdminUser() // manager-only
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: true } })
  if (!sale) return { error: 'Not found' }
  try {
    assertTenantScope(session, sale.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }
  if (sale.status === 'VOIDED') return { error: 'Already voided' }

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason || null },
    })
    for (const item of sale.items) {
      await applyMovement(tx, {
        tenantId: sale.tenantId,
        productId: item.productId,
        locationId: sale.locationId,
        type: 'VOID_SALE',
        qtyDelta: item.quantity,
        referenceType: 'sale',
        referenceId: sale.id,
        note: `Void sale #${sale.saleNumber}${reason ? ` — ${reason}` : ''}`,
        userId: session.user.id,
      })
    }
  })

  await audit({
    tenantId: sale.tenantId,
    userId: session.user.id,
    action: 'sale.void',
    entity: 'Sale',
    entityId: sale.id,
    details: { saleNumber: sale.saleNumber, reason },
  })
  revalidatePath('/sales')
  return {}
}
