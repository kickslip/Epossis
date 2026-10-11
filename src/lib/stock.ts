import { prisma } from './db'
import type { Prisma } from '../generated/prisma/client'

type Tx = Prisma.TransactionClient

export type MovementInput = {
  tenantId: string
  productId: string
  locationId: string
  type:
    | 'RESTOCK'
    | 'SALE'
    | 'VOID_SALE'
    | 'ADJUSTMENT'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN'
    | 'STOCK_TAKE'
    | 'RETURN'
  qtyDelta: number
  unitCostCents?: number | null
  referenceType?: string | null
  referenceId?: string | null
  note?: string | null
  userId?: string | null
  clientKey?: string | null
}

/**
 * The ONLY way stock levels change: inside a transaction, upsert the
 * StockLevel row and append the StockMovement ledger entry with the
 * resulting quantity. Delta-based so offline-queued ops apply cleanly
 * in any order (except STOCK_TAKE absolute counts — callers reconcile).
 */
export async function applyMovement(
  tx: Tx,
  input: MovementInput,
): Promise<{ movementId: string; qtyAfter: number }> {
  const level = await tx.stockLevel.upsert({
    where: {
      productId_locationId: {
        productId: input.productId,
        locationId: input.locationId,
      },
    },
    create: {
      tenantId: input.tenantId,
      productId: input.productId,
      locationId: input.locationId,
      quantity: input.qtyDelta,
    },
    update: { quantity: { increment: input.qtyDelta } },
  })

  const movement = await tx.stockMovement.create({
    data: {
      tenantId: input.tenantId,
      productId: input.productId,
      locationId: input.locationId,
      type: input.type,
      qtyDelta: input.qtyDelta,
      qtyAfter: level.quantity,
      unitCostCents: input.unitCostCents ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      note: input.note ?? null,
      userId: input.userId ?? null,
      clientKey: input.clientKey ?? null,
    },
  })

  return { movementId: movement.id, qtyAfter: level.quantity }
}

/** True if a movement with this idempotency key was already applied. */
export async function movementExists(clientKey: string): Promise<boolean> {
  const m = await prisma.stockMovement.findUnique({ where: { clientKey }, select: { id: true } })
  return !!m
}

/** Total on-hand for a product across all locations (or one). */
export async function stockOnHand(productId: string, locationId?: string): Promise<number> {
  const agg = await prisma.stockLevel.aggregate({
    where: { productId, ...(locationId ? { locationId } : {}) },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}
