import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ProductForm } from '../ProductForm'

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: { barcode?: string }
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')
  const role = (session.user as any).role

  const [categories, suppliers, tenant] = await Promise.all([
    prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currencySymbol: true } }),
  ])

  return (
    <div>
      <div className="mx-auto max-w-lg px-4 pt-4">
        <h1 className="text-lg font-semibold">New product</h1>
      </div>
      <ProductForm
        initial={{ barcode: searchParams.barcode ?? '' }}
        categories={categories}
        suppliers={suppliers}
        currencySymbol={tenant.currencySymbol}
        canEditPrices={role !== 'STAFF'}
      />
    </div>
  )
}
