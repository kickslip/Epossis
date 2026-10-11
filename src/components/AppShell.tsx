'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { TenantTheme } from '@/lib/tenant'
import { roleLabel } from '@/lib/roles'
import {
  LayoutDashboard,
  ShoppingCart,
  ScanBarcode,
  Package,
  Boxes,
  Receipt,
  FileText,
  Bell,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: any; adminOnly?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'Sell', icon: ShoppingCart },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/stock', label: 'Stock', icon: Boxes },
  { href: '/sales', label: 'Sales', icon: Receipt },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export function AppShell({
  theme,
  userName,
  role,
  children,
}: {
  theme: TenantTheme
  userName: string
  role: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const items = NAV.filter((i) => !i.adminOnly || role === 'ADMIN' || role === 'SUPER_ADMIN')

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-white md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="font-bold text-slate-900">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt={theme.name} className="h-8 w-auto object-contain" />
            ) : (
              theme.name
            )}
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(item.href)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <p className="truncate text-sm font-medium text-slate-700">{userName}</p>
          <p className="text-xs text-slate-400">{roleLabel(role)}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-2 flex items-center gap-2 text-xs text-slate-500 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
          <Link href="/dashboard" className="font-bold text-slate-900">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt={theme.name} className="h-7 w-auto object-contain" />
            ) : (
              theme.name
            )}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="text-xs text-slate-500"
          >
            Sign out
          </button>
        </header>

        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav with centre scan button */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t bg-white pt-1 md:hidden"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        >
          {items.slice(0, 2).map((item) => (
            <MobileTab key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <Link
            href="/scan"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg"
            aria-label="Scan"
          >
            <ScanBarcode className="h-6 w-6" />
          </Link>
          {items.slice(2, 4).map((item) => (
            <MobileTab key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <Link href="/more" className="flex flex-col items-center gap-0.5 px-2 py-1 text-slate-500">
            <MoreDots
              active={
                isActive('/more') ||
                isActive('/settings') ||
                isActive('/reports') ||
                isActive('/alerts') ||
                isActive('/invoices')
              }
            />
            <span className="text-[10px]">More</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}

function MobileTab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active ? 'text-primary-600' : 'text-slate-500'}`}
    >
      <item.icon className="h-5 w-5" />
      <span className="text-[10px]">{item.label}</span>
    </Link>
  )
}

function MoreDots({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-primary-600' : ''}`} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}
