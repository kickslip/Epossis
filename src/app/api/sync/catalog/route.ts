import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/** GET /api/sync/catalog — product snapshot for offline lookup/POS. */
export async function GET() {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!session?.user || !tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
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
  })

  return NextResponse.json(products, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
