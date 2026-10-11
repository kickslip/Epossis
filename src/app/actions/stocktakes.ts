'use server'

import { prisma } from '@/lib/db'
import { requireUser, tenantScope, assertTenantScope } from '@/lib/admin-auth'
import { applyMovement } from '@/lib/stock'
import { audit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/** Start a stock take at a location — snapshots system quantities. */
export async function createStockTake(locationId: string, note?: string) {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  const open = await prisma.stockTake.findFirst({
    where: { tenantId, locationId, status: 'OPEN' },
  })
  if (open) return { id: open.id } // resume existing

  const levels = await prisma.stockLevel.findMany({
    where: { tenantId, locationId, quantity: { not: 0 } },
  })

  const take = await prisma.stockTake.create({
    data: {
      tenantId,
      locationId,
      note: note || null,
      userId: session.user.id,
      items: {
        create: levels.map((l) => ({
          productId: l.productId,
          systemQty: l.quantity,
          countedQty: l.quantity, // default to system; user edits what they count
          variance: 0,
        })),
      },
    },
  })
  return { id: take.id }
}

/** Update the counted quantity for one product in an open take (scan flow). */
export async function countStockTakeItem(stockTakeId: string, productId: string, countedQty: number) {
  const session = await requireUser()
  const take = await prisma.stockTake.findUnique({ where: { id: stockTakeId } })
  if (!take || take.status !== 'OPEN') return { error: 'Not found' }
  try {
    assertTenantScope(session, take.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }

  const level = await prisma.stockLevel.findUnique({
    where: { productId_locationId: { productId, locationId: take.locationId } },
  })
  const systemQty = level?.quantity ?? 0

  await prisma.stockTakeItem.upsert({
    where: { stockTakeId_productId: { stockTakeId, productId } },
    create: { stockTakeId, productId, countedQty, systemQty, variance: countedQty - systemQty },
    update: { countedQty, systemQty, variance: countedQty - systemQty },
  })
  revalidatePath('/stock')
  return {}
}

/** Complete a take: posts STOCK_TAKE movements for every variance. */
export async function completeStockTake(stockTakeId: string) {
  const session = await requireUser()
  const take = await prisma.stockTake.findUnique({
    where: { id: stockTakeId },
    include: { items: true },
  })
  if (!take || take.status !== 'OPEN') return { error: 'Not found' }
  try {
    assertTenantScope(session, take.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of take.items) {
      const level = await tx.stockLevel.findUnique({
        where: {
          productId_locationId: { productId: item.productId, locationId: take.locationId },
        },
      })
      // Recompute variance against CURRENT system qty (stock may have moved)
      const variance = item.countedQty - (level?.quantity ?? 0)
      if (variance === 0) continue
      await applyMovement(tx, {
        tenantId: take.tenantId,
        productId: item.productId,
        locationId: take.locationId,
        type: 'STOCK_TAKE',
        qtyDelta: variance,
        referenceType: 'stocktake',
        referenceId: take.id,
        note: 'Stock take adjustment',
        userId: session.user.id,
      })
    }
    await tx.stockTake.update({
      where: { id: stockTakeId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  })

  await audit({
    tenantId: take.tenantId,
    userId: session.user.id,
    action: 'stocktake.complete',
    entity: 'StockTake',
    entityId: take.id,
  })
  revalidatePath('/stock')
  return {}
}

export async function cancelStockTake(stockTakeId: string) {
  const session = await requireUser()
  const take = await prisma.stockTake.findUnique({ where: { id: stockTakeId } })
  if (!take || take.status !== 'OPEN') return { error: 'Not found' }
  try {
    assertTenantScope(session, take.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }
  await prisma.stockTake.update({ where: { id: stockTakeId }, data: { status: 'CANCELLED' } })
  revalidatePath('/stock')
  return {}
}
