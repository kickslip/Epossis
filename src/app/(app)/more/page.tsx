import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Receipt,
  FileText,
  Bell,
  BarChart3,
  Settings,
  Tags,
  Upload,
  Boxes,
} from 'lucide-react'
import { InstallPWA } from '@/components/InstallPWA'

/** Mobile "More" index — everything that doesn't fit in the bottom bar. */
export default async function MorePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const role = (session.user as any).role

  const sections = [
    { href: '/sales', label: 'Sales history', desc: 'Receipts, voids, payment methods', icon: Receipt },
    { href: '/invoices', label: 'Supplier invoices', desc: 'Captured invoice photos & PDFs', icon: FileText },
    { href: '/alerts', label: 'Stock alerts', desc: 'Low stock, out of stock, dead stock', icon: Bell },
    { href: '/reports', label: 'Reports', desc: 'Best sellers, reorders, exports', icon: BarChart3 },
    { href: '/stock', label: 'Stock & transfers', desc: 'Levels, movements, stock takes', icon: Boxes },
    { href: '/products/labels', label: 'Barcode labels', desc: 'Print labels for unlabelled stock', icon: Tags },
    { href: '/products/import', label: 'Import products', desc: 'Bulk-load your catalog via CSV', icon: Upload },
    ...(role !== 'STAFF'
      ? [{ href: '/settings', label: 'Settings', desc: 'Branding, team, locations, alerts', icon: Settings }]
      : []),
  ]

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-lg font-semibold">More</h1>
      <div className="mb-4">
        <InstallPWA />
      </div>
      <div className="divide-y rounded-xl border bg-white">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="flex items-center gap-3 p-4 hover:bg-slate-50">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-slate-400">{s.desc}</p>
            </div>
            <span className="text-slate-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
