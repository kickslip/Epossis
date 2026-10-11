'use client'

import { useState } from 'react'
import { receiveTransfer } from '@/app/actions/stock'

export function ReceiveTransferButton({ transferId }: { transferId: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await receiveTransfer(transferId)
        setBusy(false)
      }}
      className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
    >
      {busy ? 'Receiving…' : 'Mark received'}
    </button>
  )
}
