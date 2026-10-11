import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCents } from '@/lib/format'
import { dashboardStats, bestSellers } from '@/lib/analytics'
import { getAlerts } from '@/lib/alerts'
import { RevenueBarChart } from '@/components/BarChart'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/admin')

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const sym = tenant.currencySymbol

  const [stats, alerts, top] = await Promise.all([
    dashboardStats(tenantId),
    getAlerts(tenantId),
    bestSellers(tenantId, { from: new Date(Date.now() - 30 * 86400000), limit: 5 }),
  ])

  const alertCount = alerts.lowStock.length + alerts.outOfStock.length + alerts.deadStock.length

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's revenue" value={formatCents(stats.todayRevenueCents, sym)} />
        <StatCard label="Today's profit" value={formatCents(stats.todayProfitCents, sym)} />
        <StatCard label="Sales today" value={String(stats.todaySalesCount)} />
        <StatCard
          label="Stock value (cost)"
          value={formatCents(stats.stockAtCostCents, sym)}
          sub={`retail ${formatCents(stats.stockAtRetailCents, sym)}`}
        />
      </div>

      {alertCount > 0 && (
        <Link href="/alerts" className="block rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            ⚠ {alertCount} stock alert{alertCount === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {alerts.outOfStock.length > 0 && `${alerts.outOfStock.length} out of stock · `}
            {alerts.lowStock.length > 0 && `${alerts.lowStock.length} low · `}
            {alerts.deadStock.length > 0 && `${alerts.deadStock.length} not moving`}
          </p>
        </Link>
      )}

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Last 7 days</h2>
        <RevenueBarChart data={stats.weekRevenue} />
      </div>

      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Top sellers (30 days)</h2>
          <Link href="/reports" className="text-xs text-primary-600">
            All reports →
          </Link>
        </div>
        <div className="divide-y">
          {top.length === 0 && <p className="p-4 text-sm text-slate-400">No sales yet this period.</p>}
          {top.map((r, i) => (
            <Link key={r.productId} href={`/products/${r.productId}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <span className="w-5 text-center text-xs font-bold text-slate-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.productName}</p>
              </div>
              <span className="text-xs text-slate-400">{r.qtySold} sold</span>
              <span className="w-20 text-right text-sm font-medium">{formatCents(r.revenueCents, sym)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}
