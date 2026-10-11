'use server'

import { prisma } from '@/lib/db'
import { requireUser, requireAdminUser, tenantScope, assertTenantScope } from '@/lib/admin-auth'
import { applyMovement } from '@/lib/stock'
import { audit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/** Verify product + location belong to the caller's tenant. */
async function assertOwned(tenantId: string | undefined, productId: string, locationId: string) {
  const [product, location] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, tenantId } }),
    prisma.location.findFirst({ where: { id: locationId, tenantId } }),
  ])
  if (!product) throw new Error('Unknown product')
  if (!location) throw new Error('Unknown location')
  return { product, location }
}

const receiveSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  quantity: z.coerce.number().int().min(1),
  unitCostCents: z.coerce.number().int().min(0).optional(),
  note: z.string().optional(),
  supplierId: z.string().optional(),
  invoiceFileUrl: z.string().optional(),
  invoiceNumber: z.string().optional(),
  clientKey: z.string().optional(),
})

/** Receive stock (restock). Optionally attaches a supplier invoice file. */
export async function receiveStock(input: unknown): Promise<{ error?: string; qtyAfter?: number }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  const parsed = receiveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid data' }
  const d = parsed.data

  if (d.clientKey) {
    const dup = await prisma.stockMovement.findUnique({ where: { clientKey: d.clientKey } })
    if (dup) return { qtyAfter: dup.qtyAfter }
  }

  try {
    await assertOwned(tenantId, d.productId, d.locationId)
  } catch (e: any) {
    return { error: e.message }
  }

  const result = await prisma.$transaction(async (tx) => {
    const mv = await applyMovement(tx, {
      tenantId,
      productId: d.productId,
      locationId: d.locationId,
      type: 'RESTOCK',
      qtyDelta: d.quantity,
      unitCostCents: d.unitCostCents,
      note: d.note,
      userId: session.user.id,
      clientKey: d.clientKey,
      referenceType: d.invoiceFileUrl ? 'invoice' : null,
    })

    if (d.invoiceFileUrl) {
      const inv = await tx.purchaseInvoice.create({
        data: {
          tenantId,
          supplierId: d.supplierId || null,
          invoiceNumber: d.invoiceNumber || null,
          invoiceDate: new Date(),
          fileUrl: d.invoiceFileUrl,
          mimeType: d.invoiceFileUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          uploadedById: session.user.id,
          movementIds: JSON.stringify([mv.movementId]),
        },
      })
      await tx.stockMovement.update({
        where: { id: mv.movementId },
        data: { referenceId: inv.id },
      })
    }
    return mv
  })

  await audit({
    tenantId,
    userId: session.user.id,
    action: 'stock.receive',
    entity: 'Product',
    entityId: d.productId,
    details: { qty: d.quantity, locationId: d.locationId },
  })
  revalidatePath('/stock')
  revalidatePath('/products')
  return { qtyAfter: result.qtyAfter }
}

const adjustSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  quantity: z.coerce.number().int(), // signed delta, or absolute when mode='set'
  mode: z.enum(['delta', 'set']).default('delta'),
  reason: z.string().min(1),
  clientKey: z.string().optional(),
})

/** Stock adjustment (correction, damage, shrinkage). Reason required. */
export async function adjustStock(input: unknown): Promise<{ error?: string; qtyAfter?: number }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  const parsed = adjustSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid data' }
  const d = parsed.data

  if (d.clientKey) {
    const dup = await prisma.stockMovement.findUnique({ where: { clientKey: d.clientKey } })
    if (dup) return { qtyAfter: dup.qtyAfter }
  }

  let product
  try {
    ;({ product } = await assertOwned(tenantId, d.productId, d.locationId))
  } catch (e: any) {
    return { error: e.message }
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

  const result = await prisma.$transaction(async (tx) => {
    let delta = d.quantity
    if (d.mode === 'set') {
      const level = await tx.stockLevel.findUnique({
        where: { productId_locationId: { productId: d.productId, locationId: d.locationId } },
      })
      delta = d.quantity - (level?.quantity ?? 0)
    }
    if (delta === 0) return null

    const current = await tx.stockLevel.findUnique({
      where: { productId_locationId: { productId: d.productId, locationId: d.locationId } },
    })
    if (!tenant.allowNegativeStock && (current?.quantity ?? 0) + delta < 0) {
      throw new Error('Insufficient stock')
    }

    return applyMovement(tx, {
      tenantId,
      productId: d.productId,
      locationId: d.locationId,
      type: 'ADJUSTMENT',
      qtyDelta: delta,
      note: d.reason,
      userId: session.user.id,
      clientKey: d.clientKey,
    })
  })

  await audit({
    tenantId,
    userId: session.user.id,
    action: 'stock.adjust',
    entity: 'Product',
    entityId: product.id,
    details: { reason: d.reason, mode: d.mode },
  })
  revalidatePath('/stock')
  return { qtyAfter: result?.qtyAfter }
}

const transferSchema = z.object({
  fromLocationId: z.string(),
  toLocationId: z.string(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1) })).min(1),
  note: z.string().optional(),
  clientKey: z.string().optional(),
})

/** Create a transfer: deducts from source immediately, posts TRANSFER_IN on receipt. */
export async function createTransfer(input: unknown): Promise<{ error?: string; id?: string }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  const parsed = transferSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid data' }
  const d = parsed.data
  if (d.fromLocationId === d.toLocationId) return { error: 'Source and destination are the same' }

  if (d.clientKey) {
    const dup = await prisma.stockTransfer.findUnique({ where: { clientKey: d.clientKey } })
    if (dup) return { id: dup.id }
  }

  try {
    for (const item of d.items) await assertOwned(tenantId, item.productId, d.fromLocationId)
  } catch (e: any) {
    return { error: e.message }
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const t = await tx.stockTransfer.create({
      data: {
        tenantId,
        fromLocationId: d.fromLocationId,
        toLocationId: d.toLocationId,
        note: d.note,
        userId: session.user.id,
        clientKey: d.clientKey,
        items: { create: d.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
      },
    })
    for (const item of d.items) {
      await applyMovement(tx, {
        tenantId,
        productId: item.productId,
        locationId: d.fromLocationId,
        type: 'TRANSFER_OUT',
        qtyDelta: -item.quantity,
        referenceType: 'transfer',
        referenceId: t.id,
        note: d.note,
        userId: session.user.id,
      })
    }
    return t
  })

  await audit({
    tenantId,
    userId: session.user.id,
    action: 'stock.transfer',
    entity: 'StockTransfer',
    entityId: transfer.id,
    details: { items: d.items.length },
  })
  revalidatePath('/stock')
  return { id: transfer.id }
}

/** Mark a pending transfer received — posts TRANSFER_IN at destination. */
export async function receiveTransfer(transferId: string): Promise<{ error?: string }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })
  if (!transfer) return { error: 'Not found' }
  try {
    assertTenantScope(session, transfer.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }
  if (transfer.status !== 'PENDING') return { error: 'Already processed' }

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      await applyMovement(tx, {
        tenantId: transfer.tenantId,
        productId: item.productId,
        locationId: transfer.toLocationId,
        type: 'TRANSFER_IN',
        qtyDelta: item.quantity,
        referenceType: 'transfer',
        referenceId: transfer.id,
        userId: session.user.id,
      })
    }
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'RECEIVED', receivedAt: new Date(), receivedById: session.user.id },
    })
  })

  revalidatePath('/stock')
  return {}
}

/** Cancel a pending transfer — returns stock to the source location. */
export async function cancelTransfer(transferId: string): Promise<{ error?: string }> {
  const session = await requireUser()
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })
  if (!transfer) return { error: 'Not found' }
  try {
    assertTenantScope(session, transfer.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }
  if (transfer.status !== 'PENDING') return { error: 'Already processed' }

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      await applyMovement(tx, {
        tenantId: transfer.tenantId,
        productId: item.productId,
        locationId: transfer.fromLocationId,
        type: 'TRANSFER_IN',
        qtyDelta: item.quantity,
        referenceType: 'transfer',
        referenceId: transfer.id,
        note: 'Transfer cancelled — returned',
        userId: session.user.id,
      })
    }
    await tx.stockTransfer.update({ where: { id: transferId }, data: { status: 'CANCELLED' } })
  })

  revalidatePath('/stock')
  return {}
}
