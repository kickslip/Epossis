import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { PosScreen } from './PosScreen'

export default async function PosPage({
  searchParams,
}: {
  searchParams: { add?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const [locations, tenant] = await Promise.all([
    prisma.location.findMany({ where: { tenantId, isActive: true, type: 'STORE' }, orderBy: { name: 'asc' } }),
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { currencySymbol: true, taxRate: true, taxInclusive: true, name: true, receiptFooter: true },
    }),
  ])

  const locs = locations.length
    ? locations
    : await prisma.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } })

  return (
    <PosScreen
      locations={locs.map((l) => ({ id: l.id, name: l.name }))}
      currencySymbol={tenant.currencySymbol}
      taxRate={tenant.taxRate}
      taxInclusive={tenant.taxInclusive}
      addProductId={searchParams.add}
    />
  )
}
