import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/format'
import { bestSellers, slowSellers, salesByPayment, salesByCategory, reorderSuggestions, revenueSeries } from '@/lib/analytics'
import { RevenueBarChart } from '@/components/BarChart'
import { subDays } from 'date-fns'

const PERIODS = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
]

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { days?: string; location?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const days = Math.min(365, Math.max(1, Number(searchParams.days ?? 30)))
  const locationId = searchParams.location || undefined
  const from = subDays(new Date(), days)

  const [tenant, locations, best, slow, byPayment, byCategory, reorders, series] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currencySymbol: true } }),
    prisma.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
    bestSellers(tenantId, { from, locationId, limit: 15 }),
    slowSellers(tenantId, { from, locationId, limit: 15 }),
    salesByPayment(tenantId, from, locationId),
    salesByCategory(tenantId, from, locationId),
    reorderSuggestions(tenantId, { days, locationId }),
    revenueSeries(tenantId, Math.min(days, 30), locationId),
  ])
  const sym = tenant.currencySymbol

  const qs = `days=${days}${locationId ? `&location=${locationId}` : ''}`

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Reports</h1>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/reports?days=${p.key}${locationId ? `&location=${locationId}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs ${days === Number(p.key) ? 'bg-primary-100 text-primary-700' : 'text-slate-500'}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Link href={`/reports?days=${days}`} className={`rounded-full border px-2.5 py-1 text-xs ${!locationId ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
          All locations
        </Link>
        {locations.map((l) => (
          <Link
            key={l.id}
            href={`/reports?days=${days}&location=${l.id}`}
            className={`rounded-full border px-2.5 py-1 text-xs ${locationId === l.id ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
          >
            {l.name}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Revenue</h2>
          <ExportLinks base="sales" qs={qs} />
        </div>
        <RevenueBarChart data={series} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-semibold">Best sellers</h2>
            <ExportLinks base="best-sellers" qs={qs} />
          </div>
          <SellerTable rows={best} sym={sym} />
        </div>

        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-semibold">Slow sellers</h2>
            <ExportLinks base="slow-sellers" qs={qs} />
          </div>
          <SellerTable rows={slow} sym={sym} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">By payment method</h2>
          {byPayment.length === 0 && <p className="text-sm text-slate-400">No sales in period.</p>}
          {byPayment.map((p) => (
            <div key={p.method} className="flex justify-between border-b py-1.5 text-sm last:border-0">
              <span>{p.method}</span>
              <span className="font-medium">
                {formatCents(p.totalCents, sym)} <span className="text-xs text-slate-400">({p.count})</span>
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">By category</h2>
          {byCategory.length === 0 && <p className="text-sm text-slate-400">No sales in period.</p>}
          {byCategory.map((c) => (
            <div key={c.name} className="flex justify-between border-b py-1.5 text-sm last:border-0">
              <span>{c.name}</span>
              <span className="font-medium">{formatCents(c.cents, sym)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b p-3">
          <h2 className="text-sm font-semibold">Reorder suggestions</h2>
          <p className="text-xs text-slate-400">Based on {days}-day sales velocity vs stock on hand</p>
        </div>
        <div className="divide-y">
          {reorders.length === 0 && <p className="p-4 text-sm text-slate-400">Nothing needs reordering.</p>}
          {reorders.map((r) => (
            <div key={r.productId} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.productName}</p>
                <p className="text-xs text-slate-400">
                  {r.current} on hand · sells ~{r.avgDaily.toFixed(1)}/day
                  {r.supplierName ? ` · ${r.supplierName}` : ''}
                </p>
              </div>
              <span className="ml-2 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                order {r.suggested}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExportLinks({ base, qs }: { base: string; qs: string }) {
  return (
    <div className="flex gap-1 text-[11px]">
      <a href={`/api/export/${base}.csv?${qs}`} className="rounded border px-1.5 py-0.5 text-slate-500">CSV</a>
      <a href={`/api/export/${base}.xlsx?${qs}`} className="rounded border px-1.5 py-0.5 text-slate-500">Excel</a>
      <a href={`/api/export/${base}.pdf?${qs}`} className="rounded border px-1.5 py-0.5 text-slate-500">PDF</a>
    </div>
  )
}

function SellerTable({ rows, sym }: { rows: any[]; sym: string }) {
  if (!rows.length) return <p className="p-4 text-sm text-slate-400">No sales in period.</p>
  return (
    <div className="divide-y">
      {rows.map((r, i) => (
        <div key={r.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-4 text-xs text-slate-300">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.productName}</p>
            <p className="text-xs text-slate-400">
              {r.qtySold} sold · profit {formatCents(r.profitCents, sym)}
            </p>
          </div>
          <span className="font-medium">{formatCents(r.revenueCents, sym)}</span>
        </div>
      ))}
    </div>
  )
}
