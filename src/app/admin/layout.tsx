import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from './SignOutButton'
import { PLATFORM } from '@/lib/brand'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-14 items-center justify-between border-b bg-white px-6">
        <Link href="/admin" className="font-bold text-slate-900">
          {PLATFORM.name} <span className="text-xs font-normal text-slate-400">platform</span>
        </Link>
        <SignOutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
