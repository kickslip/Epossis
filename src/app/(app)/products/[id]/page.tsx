import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCents, formatDateTime } from '@/lib/format'
import { ProductForm } from '../ProductForm'

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

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { edit?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  const role = (session.user as any).role
  if (!tenantId) redirect('/dashboard')

  const product = await prisma.product.findFirst({
    where: { id: params.id, tenantId },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
      stockLevels: { include: { location: { select: { name: true } } } },
      stockMovements: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { location: { select: { name: true } }, user: { select: { firstName: true } } },
      },
    },
  })
  if (!product) notFound()

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { currencySymbol: true },
  })
  const sym = tenant.currencySymbol
  const onHand = product.stockLevels.reduce((s, l) => s + l.quantity, 0)

  if (searchParams.edit === '1') {
    const [categories, suppliers] = await Promise.all([
      prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    ])
    return (
      <div>
        <div className="mx-auto max-w-lg px-4 pt-4">
          <h1 className="text-lg font-semibold">Edit product</h1>
        </div>
        <ProductForm
          initial={product}
          categories={categories}
          suppliers={suppliers}
          currencySymbol={sym}
          canEditPrices={role !== 'STAFF'}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex gap-4">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100 text-3xl">📦</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{product.name}</h1>
            <p className="font-mono text-xs text-slate-400">{product.barcode ?? product.sku ?? '—'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {product.category?.name ?? 'Uncategorised'}
              {product.supplier ? ` · ${product.supplier.name}` : ''}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">{formatCents(product.sellPriceCents, sym)}</span>
              <span className="text-slate-400"> · cost {formatCents(product.costPriceCents, sym)}</span>
            </p>
          </div>
        </div>

        {product.description && (
          <p className="mt-3 text-sm text-slate-600">{product.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/stock/receive?productId=${product.id}`} className="rounded-lg bg-primary-600 py-2 text-center text-sm font-medium text-white">
            Receive
          </Link>
          <Link href={`/pos?add=${product.id}`} className="rounded-lg border border-primary-200 bg-primary-50 py-2 text-center text-sm font-medium text-primary-700">
            Sell
          </Link>
          <Link href={`/products/${product.id}?edit=1`} className="rounded-lg border py-2 text-center text-sm text-slate-600">
            Edit
          </Link>
          <Link href={`/stock/adjust?productId=${product.id}`} className="rounded-lg border py-2 text-center text-sm text-slate-600">
            Adjust
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Stock by location — {onHand} total</h2>
        {product.stockLevels.length === 0 && <p className="text-sm text-slate-400">No stock recorded.</p>}
        {product.stockLevels.map((l) => (
          <div key={l.locationId} className="flex justify-between border-b py-1.5 text-sm last:border-0">
            <span className="text-slate-600">{l.location.name}</span>
            <span className={l.quantity <= 0 ? 'font-medium text-red-500' : 'font-medium'}>{l.quantity}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Movement history</h2>
        {product.stockMovements.length === 0 && <p className="text-sm text-slate-400">No movements yet.</p>}
        {product.stockMovements.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
            <div>
              <p className="font-medium">{MOVE_LABEL[m.type] ?? m.type}</p>
              <p className="text-xs text-slate-400">
                {formatDateTime(m.createdAt)} · {m.location.name}
                {m.note ? ` · ${m.note}` : ''}
              </p>
            </div>
            <span className={`font-mono text-sm font-medium ${m.qtyDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {m.qtyDelta >= 0 ? '+' : ''}{m.qtyDelta}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
