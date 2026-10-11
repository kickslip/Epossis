import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format'
import { ReceiveTransferButton } from './ReceiveTransferButton'

const MOVE_LABEL: Record<string, string> = {
  RESTOCK: 'Received',
  SALE: 'Sold',
  VOID_SALE: 'Sale voided',
  ADJUSTMENT: 'Adjusted',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
  STOCK_TAKE: 'Stock take',
  RETURN: 'Return',
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: { location?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const [locations, pendingTransfers, movements, levels] = await Promise.all([
    prisma.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.stockTransfer.findMany({
      where: { tenantId, status: 'PENDING' },
      include: { fromLocation: true, toLocation: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.findMany({
      where: { tenantId },
      include: {
        product: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.stockLevel.findMany({
      where: { tenantId, product: { isActive: true } },
      include: {
        product: { select: { id: true, name: true, sku: true, reorderLevel: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { product: { name: 'asc' } },
    }),
  ])

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { defaultReorderLevel: true },
  })

  const locationId = searchParams.location ?? ''
  const filteredLevels = locationId ? levels.filter((l) => l.locationId === locationId) : levels

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Stock</h1>
        <div className="flex gap-2">
          <Link href="/stock/receive" className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white">
            Receive
          </Link>
          <Link href="/stock/transfer" className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">
            Transfer
          </Link>
          <Link href="/stock/count" className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">
            Count
          </Link>
        </div>
      </div>

      {pendingTransfers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">
            Pending transfers ({pendingTransfers.length})
          </h2>
          {pendingTransfers.map((t) => (
            <div key={t.id} className="mb-1 flex items-center justify-between text-sm">
              <span>
                {t.items.reduce((s, i) => s + i.quantity, 0)} items: {t.fromLocation.name} →{' '}
                {t.toLocation.name}
              </span>
              <ReceiveTransferButton transferId={t.id} />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Levels</h2>
          <div className="flex flex-wrap gap-1">
            <Link
              href="/stock"
              className={`rounded-full px-2.5 py-1 text-xs ${!locationId ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}
            >
              All
            </Link>
            {locations.map((l) => (
              <Link
                key={l.id}
                href={`/stock?location=${l.id}`}
                className={`rounded-full px-2.5 py-1 text-xs ${locationId === l.id ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}
              >
                {l.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="divide-y">
          {filteredLevels.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No stock recorded yet.</p>
          )}
          {filteredLevels.map((l) => {
            const reorder = l.product.reorderLevel ?? tenant.defaultReorderLevel
            const low = l.quantity <= reorder
            return (
              <Link
                key={l.id}
                href={`/products/${l.product.id}`}
                className="flex items-center justify-between px-3 py-2 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium">{l.product.name}</p>
                  <p className="text-xs text-slate-400">
                    {l.location.name}
                    {l.product.sku ? ` · ${l.product.sku}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    l.quantity <= 0
                      ? 'bg-red-100 text-red-700'
                      : low
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {l.quantity}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <h2 className="border-b p-3 text-sm font-semibold">Recent movements</h2>
        <div className="divide-y">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {m.product.name} <span className="font-normal text-slate-400">— {MOVE_LABEL[m.type]}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(m.createdAt)} · {m.location.name}
                  {m.note ? ` · ${m.note}` : ''}
                </p>
              </div>
              <span className={`font-mono text-sm ${m.qtyDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {m.qtyDelta >= 0 ? '+' : ''}{m.qtyDelta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
