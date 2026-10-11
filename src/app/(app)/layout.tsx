import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTenantTheme } from '@/lib/tenant'
import { AppShell } from '@/components/AppShell'
import { SyncStatus } from '@/components/SyncStatus'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const role = (session.user as any).role ?? 'STAFF'
  if (role === 'SUPER_ADMIN') redirect('/admin')

  const theme = await getTenantTheme()
  return (
    <AppShell theme={theme} userName={session.user.name ?? ''} role={role}>
      {children}
      <SyncStatus />
    </AppShell>
  )
}
