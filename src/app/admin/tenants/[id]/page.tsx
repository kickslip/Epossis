import { requireSuperAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { TenantForm } from '../TenantForm'
import { ManagerForm } from './ManagerForm'
import { ToggleActiveButton } from './ToggleActiveButton'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  await requireSuperAdmin()
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!tenant) notFound()

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{tenant.name}</h1>
        <ToggleActiveButton tenantId={tenant.id} isActive={tenant.isActive} />
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm">
        <p className="text-xs font-medium text-slate-500">Branded sign-in link (share with the store)</p>
        <code className="mt-1 block rounded bg-slate-100 px-2 py-1.5 text-xs">
          /auth/signin?tenant={tenant.slug}
        </code>
        <code className="mt-1 block rounded bg-slate-100 px-2 py-1.5 text-xs">
          /auth/register?tenant={tenant.slug}
        </code>
      </div>

      <TenantForm initial={tenant} />

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Users</h2>
        <div className="mb-3 divide-y">
          {tenant.users.map((u) => (
            <div key={u.id} className="py-2 text-sm">
              <span className="font-medium">{u.firstName} {u.lastName}</span>
              <span className="ml-2 text-xs text-slate-400">
                {u.email} · {u.role === 'ADMIN' ? 'Manager' : u.role === 'STAFF' ? 'Staff' : u.role}
                {!u.isActive && ' · inactive'}
              </span>
            </div>
          ))}
          {tenant.users.length === 0 && <p className="py-2 text-sm text-slate-400">No users yet.</p>}
        </div>
        <ManagerForm tenantId={tenant.id} />
      </div>
    </div>
  )
}
