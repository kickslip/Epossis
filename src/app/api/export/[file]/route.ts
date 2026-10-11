import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { toCsv } from '@/lib/export/csv'
import { toXlsx } from '@/lib/export/xlsx'
import { tablePdf, type PdfBrand } from '@/lib/export/pdf'
import { bestSellers, slowSellers } from '@/lib/analytics'
import { subDays } from 'date-fns'
import path from 'path'
import fs from 'fs/promises'

const MOVE_LABEL: Record<string, string> = {
  RESTOCK: 'Received', SALE: 'Sold', VOID_SALE: 'Sale voided', ADJUSTMENT: 'Adjusted',
  TRANSFER_OUT: 'Transfer out', TRANSFER_IN: 'Transfer in', STOCK_TAKE: 'Stock take', RETURN: 'Return',
}

type Dataset = {
  sheetName: string
  title: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
}

async function logoPath(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl?.startsWith('/api/files/')) return null
  const rel = logoUrl.replace('/api/files/', '').replace(/\.\./g, '')
  const abs = path.join(process.cwd(), 'storage', rel)
  try {
    await fs.access(abs)
    return abs
  } catch {
    return null
  }
}

async function buildDataset(
  resource: string,
  tenantId: string,
  q: URLSearchParams,
): Promise<Dataset | null> {
  const days = Math.min(365, Math.max(1, Number(q.get('days') ?? 30)))
  const locationId = q.get('location') || undefined
  const from = subDays(new Date(), days)

  switch (resource) {
    case 'products': {
      const products = await prisma.product.findMany({
        where: { tenantId },
        include: { category: true, supplier: true, stockLevels: true },
        orderBy: { name: 'asc' },
      })
      return {
        sheetName: 'Products',
        title: 'Product catalog',
        headers: ['Name', 'SKU', 'Barcode', 'Category', 'Supplier', 'Cost', 'Sell', 'On hand', 'Active'],
        rows: products.map((p) => [
          p.name, p.sku, p.barcode, p.category?.name, p.supplier?.name,
          (p.costPriceCents / 100).toFixed(2), (p.sellPriceCents / 100).toFixed(2),
          p.stockLevels.reduce((s, l) => s + l.quantity, 0), p.isActive ? 'yes' : 'no',
        ]),
      }
    }
    case 'stock': {
      const levels = await prisma.stockLevel.findMany({
        where: { tenantId },
        include: { product: true, location: true },
        orderBy: [{ location: { name: 'asc' } }, { product: { name: 'asc' } }],
      })
      return {
        sheetName: 'Stock',
        title: 'Stock levels',
        headers: ['Location', 'Product', 'SKU', 'Barcode', 'Qty', 'Cost value', 'Retail value'],
        rows: levels.map((l) => [
          l.location.name, l.product.name, l.product.sku, l.product.barcode, l.quantity,
          ((l.quantity * l.product.costPriceCents) / 100).toFixed(2),
          ((l.quantity * l.product.sellPriceCents) / 100).toFixed(2),
        ]),
      }
    }
    case 'movements': {
      const movements = await prisma.stockMovement.findMany({
        where: { tenantId },
        include: { product: true, location: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      })
      return {
        sheetName: 'Movements',
        title: 'Stock movements',
        headers: ['Date', 'Product', 'Location', 'Type', 'Delta', 'Qty after', 'Note'],
        rows: movements.map((m) => [
          m.createdAt.toISOString().slice(0, 16).replace('T', ' '),
          m.product.name, m.location.name, MOVE_LABEL[m.type] ?? m.type, m.qtyDelta, m.qtyAfter, m.note,
        ]),
      }
    }
    case 'sales': {
      const sales = await prisma.sale.findMany({
        where: {
          tenantId, createdAt: { gte: from },
          ...(locationId ? { locationId } : {}),
        },
        include: { location: true, items: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        sheetName: 'Sales',
        title: `Sales — last ${days} days`,
        headers: ['#', 'Date', 'Location', 'Items', 'Subtotal', 'Discount', 'VAT', 'Total', 'Payment', 'Status'],
        rows: sales.map((s) => [
          s.saleNumber, s.createdAt.toISOString().slice(0, 16).replace('T', ' '), s.location.name,
          s.items.reduce((a, i) => a + i.quantity, 0),
          (s.subtotalCents / 100).toFixed(2), (s.discountCents / 100).toFixed(2),
          (s.taxCents / 100).toFixed(2), (s.totalCents / 100).toFixed(2), s.paymentMethod, s.status,
        ]),
      }
    }
    case 'best-sellers':
    case 'slow-sellers': {
      const fn = resource === 'best-sellers' ? bestSellers : slowSellers
      const rows = await fn(tenantId, { from, locationId, limit: 200 })
      return {
        sheetName: resource === 'best-sellers' ? 'Best sellers' : 'Slow sellers',
        title: `${resource === 'best-sellers' ? 'Best' : 'Slow'} sellers — last ${days} days`,
        headers: ['Rank', 'Product', 'SKU', 'Qty sold', 'Revenue', 'Profit', 'Sales'],
        rows: rows.map((r, i) => [
          i + 1, r.productName, r.sku, r.qtySold,
          (r.revenueCents / 100).toFixed(2), (r.profitCents / 100).toFixed(2), r.saleCount,
        ]),
      }
    }
    case 'invoices': {
      const invoices = await prisma.purchaseInvoice.findMany({
        where: { tenantId },
        include: { supplier: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        sheetName: 'Invoices',
        title: 'Supplier invoices',
        headers: ['Date', 'Supplier', 'Invoice #', 'Total', 'File'],
        rows: invoices.map((i) => [
          (i.invoiceDate ?? i.createdAt).toISOString().slice(0, 10),
          i.supplier?.name, i.invoiceNumber,
          i.totalCents != null ? (i.totalCents / 100).toFixed(2) : null, i.fileUrl,
        ]),
      }
    }
    default:
      return null
  }
}

/**
 * GET /api/export/<resource>.<csv|xlsx|pdf>
 * e.g. /api/export/best-sellers.xlsx?days=30&location=<id>
 */
export async function GET(req: Request, { params }: { params: { file: string } }) {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!session?.user || !tenantId) return new NextResponse('Unauthorized', { status: 401 })

  const match = params.file.match(/^([a-z-]+)\.(csv|xlsx|pdf)$/)
  if (!match) return new NextResponse('Not found', { status: 404 })
  const [, resource, format] = match

  const url = new URL(req.url)
  const dataset = await buildDataset(resource, tenantId, url.searchParams)
  if (!dataset) return new NextResponse('Not found', { status: 404 })

  const filename = `${resource}-${new Date().toISOString().slice(0, 10)}.${format}`

  if (format === 'csv') {
    return new NextResponse(toCsv(dataset.headers, dataset.rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  if (format === 'xlsx') {
    const buf = toXlsx(dataset.sheetName, dataset.headers, dataset.rows)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // pdf
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const brand: PdfBrand = {
    name: tenant.name,
    logoPath: await logoPath(tenant.logoUrl),
    footer: tenant.receiptFooter,
  }
  const pdf = await tablePdf({ brand, title: dataset.title, headers: dataset.headers, rows: dataset.rows })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
