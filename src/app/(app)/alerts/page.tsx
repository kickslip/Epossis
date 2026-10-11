import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAlerts } from '@/lib/alerts'
import { prisma } from '@/lib/db'
import { formatCents, formatDate } from '@/lib/format'

export default async function AlertsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const [alerts, tenant] = await Promise.all([
    getAlerts(tenantId),
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { currencySymbol: true, deadStockDays: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Stock alerts</h1>

      <Section
        title={`Out of stock (${alerts.outOfStock.length})`}
        tone="red"
        empty="Nothing is out of stock."
      >
        {alerts.outOfStock.map((a) => (
          <AlertRow key={`${a.productId}-${a.locationId}`} href={`/products/${a.productId}`} name={a.productName}
            meta={`${a.locationName}${a.supplierName ? ` · ${a.supplierName}` : ''}`} badge="0" badgeCls="bg-red-100 text-red-700" />
        ))}
      </Section>

      <Section title={`Low stock (${alerts.lowStock.length})`} tone="amber" empty="Nothing below reorder level.">
        {alerts.lowStock.map((a) => (
          <AlertRow key={`${a.productId}-${a.locationId}`} href={`/products/${a.productId}`} name={a.productName}
            meta={`${a.locationName} · reorder at ${a.reorderLevel}${a.supplierName ? ` · ${a.supplierName}` : ''}`}
            badge={String(a.quantity)} badgeCls="bg-amber-100 text-amber-700" />
        ))}
      </Section>

      <Section
        title={`Not moving — no sales in ${tenant.deadStockDays}+ days (${alerts.deadStock.length})`}
        tone="slate"
        empty="No dead stock."
      >
        {alerts.deadStock.map((a) => (
          <AlertRow
            key={a.productId}
            href={`/products/${a.productId}`}
            name={a.productName}
            meta={`${a.quantityOnHand} on hand · ${formatCents(a.stockValueCents, tenant.currencySymbol)} tied up · ${
              a.lastSaleAt ? `last sold ${formatDate(a.lastSaleAt)}` : 'never sold'
            }`}
            badge={`${a.quantityOnHand}`}
            badgeCls="bg-slate-100 text-slate-600"
          />
        ))}
      </Section>
    </div>
  )
}

function Section({
  title,
  tone,
  empty,
  children,
}: {
  title: string
  tone: 'red' | 'amber' | 'slate'
  empty: string
  children: React.ReactNode
}) {
  const border = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-slate-200'
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div className={`rounded-xl border ${border} bg-white`}>
      <h2 className="border-b p-3 text-sm font-semibold">{title}</h2>
      <div className="divide-y">{hasItems ? children : <p className="p-4 text-sm text-slate-400">{empty}</p>}</div>
    </div>
  )
}

function AlertRow({
  href,
  name,
  meta,
  badge,
  badgeCls,
}: {
  href: string
  name: string
  meta: string
  badge: string
  badgeCls: string
}) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-slate-400">{meta}</p>
      </div>
      <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeCls}`}>{badge}</span>
    </Link>
  )
}
