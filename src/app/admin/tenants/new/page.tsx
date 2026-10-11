import { requireSuperAdmin } from '@/lib/admin-auth'
import { TenantForm } from '../TenantForm'

export default async function NewTenantPage() {
  await requireSuperAdmin()
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-semibold">New tenant</h1>
      <TenantForm />
    </div>
  )
}
