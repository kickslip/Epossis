'use client'

import { useRouter } from 'next/navigation'
import { setTenantActive } from '@/app/actions/admin'

export function ToggleActiveButton({ tenantId, isActive }: { tenantId: string; isActive: boolean }) {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await setTenantActive(tenantId, !isActive)
        router.refresh()
      }}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
        isActive ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'
      }`}
    >
      {isActive ? 'Deactivate' : 'Reactivate'}
    </button>
  )
}
