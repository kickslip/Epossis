'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { voidSale } from '@/app/actions/sales'

export function VoidSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      disabled={busy}
      onClick={async () => {
        const reason = prompt('Reason for voiding this sale? Stock will be returned.')
        if (reason === null) return
        setBusy(true)
        const res = await voidSale(saleId, reason)
        setBusy(false)
        if (res.error) alert(res.error)
        else router.refresh()
      }}
      className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
    >
      {busy ? 'Voiding…' : 'Void sale'}
    </button>
  )
}
