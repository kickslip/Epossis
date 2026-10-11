import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ReceiveForm } from './ReceiveForm'

export default async function ReceivePage({
  searchParams,
}: {
  searchParams: { productId?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const [locations, suppliers, product] = await Promise.all([
    prisma.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    searchParams.productId
      ? prisma.product.findFirst({ where: { id: searchParams.productId, tenantId } })
      : null,
  ])

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-lg font-semibold">Receive stock</h1>
      <ReceiveForm
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        initialProduct={
          product
            ? { id: product.id, name: product.name, costPriceCents: product.costPriceCents }
            : null
        }
      />
    </div>
  )
}
