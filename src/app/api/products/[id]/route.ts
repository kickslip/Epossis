import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/** GET /api/products/<id> — product for POS deep links (tenant-scoped). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!session?.user || !tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await prisma.product.findFirst({
    where: { id: params.id, tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      sellPriceCents: true,
      thumbnailUrl: true,
      imageUrl: true,
      stockLevels: { select: { locationId: true, quantity: true } },
    },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}
