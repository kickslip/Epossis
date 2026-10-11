'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductPicker } from '@/components/ProductPicker'
import { countStockTakeItem, completeStockTake, cancelStockTake } from '@/app/actions/stocktakes'

type Row = {
  productId: string
  name: string
  sku: string | null
  barcode: string | null
  systemQty: number
  countedQty: number
}

export function CountSession({
  takeId,
  locationId,
  items: initialItems,
  focusProductId,
}: {
  takeId: string
  locationId: string
  items: Row[]
  focusProductId?: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(initialItems)
  const [busy, setBusy] = useState(false)

  async function setCount(productId: string, countedQty: number) {
    setRows((prev) => {
      const exists = prev.find((r) => r.productId === productId)
      if (exists) {
        return prev.map((r) => (r.productId === productId ? { ...r, countedQty } : r))
      }
      return prev
    })
    await countStockTakeItem(takeId, productId, countedQty)
  }

  async function addScanned(productId: string) {
    const existing = rows.find((r) => r.productId === productId)
    const next = (existing?.countedQty ?? 0) + 1
    if (!existing) {
      // Product not on the take (zero system stock) — countStockTakeItem creates the row
      await countStockTakeItem(takeId, productId, 1)
      router.refresh()
      return
    }
    await setCount(productId, next)
  }

  const varianceCount = rows.filter((r) => r.countedQty !== r.systemQty).length

  return (
    <div className="space-y-3">
      <ProductPicker
        onPick={(p) => addScanned(p.id)}
        placeholder="Scan or search to count…"
        autoFocus={!focusProductId}
      />

      <div className="divide-y rounded-xl border bg-white">
        {rows.map((r) => {
          const variance = r.countedQty - r.systemQty
          return (
            <div
              key={r.productId}
              className={`flex items-center gap-3 px-3 py-2 ${r.productId === focusProductId ? 'bg-primary-50' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs text-slate-400">
                  system {r.systemQty}
                  {variance !== 0 && (
                    <span className={variance > 0 ? 'text-green-600' : 'text-red-500'}>
                      {' '}
                      ({variance > 0 ? '+' : ''}
                      {variance})
                    </span>
                  )}
                </p>
              </div>
              <input
                type="number"
                min="0"
                value={r.countedQty}
                onChange={(e) => setCount(r.productId, Math.max(0, Number(e.target.value)))}
                className="w-20 rounded border px-2 py-1.5 text-center text-sm"
              />
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className="p-4 text-sm text-slate-400">No products with stock — scan to add counts.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await completeStockTake(takeId)
            router.push('/stock')
          }}
          className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Completing…' : `Complete (${varianceCount} variances)`}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            if (!confirm('Cancel this stock take? No adjustments will be posted.')) return
            setBusy(true)
            await cancelStockTake(takeId)
            router.push('/stock')
          }}
          className="rounded-lg border px-4 py-2.5 text-sm text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
