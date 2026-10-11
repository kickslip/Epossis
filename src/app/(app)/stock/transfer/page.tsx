import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { TransferForm } from './TransferForm'

export default async function TransferPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const locations = await prisma.location.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-lg font-semibold">Transfer stock</h1>
      {locations.length < 2 ? (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          You need at least two locations to transfer stock. Add locations under Settings.
        </p>
      ) : (
        <TransferForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
      )}
    </div>
  )
}
