'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductPicker, type PickedProduct } from '@/components/ProductPicker'
import { ImageCapture } from '@/components/ImageCapture'
import { receiveStock } from '@/app/actions/stock'
import { parseMoneyToCents } from '@/lib/format'
import { randomUUID } from '@/lib/uuid'
import { isOnline, queueOp, removeBlob } from '@/lib/offline/db'
import { uploadQueuedBlob } from '@/lib/offline/sync'

const input =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'
const label = 'mb-1 block text-xs font-medium text-slate-600'

export function ReceiveForm({
  locations,
  suppliers,
  initialProduct,
}: {
  locations: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  initialProduct: { id: string; name: string; costPriceCents: number } | null
}) {
  const router = useRouter()
  const [product, setProduct] = useState<{ id: string; name: string; cost?: number } | null>(
    initialProduct ? { id: initialProduct.id, name: initialProduct.name, cost: initialProduct.costPriceCents } : null,
  )
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
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
      unitCostCents: parseMoneyToCents(String(fd.get('unitCost'))),
      note: String(fd.get('note') || ''),
      supplierId: String(fd.get('supplierId') || '') || undefined,
      invoiceNumber: String(fd.get('invoiceNumber') || '') || undefined,
      clientKey,
    }
    // Offline → queue the restock (invoice blob syncs on reconnect)
    if (!isOnline()) {
      await queueOp({
        clientKey,
        kind: 'receive',
        payload: { ...payload, invoiceFileUrl: invoiceUrl ?? undefined },
        queuedAt: Date.now(),
      })
      setBusy(false)
      router.push('/stock')
      return
    }
    // Back online but invoice was queued — upload it now before submitting
    let resolvedInvoice = invoiceUrl
    if (resolvedInvoice?.startsWith('pending:')) {
      const key = resolvedInvoice.slice('pending:'.length)
      resolvedInvoice = (await uploadQueuedBlob(key)) ?? null
      if (resolvedInvoice && !resolvedInvoice.startsWith('pending:')) await removeBlob(key)
    }
    const res = await receiveStock({ ...payload, invoiceFileUrl: resolvedInvoice ?? undefined })
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
          <ProductPicker onPick={(p: PickedProduct) => setProduct({ id: p.id, name: p.name, cost: p.costPriceCents })} autoFocus />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <label className={label}>Quantity *</label>
          <input name="quantity" type="number" min="1" required className={input} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Unit cost</label>
          <input
            name="unitCost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.cost ? (product.cost / 100).toFixed(2) : ''}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Supplier</label>
          <select name="supplierId" className={input}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Supplier invoice #</label>
        <input name="invoiceNumber" className={input} placeholder="Optional" />
      </div>

      <div>
        <span className={label}>Invoice photo / PDF (optional)</span>
        <ImageCapture
          kind="invoices"
          label="Invoice"
          accept="image/*,application/pdf"
          blobKey={clientKey}
          onUploaded={(r) => setInvoiceUrl(r.url)}
        />
      </div>

      <div>
        <label className={label}>Note</label>
        <input name="note" className={input} placeholder="Optional" />
      </div>

      <button
        type="submit"
        disabled={busy || !product}
        className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Receiving…' : 'Receive stock'}
      </button>
    </form>
  )
}
