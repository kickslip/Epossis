'use server'

import { prisma } from '@/lib/db'
import { requireUser, requireAdminUser, tenantScope, assertTenantScope } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  costPriceCents: z.coerce.number().int().min(0).default(0),
  sellPriceCents: z.coerce.number().int().min(0).default(0),
  unit: z.string().default('unit'),
  reorderLevel: z.coerce.number().int().optional().nullable(),
  reorderQty: z.coerce.number().int().min(0).default(0),
  trackExpiry: z.coerce.boolean().default(false),
})

/** Find a product by barcode (or SKU fallback) within the caller's tenant. */
export async function lookupBarcode(code: string) {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  const cleaned = code.trim()
  const product = await prisma.product.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ barcode: cleaned }, { sku: cleaned }],
    },
    include: { stockLevels: { include: { location: { select: { name: true } } } } },
  })
  return product
}

/** Look up an unknown barcode in public product databases (server-side). */
export async function lookupExternalBarcodeAction(code: string) {
  await requireUser()
  const { lookupExternalBarcode } = await import('@/lib/barcode-lookup')
  return lookupExternalBarcode(code)
}

/** Same lookup, but returns all deduplicated candidates so the user can pick. */
export async function lookupExternalBarcodesAction(code: string) {
  await requireUser()
  const { lookupExternalBarcodes } = await import('@/lib/barcode-lookup')
  return lookupExternalBarcodes(code)
}

/** Lightweight product search for pickers (name/barcode/SKU). */
export async function searchProducts(q: string) {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  const term = q.trim()
  return prisma.product.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { barcode: { contains: term } },
              { sku: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      thumbnailUrl: true,
      sellPriceCents: true,
      costPriceCents: true,
      stockLevels: { select: { locationId: true, quantity: true } },
    },
    orderBy: { name: 'asc' },
    take: 25,
  })
}

export async function upsertProduct(input: unknown): Promise<{ id?: string; error?: string }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid product data' }
  const d = parsed.data

  // Only managers may change prices on existing products
  if (d.id) {
    const existing = await prisma.product.findUnique({ where: { id: d.id } })
    if (!existing) return { error: 'Not found' }
    try {
      assertTenantScope(session, existing.tenantId)
    } catch {
      return { error: 'Forbidden' }
    }
    const role = (session.user as any).role
    const priceChanged =
      existing.costPriceCents !== d.costPriceCents || existing.sellPriceCents !== d.sellPriceCents
    if (priceChanged && role === 'STAFF') return { error: 'Only managers can change prices' }
  }

  // Barcode/SKU uniqueness within tenant
  if (d.barcode) {
    const clash = await prisma.product.findFirst({
      where: { tenantId, barcode: d.barcode, ...(d.id ? { NOT: { id: d.id } } : {}) },
    })
    if (clash) return { error: `Barcode already used by "${clash.name}"` }
  }
  if (d.sku) {
    const clash = await prisma.product.findFirst({
      where: { tenantId, sku: d.sku, ...(d.id ? { NOT: { id: d.id } } : {}) },
    })
    if (clash) return { error: `SKU already used by "${clash.name}"` }
  }

  const data = {
    tenantId,
    sku: d.sku || null,
    barcode: d.barcode || null,
    name: d.name,
    description: d.description || null,
    imageUrl: d.imageUrl || null,
    thumbnailUrl: d.thumbnailUrl || null,
    categoryId: d.categoryId || null,
    supplierId: d.supplierId || null,
    costPriceCents: d.costPriceCents,
    sellPriceCents: d.sellPriceCents,
    unit: d.unit || 'unit',
    reorderLevel: d.reorderLevel ?? null,
    reorderQty: d.reorderQty,
    trackExpiry: d.trackExpiry,
  }

  const product = d.id
    ? await prisma.product.update({ where: { id: d.id }, data })
    : await prisma.product.create({ data })

  await audit({
    tenantId,
    userId: session.user.id,
    action: d.id ? 'product.update' : 'product.create',
    entity: 'Product',
    entityId: product.id,
    details: { name: product.name, barcode: product.barcode },
  })

  revalidatePath('/products')
  return { id: product.id }
}

/**
 * Import products from CSV text. Columns (header row required):
 * name,barcode,sku,category,supplier,cost,sell,reorderLevel
 * Upserts on barcode, then sku, then name match. Returns a per-row report.
 */
export async function importProductsCsv(csvText: string): Promise<{
  created: number
  updated: number
  errors: string[]
}> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { created: 0, updated: 0, errors: ['No tenant'] }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { created: 0, updated: 0, errors: ['File is empty'] }

  const parseRow = (line: string): string[] => {
    const out: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') inQ = false
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }

  const header = parseRow(lines[0]).map((h) => h.toLowerCase())
  const col = (names: string[]) => header.findIndex((h) => names.includes(h))
  const cols = {
    name: col(['name', 'product']),
    barcode: col(['barcode', 'ean', 'upc', 'code']),
    sku: col(['sku', 'item code', 'code2']),
    category: col(['category']),
    supplier: col(['supplier']),
    cost: col(['cost', 'cost price', 'costprice', 'buy']),
    sell: col(['sell', 'sell price', 'sellprice', 'price']),
    reorder: col(['reorderlevel', 'reorder', 'low stock', 'min']),
  }
  if (cols.name === -1) return { created: 0, updated: 0, errors: ['No "name" column found'] }

  const { parseMoneyToCents } = await import('@/lib/format')
  const errors: string[] = []
  let created = 0, updated = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i])
    const name = cells[cols.name]
    if (!name) { errors.push(`Row ${i + 1}: missing name`); continue }
    const barcode = cols.barcode >= 0 ? cells[cols.barcode] || null : null
    const sku = cols.sku >= 0 ? cells[cols.sku] || null : null

    try {
      // Resolve optional FK relations by name
      let categoryId: string | null = null
      if (cols.category >= 0 && cells[cols.category]) {
        const cname = cells[cols.category]
        const cat = await prisma.category.upsert({
          where: { tenantId_name: { tenantId, name: cname } },
          create: { tenantId, name: cname },
          update: {},
        })
        categoryId = cat.id
      }
      let supplierId: string | null = null
      if (cols.supplier >= 0 && cells[cols.supplier]) {
        const sname = cells[cols.supplier]
        const sup = await prisma.supplier.upsert({
          where: { tenantId_name: { tenantId, name: sname } },
          create: { tenantId, name: sname },
          update: {},
        })
        supplierId = sup.id
      }

      const data = {
        name,
        barcode,
        sku,
        categoryId,
        supplierId,
        costPriceCents: cols.cost >= 0 ? parseMoneyToCents(cells[cols.cost]) : 0,
        sellPriceCents: cols.sell >= 0 ? parseMoneyToCents(cells[cols.sell]) : 0,
        reorderLevel: cols.reorder >= 0 && cells[cols.reorder] ? parseInt(cells[cols.reorder]) : null,
      }

      const existing = await prisma.product.findFirst({
        where: {
          tenantId,
          OR: [
            ...(barcode ? [{ barcode }] : []),
            ...(sku ? [{ sku }] : []),
            { name },
          ],
        },
      })
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { ...data, barcode: barcode ?? existing.barcode, sku: sku ?? existing.sku },
        })
        updated++
      } else {
        await prisma.product.create({ data: { tenantId, ...data } })
        created++
      }
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message?.slice(0, 80) ?? 'failed'}`)
    }
  }

  revalidatePath('/products')
  return { created, updated, errors: errors.slice(0, 20) }
}

export async function setProductActive(productId: string, active: boolean) {
  const session = await requireAdminUser()
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return { error: 'Not found' }
  try {
    assertTenantScope(session, product.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }
  await prisma.product.update({ where: { id: productId }, data: { isActive: active } })
  await audit({
    tenantId: product.tenantId,
    userId: session.user.id,
    action: active ? 'product.activate' : 'product.deactivate',
    entity: 'Product',
    entityId: productId,
  })
  revalidatePath('/products')
  return {}
}
