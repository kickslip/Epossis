import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { LabelSheet } from './LabelSheet'

export default async function LabelsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true, barcode: { not: null } },
    select: { id: true, name: true, barcode: true, sellPriceCents: true },
    orderBy: { name: 'asc' },
  })
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { currencySymbol: true },
  })

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-1 text-lg font-semibold">Barcode labels</h1>
      <p className="mb-3 text-xs text-slate-500">
        Select products, pick copies, then print — works with label sheets or a till printer.
      </p>
      <LabelSheet products={products} currencySymbol={tenant.currencySymbol} />
    </div>
  )
}
