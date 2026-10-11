import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SettingsForm } from './SettingsForm'
import { OrgManager } from './OrgManager'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const role = (session.user as any).role
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')
  if (role === 'STAFF') redirect('/dashboard')

  const [tenant, locations, categories, suppliers, users] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.location.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
      orderBy: { firstName: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <SettingsForm
        tenant={{
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          accentColor: tenant.accentColor,
          contactEmail: tenant.contactEmail,
          contactPhone: tenant.contactPhone,
          address: tenant.address,
          currencySymbol: tenant.currencySymbol,
          taxRate: tenant.taxRate,
          taxInclusive: tenant.taxInclusive,
          receiptFooter: tenant.receiptFooter,
          allowNegativeStock: tenant.allowNegativeStock,
          defaultReorderLevel: tenant.defaultReorderLevel,
          deadStockDays: tenant.deadStockDays,
        }}
      />

      <OrgManager
        locations={locations.map((l) => ({ id: l.id, name: l.name, type: l.type, isActive: l.isActive }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone, email: s.email }))}
        users={users}
      />
    </div>
  )
}
