'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductPicker, type PickedProduct } from '@/components/ProductPicker'
import { createTransfer } from '@/app/actions/stock'
import { randomUUID } from '@/lib/uuid'

const input = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'
const label = 'mb-1 block text-xs font-medium text-slate-600'

type Item = { productId: string; name: string; quantity: number; available: number }

export function TransferForm({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [fromId, setFromId] = useState(locations[0]?.id ?? '')
  const [toId, setToId] = useState(locations[1]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientKey] = useState(randomUUID())

  function addProduct(p: PickedProduct) {
    const available = p.stockLevels.find((l) => l.locationId === fromId)?.quantity ?? 0
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1, available } : i))
      }
      return [...prev, { productId: p.id, name: p.name, quantity: 1, available }]
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!items.length) return setError('Add at least one product')
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await createTransfer({
      fromLocationId: fd.get('fromId'),
      toLocationId: fd.get('toId'),
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      note: String(fd.get('note') || ''),
      clientKey,
    })
    setBusy(false)
    if (res.error) setError(res.error)
    else router.push('/stock')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>From *</label>
          <select
            name="fromId"
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value)
              setItems([])
            }}
            className={input}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>To *</label>
          <select name="toId" value={toId} onChange={(e) => setToId(e.target.value)} className={input}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={label}>Products — scan or search to add</span>
        <ProductPicker onPick={addProduct} />
      </div>

      {items.length > 0 && (
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <div key={item.productId} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-slate-400">{item.available} available at source</p>
              </div>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.productId === item.productId ? { ...i, quantity: Math.max(1, Number(e.target.value)) } : i,
                    ),
                  )
                }
                className="w-16 rounded border px-2 py-1 text-center text-sm"
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((i) => i.productId !== item.productId))}
                className="text-slate-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className={label}>Note</label>
        <input name="note" className={input} placeholder="Optional" />
      </div>

      <button
        type="submit"
        disabled={busy || !items.length || fromId === toId}
        className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create transfer'}
      </button>
      {fromId === toId && <p className="text-center text-xs text-amber-600">Choose two different locations</p>}
    </form>
  )
}
