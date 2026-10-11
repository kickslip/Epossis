import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/format'
import { ProductSearch } from './ProductSearch'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const q = searchParams.q?.trim() ?? ''
  const categoryId = searchParams.category ?? ''

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { barcode: { contains: q } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { name: true } },
        stockLevels: { select: { quantity: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
  ])

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { currencySymbol: true },
  })

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Products</h1>
        <div className="flex gap-2">
          <Link
            href="/products/labels"
            className="rounded-lg border px-3 py-1.5 text-sm text-slate-600"
          >
            Labels
          </Link>
          <Link
            href="/products/import"
            className="rounded-lg border px-3 py-1.5 text-sm text-slate-600"
          >
            Import
          </Link>
          <Link
            href="/products/new"
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + New
          </Link>
        </div>
      </div>

      <ProductSearch q={q} categoryId={categoryId} categories={categories} />

      <div className="mt-3 divide-y rounded-xl border bg-white">
        {products.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400">
            No products yet — scan a barcode or add one manually.
          </p>
        )}
        {products.map((p) => {
          const onHand = p.stockLevels.reduce((s, l) => s + l.quantity, 0)
          return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex items-center gap-3 p-3 hover:bg-slate-50"
            >
              {p.thumbnailUrl || p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnailUrl ?? p.imageUrl!}
                  alt=""
                  className="h-11 w-11 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                  📦
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-slate-400">
                  {p.sku ?? p.barcode ?? '—'}
                  {p.category ? ` · ${p.category.name}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCents(p.sellPriceCents, tenant.currencySymbol)}</p>
                <p className={`text-xs ${onHand <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {onHand} in stock
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
