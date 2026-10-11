import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdjustForm } from './AdjustForm'

export default async function AdjustPage({
  searchParams,
}: {
  searchParams: { productId?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const [locations, product] = await Promise.all([
    prisma.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
    searchParams.productId
      ? prisma.product.findFirst({ where: { id: searchParams.productId, tenantId } })
      : null,
  ])

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-lg font-semibold">Adjust stock</h1>
      <AdjustForm
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initialProduct={product ? { id: product.id, name: product.name } : null}
      />
    </div>
  )
}
