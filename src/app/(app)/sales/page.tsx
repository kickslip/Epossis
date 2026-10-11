import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCents, formatDateTime } from '@/lib/format'

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: { page?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const page = Math.max(1, Number(searchParams?.page ?? 1))
  const take = 30

  const [sales, total, tenant] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId },
      include: { location: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
    }),
    prisma.sale.count({ where: { tenantId } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currencySymbol: true } }),
  ])

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-lg font-semibold">Sales</h1>
      <div className="divide-y rounded-xl border bg-white">
        {sales.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No sales yet.</p>}
        {sales.map((s) => (
          <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
            <div>
              <p className="text-sm font-medium">
                #{s.saleNumber}
                {s.status === 'VOIDED' && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">voided</span>}
                {s.offlineCreated && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">offline</span>}
              </p>
              <p className="text-xs text-slate-400">
                {formatDateTime(s.createdAt)} · {s.location.name} · {s.paymentMethod}
                {s.user ? ` · ${s.user.firstName}` : ''}
              </p>
            </div>
            <span className="text-sm font-semibold">{formatCents(s.totalCents, tenant.currencySymbol)}</span>
          </Link>
        ))}
      </div>
      {total > take && (
        <div className="mt-3 flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/sales?page=${page - 1}`} className="rounded-lg border px-3 py-1.5">
              ← Newer
            </Link>
          )}
          {page * take < total && (
            <Link href={`/sales?page=${page + 1}`} className="rounded-lg border px-3 py-1.5">
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
