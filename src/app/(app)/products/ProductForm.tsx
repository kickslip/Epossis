'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertProduct } from '@/app/actions/products'
import { ImageCapture } from '@/components/ImageCapture'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { parseMoneyToCents, formatCents } from '@/lib/format'

const input =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100'
const label = 'mb-1 block text-xs font-medium text-slate-600'

type Initial = {
  id?: string
  sku?: string | null
  barcode?: string | null
  name?: string
  description?: string | null
  imageUrl?: string | null
  thumbnailUrl?: string | null
  categoryId?: string | null
  supplierId?: string | null
  costPriceCents?: number
  sellPriceCents?: number
  unit?: string
  reorderLevel?: number | null
  reorderQty?: number
  trackExpiry?: boolean
}

export function ProductForm({
  initial,
  categories,
  suppliers,
  currencySymbol,
  canEditPrices,
}: {
  initial?: Initial
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  currencySymbol: string
  canEditPrices: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [image, setImage] = useState<{ url: string | null; thumbnailUrl: string | null }>({
    url: initial?.imageUrl ?? null,
    thumbnailUrl: initial?.thumbnailUrl ?? null,
  })
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [cost, setCost] = useState(initial?.costPriceCents ?? 0)
  const [sell, setSell] = useState(initial?.sellPriceCents ?? 0)

  const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await upsertProduct({
      id: initial?.id,
      sku: fd.get('sku') || null,
      barcode: barcode || null,
      name: fd.get('name'),
      description: fd.get('description') || null,
      imageUrl: image.url,
      thumbnailUrl: image.thumbnailUrl,
      categoryId: fd.get('categoryId') || null,
      supplierId: fd.get('supplierId') || null,
      costPriceCents: parseMoneyToCents(String(fd.get('costPrice'))),
      sellPriceCents: parseMoneyToCents(String(fd.get('sellPrice'))),
      unit: fd.get('unit') || 'unit',
      reorderLevel: fd.get('reorderLevel') ? Number(fd.get('reorderLevel')) : null,
      reorderQty: fd.get('reorderQty') ? Number(fd.get('reorderQty')) : 0,
      trackExpiry: fd.get('trackExpiry') === 'on',
    })
    setBusy(false)
    if (res.error) setError(res.error)
    else router.push(`/products/${res.id}`)
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 p-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div>
        <span className={label}>Product photo</span>
        <ImageCapture
          kind="products"
          label="Photo"
          currentUrl={image.url}
          onUploaded={(r) => setImage({ url: r.url, thumbnailUrl: r.thumbnailUrl ?? null })}
        />
      </div>

      <div>
        <label className={label}>Name *</label>
        <input name="name" required defaultValue={initial?.name} className={input} />
      </div>

      <div>
        <label className={label}>Barcode</label>
        <div className="flex gap-2">
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className={input}
            placeholder="EAN / UPC / Code128"
          />
          <button
            type="button"
            onClick={() => setShowScanner(!showScanner)}
            className="shrink-0 rounded-lg border px-3 text-sm text-slate-600"
          >
            📷
          </button>
        </div>
        {showScanner && (
          <div className="mt-2">
            <BarcodeScanner
              onDetected={(code) => {
                setBarcode(code)
                setShowScanner(false)
              }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>SKU</label>
          <input name="sku" defaultValue={initial?.sku ?? ''} className={input} />
        </div>
        <div>
          <label className={label}>Unit</label>
          <input name="unit" defaultValue={initial?.unit ?? 'unit'} className={input} placeholder="unit / kg / case" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Category</label>
          <select name="categoryId" defaultValue={initial?.categoryId ?? ''} className={input}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Supplier</label>
          <select name="supplierId" defaultValue={initial?.supplierId ?? ''} className={input}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Cost price ({currencySymbol})</label>
          <input
            name="costPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.costPriceCents ? (initial.costPriceCents / 100).toFixed(2) : ''}
            disabled={!canEditPrices && !!initial?.id}
            onChange={(e) => setCost(parseMoneyToCents(e.target.value))}
            className={`${input} disabled:bg-slate-50`}
          />
        </div>
        <div>
          <label className={label}>Sell price ({currencySymbol})</label>
          <input
            name="sellPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.sellPriceCents ? (initial.sellPriceCents / 100).toFixed(2) : ''}
            disabled={!canEditPrices && !!initial?.id}
            onChange={(e) => setSell(parseMoneyToCents(e.target.value))}
            className={`${input} disabled:bg-slate-50`}
          />
        </div>
      </div>
      {sell > 0 && (
        <p className="text-xs text-slate-500">
          Margin: {margin}% · Profit {formatCents(sell - cost, currencySymbol)} / {initial?.unit ?? 'unit'}
        </p>
      )}

      <div>
        <label className={label}>Description</label>
        <textarea name="description" defaultValue={initial?.description ?? ''} rows={2} className={input} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Low-stock alert at</label>
          <input
            name="reorderLevel"
            type="number"
            min="0"
            defaultValue={initial?.reorderLevel ?? ''}
            placeholder="Store default"
            className={input}
          />
        </div>
        <div>
          <label className={label}>Reorder qty</label>
          <input name="reorderQty" type="number" min="0" defaultValue={initial?.reorderQty ?? 0} className={input} />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? 'Saving…' : initial?.id ? 'Save changes' : 'Create product'}
      </button>
    </form>
  )
}
