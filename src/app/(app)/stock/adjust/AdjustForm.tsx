'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductPicker } from '@/components/ProductPicker'
import { adjustStock } from '@/app/actions/stock'
import { randomUUID } from '@/lib/uuid'
import { isOnline, queueOp } from '@/lib/offline/db'

const input = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'
const label = 'mb-1 block text-xs font-medium text-slate-600'

export function AdjustForm({
  locations,
  initialProduct,
}: {
  locations: { id: string; name: string }[]
  initialProduct: { id: string; name: string } | null
}) {
  const router = useRouter()
  const [product, setProduct] = useState(initialProduct)
  const [mode, setMode] = useState<'delta' | 'set'>('delta')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clientKey] = useState(randomUUID())

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!product) return setError('Choose a product')
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      productId: product.id,
      locationId: fd.get('locationId'),
      quantity: Number(fd.get('quantity')),
      mode,
      reason: String(fd.get('reason')),
      clientKey,
    }
    if (!isOnline()) {
      await queueOp({ clientKey, kind: 'adjust', payload, queuedAt: Date.now() })
      setBusy(false)
      router.push('/stock')
      return
    }
    const res = await adjustStock(payload)
    setBusy(false)
    if (res.error) setError(res.error)
    else router.push('/stock')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div>
        <span className={label}>Product *</span>
        {product ? (
          <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2">
            <span className="text-sm font-medium">{product.name}</span>
            <button type="button" onClick={() => setProduct(null)} className="text-xs text-slate-400">
              change
            </button>
          </div>
        ) : (
          <ProductPicker onPick={(p) => setProduct({ id: p.id, name: p.name })} autoFocus />
        )}
      </div>

      <div>
        <label className={label}>Location *</label>
        <select name="locationId" required className={input}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className={label}>Adjustment type</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('delta')}
            className={`rounded-lg border py-2 text-sm ${mode === 'delta' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'text-slate-600'}`}
          >
            Add / remove (+/−)
          </button>
          <button
            type="button"
            onClick={() => setMode('set')}
            className={`rounded-lg border py-2 text-sm ${mode === 'set' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'text-slate-600'}`}
          >
            Set exact count
          </button>
        </div>
      </div>

      <div>
        <label className={label}>{mode === 'delta' ? 'Change by *' : 'Counted total *'}</label>
        <input
          name="quantity"
          type="number"
          required
          className={input}
          placeholder={mode === 'delta' ? 'e.g. -3 or 12' : 'e.g. 47'}
        />
      </div>

      <div>
        <label className={label}>Reason *</label>
        <input name="reason" required className={input} placeholder="Damaged, shrinkage, correction…" />
      </div>

      <button
        type="submit"
        disabled={busy || !product}
        className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Apply adjustment'}
      </button>
    </form>
  )
}
