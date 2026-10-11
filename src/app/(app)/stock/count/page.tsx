import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { createStockTake } from '@/app/actions/stocktakes'
import { CountSession } from './CountSession'
import Link from 'next/link'

export default async function CountPage({
  searchParams,
}: {
  searchParams: { location?: string; productId?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const locations = await prisma.location.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  })

  const locationId = searchParams.location
  if (!locationId) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <h1 className="mb-3 text-lg font-semibold">Stock take</h1>
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm text-slate-600">Choose a location to count:</p>
          <div className="space-y-2">
            {locations.map((l) => (
              <Link
                key={l.id}
                href={`/stock/count?location=${l.id}`}
                className="block rounded-lg border px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                {l.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const res = await createStockTake(locationId)
  if ('error' in res && res.error) {
    return <div className="p-4 text-sm text-red-600">{res.error}</div>
  }

  const take = await prisma.stockTake.findUniqueOrThrow({
    where: { id: res.id },
    include: {
      items: { include: { product: { select: { id: true, name: true, sku: true, barcode: true } } } },
      location: { select: { name: true } },
    },
  })

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-lg font-semibold">Stock take — {take.location.name}</h1>
      <p className="mb-3 text-xs text-slate-400">
        Scan each product and enter the counted quantity, then complete.
      </p>
      <CountSession
        takeId={take.id}
        locationId={locationId}
        focusProductId={searchParams.productId}
        items={take.items.map((i) => ({
          productId: i.productId,
          name: i.product.name,
          sku: i.product.sku,
          barcode: i.product.barcode,
          systemQty: i.systemQty,
          countedQty: i.countedQty,
        }))}
      />
    </div>
  )
}
