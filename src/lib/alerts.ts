import { prisma } from './db'
import { subDays } from 'date-fns'

export type StockAlert = {
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  imageUrl: string | null
  locationId: string
  locationName: string
  quantity: number
  reorderLevel: number
  supplierName: string | null
}

export type DeadStockAlert = {
  productId: string
  productName: string
  sku: string | null
  quantityOnHand: number
  stockValueCents: number
  lastSaleAt: Date | null
  daysSinceSale: number | null
}

export type AlertsResult = {
  lowStock: StockAlert[]
  outOfStock: StockAlert[]
  deadStock: DeadStockAlert[]
}

/** Compute the live alert set for a tenant — no stored alert state to drift. */
export async function getAlerts(tenantId: string): Promise<AlertsResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { defaultReorderLevel: true, deadStockDays: true },
  })

  // ── Low / out of stock (per product × location) ─────────────────────────
  const levels = await prisma.stockLevel.findMany({
    where: { tenantId, product: { isActive: true } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          thumbnailUrl: true,
          imageUrl: true,
          reorderLevel: true,
          supplier: { select: { name: true } },
        },
      },
      location: { select: { id: true, name: true } },
    },
  })

  const lowStock: StockAlert[] = []
  const outOfStock: StockAlert[] = []
  for (const l of levels) {
    const reorder = l.product.reorderLevel ?? tenant.defaultReorderLevel
    const row: StockAlert = {
      productId: l.product.id,
      productName: l.product.name,
      sku: l.product.sku,
      barcode: l.product.barcode,
      imageUrl: l.product.thumbnailUrl ?? l.product.imageUrl,
      locationId: l.location.id,
      locationName: l.location.name,
      quantity: l.quantity,
      reorderLevel: reorder,
      supplierName: l.product.supplier?.name ?? null,
    }
    if (l.quantity <= 0) outOfStock.push(row)
    else if (l.quantity <= reorder) lowStock.push(row)
  }
  lowStock.sort((a, b) => a.quantity - b.quantity)

  // ── Dead stock: on-hand but no SALE movement in deadStockDays ───────────
  const cutoff = subDays(new Date(), tenant.deadStockDays)
  const totals = await prisma.stockLevel.groupBy({
    by: ['productId'],
    where: { tenantId, product: { isActive: true } },
    _sum: { quantity: true },
  })
  const onHandIds = totals.filter((t) => (t._sum.quantity ?? 0) > 0).map((t) => t.productId)

  const deadStock: DeadStockAlert[] = []
  if (onHandIds.length) {
    const lastSales = await prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { tenantId, productId: { in: onHandIds }, type: 'SALE' },
      _max: { createdAt: true },
    })
    const lastSaleMap = new Map(lastSales.map((s) => [s.productId, s._max.createdAt]))

    const products = await prisma.product.findMany({
      where: { id: { in: onHandIds } },
      select: { id: true, name: true, sku: true, costPriceCents: true, createdAt: true },
    })
    for (const p of products) {
      const lastSale = lastSaleMap.get(p.id) ?? null
      const reference = lastSale ?? p.createdAt
      if (reference < cutoff) {
        const qty = totals.find((t) => t.productId === p.id)?._sum.quantity ?? 0
        deadStock.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          quantityOnHand: qty,
          stockValueCents: qty * p.costPriceCents,
          lastSaleAt: lastSale,
          daysSinceSale: lastSale ? Math.floor((Date.now() - lastSale.getTime()) / 86400000) : null,
        })
      }
    }
    deadStock.sort((a, b) => b.stockValueCents - a.stockValueCents)
  }

  return { lowStock, outOfStock, deadStock }
}
