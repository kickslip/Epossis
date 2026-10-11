import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ScanHub } from './ScanHub'

export default async function ScanPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const locations = await prisma.location.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  })

  return <ScanHub locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
}
