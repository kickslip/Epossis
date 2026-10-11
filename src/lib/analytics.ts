import { prisma } from './db'
import { startOfDay, subDays, format } from 'date-fns'

export type SellerRow = {
  productId: string
  productName: string
  sku: string | null
  imageUrl: string | null
  qtySold: number
  revenueCents: number
  profitCents: number
  saleCount: number
}

/** Aggregate sale items into seller rankings for a period. */
async function sellerRows(
  tenantId: string,
  opts: { from: Date; to?: Date; locationId?: string },
): Promise<SellerRow[]> {
  const items = await prisma.saleItem.findMany({
    where: {
      tenantId,
      sale: {
        status: 'COMPLETED',
        createdAt: { gte: opts.from, ...(opts.to ? { lte: opts.to } : {}) },
        ...(opts.locationId ? { locationId: opts.locationId } : {}),
      },
    },
    include: {
      product: { select: { id: true, name: true, sku: true, thumbnailUrl: true, imageUrl: true } },
    },
  })

  const map = new Map<string, SellerRow>()
  const salesSeen = new Map<string, Set<string>>()
  for (const it of items) {
    const key = it.productId
    const row =
      map.get(key) ??
      ({
        productId: key,
        productName: it.product.name,
        sku: it.product.sku,
        imageUrl: it.product.thumbnailUrl ?? it.product.imageUrl,
        qtySold: 0,
        revenueCents: 0,
        profitCents: 0,
        saleCount: 0,
      } satisfies SellerRow)
    row.qtySold += it.quantity
    row.revenueCents += it.lineTotalCents
    row.profitCents += it.lineTotalCents - it.quantity * it.unitCostCents
    const seen = salesSeen.get(key) ?? new Set<string>()
    seen.add(it.saleId)
    salesSeen.set(key, seen)
    row.saleCount = seen.size
    map.set(key, row)
  }
  return [...map.values()]
}

export async function bestSellers(
  tenantId: string,
  opts: { from: Date; to?: Date; locationId?: string; limit?: number },
) {
  const rows = await sellerRows(tenantId, opts)
  return rows.sort((a, b) => b.qtySold - a.qtySold).slice(0, opts.limit ?? 20)
}

export async function slowSellers(
  tenantId: string,
  opts: { from: Date; to?: Date; locationId?: string; limit?: number },
) {
  const rows = await sellerRows(tenantId, opts)
  return rows
    .filter((r) => r.qtySold > 0)
    .sort((a, b) => a.qtySold - b.qtySold)
    .slice(0, opts.limit ?? 20)
}

/** Headline stats for the dashboard. */
export async function dashboardStats(tenantId: string, locationId?: string) {
  const todayStart = startOfDay(new Date())
  const locFilter = locationId ? { locationId } : {}

  const [todayAgg, todayItems, stockAgg, weekSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { tenantId, status: 'COMPLETED', createdAt: { gte: todayStart }, ...locFilter },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.saleItem.findMany({
      where: { tenantId, sale: { status: 'COMPLETED', createdAt: { gte: todayStart }, ...locFilter } },
      select: { quantity: true, unitCostCents: true, lineTotalCents: true },
    }),
    prisma.stockLevel.findMany({
      where: { tenantId, ...locFilter },
      include: { product: { select: { costPriceCents: true, sellPriceCents: true } } },
    }),
    prisma.sale.findMany({
      where: { tenantId, status: 'COMPLETED', createdAt: { gte: subDays(todayStart, 6) }, ...locFilter },
      select: { totalCents: true, createdAt: true },
    }),
  ])

  const todayProfit = todayItems.reduce(
    (s, i) => s + (i.lineTotalCents - i.quantity * i.unitCostCents),
    0,
  )
  const stockAtCost = stockAgg.reduce((s, l) => s + l.quantity * l.product.costPriceCents, 0)
  const stockAtRetail = stockAgg.reduce((s, l) => s + l.quantity * l.product.sellPriceCents, 0)

  // 7-day revenue series for the sparkline/bar chart
  const byDay = new Map<string, number>()
  for (let i = 6; i >= 0; i--) byDay.set(format(subDays(todayStart, i), 'yyyy-MM-dd'), 0)
  for (const s of weekSales) {
    const key = format(s.createdAt, 'yyyy-MM-dd')
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + s.totalCents)
  }

  return {
    todayRevenueCents: todayAgg._sum.totalCents ?? 0,
    todaySalesCount: todayAgg._count,
    todayProfitCents: todayProfit,
    stockAtCostCents: stockAtCost,
    stockAtRetailCents: stockAtRetail,
    weekRevenue: [...byDay.entries()].map(([day, cents]) => ({ day, cents })),
  }
}

/** Reorder suggestions: avg daily sales over `days` × leadDays vs on-hand. */
export async function reorderSuggestions(
  tenantId: string,
  opts: { days?: number; leadDays?: number; locationId?: string } = {},
) {
  const days = opts.days ?? 30
  const leadDays = opts.leadDays ?? 7
  const from = subDays(new Date(), days)

  const rows = await sellerRows(tenantId, { from, locationId: opts.locationId })
  if (!rows.length) return []

  const levels = await prisma.stockLevel.groupBy({
    by: ['productId'],
    where: { tenantId, ...(opts.locationId ? { locationId: opts.locationId } : {}) },
    _sum: { quantity: true },
  })
  const onHand = new Map(levels.map((l) => [l.productId, l._sum.quantity ?? 0]))

  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((r) => r.productId) } },
    select: {
      id: true,
      reorderQty: true,
      reorderLevel: true,
      supplier: { select: { name: true } },
    },
  })
  const pMap = new Map(products.map((p) => [p.id, p]))
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { defaultReorderLevel: true },
  })

  return rows
    .map((r) => {
      const avgDaily = r.qtySold / days
      const target = Math.ceil(avgDaily * leadDays)
      const current = onHand.get(r.productId) ?? 0
      const p = pMap.get(r.productId)
      const reorderLevel = p?.reorderLevel ?? tenant.defaultReorderLevel
      const suggested = Math.max(p?.reorderQty ?? 0, target - current)
      return { ...r, avgDaily, current, reorderLevel, suggested, supplierName: p?.supplier?.name ?? null }
    })
    .filter((r) => r.current <= r.reorderLevel || r.current < Math.ceil(r.avgDaily * leadDays))
    .sort((a, b) => b.avgDaily - a.avgDaily)
}

/** Sales breakdown by payment method for a period. */
export async function salesByPayment(tenantId: string, from: Date, locationId?: string) {
  const agg = await prisma.sale.groupBy({
    by: ['paymentMethod'],
    where: { tenantId, status: 'COMPLETED', createdAt: { gte: from }, ...(locationId ? { locationId } : {}) },
    _sum: { totalCents: true },
    _count: true,
  })
  return agg.map((a) => ({
    method: a.paymentMethod,
    totalCents: a._sum.totalCents ?? 0,
    count: a._count,
  }))
}

/** Daily revenue series for a chart over N days. */
export async function revenueSeries(tenantId: string, days: number, locationId?: string) {
  const from = startOfDay(subDays(new Date(), days - 1))
  const sales = await prisma.sale.findMany({
    where: { tenantId, status: 'COMPLETED', createdAt: { gte: from }, ...(locationId ? { locationId } : {}) },
    select: { totalCents: true, createdAt: true },
  })
  const byDay = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) byDay.set(format(subDays(new Date(), i), 'yyyy-MM-dd'), 0)
  for (const s of sales) {
    const key = format(s.createdAt, 'yyyy-MM-dd')
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + s.totalCents)
  }
  return [...byDay.entries()].map(([day, cents]) => ({ day, cents }))
}

/** Revenue by category for a period. */
export async function salesByCategory(tenantId: string, from: Date, locationId?: string) {
  const items = await prisma.saleItem.findMany({
    where: {
      tenantId,
      sale: { status: 'COMPLETED', createdAt: { gte: from }, ...(locationId ? { locationId } : {}) },
    },
    include: { product: { select: { category: { select: { name: true } } } } },
  })
  const map = new Map<string, number>()
  for (const it of items) {
    const name = it.product.category?.name ?? 'Uncategorised'
    map.set(name, (map.get(name) ?? 0) + it.lineTotalCents)
  }
  return [...map.entries()]
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents)
}
