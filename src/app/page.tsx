import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTenantTheme } from '@/lib/tenant'
import { LandingView } from '@/components/landing/LandingView'

export default async function Home() {
  const session = await auth()
  if (session?.user) {
    const role = (session.user as any).role
    redirect(role === 'SUPER_ADMIN' ? '/admin' : '/dashboard')
  }
  const theme = await getTenantTheme()
  return <LandingView theme={theme} />
}
