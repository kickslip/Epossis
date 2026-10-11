'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageCapture } from '@/components/ImageCapture'
import { createPurchaseInvoice } from '@/app/actions/invoices'
import { parseMoneyToCents } from '@/lib/format'

const input = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'
const label = 'mb-1 block text-xs font-medium text-slate-600'

export function InvoiceUpload({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!fileUrl) return setError('Attach the invoice file first')
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const res = await createPurchaseInvoice({
      supplierId: String(fd.get('supplierId') || '') || null,
      invoiceNumber: String(fd.get('invoiceNumber') || '') || null,
      invoiceDate: String(fd.get('invoiceDate') || '') || null,
      totalCents: fd.get('total') ? parseMoneyToCents(String(fd.get('total'))) : null,
      fileUrl,
      mimeType,
      note: String(fd.get('note') || '') || null,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setOpen(false)
    setFileUrl(null)
    router.refresh()
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white"
        >
          📷 Upload invoice
        </button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <ImageCapture
            kind="invoices"
            label="Invoice"
            accept="image/*,application/pdf"
            onUploaded={(r) => {
              setFileUrl(r.url)
              setMimeType(r.url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
            }}
          />
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className={label}>Invoice #</label>
              <input name="invoiceNumber" className={input} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Date</label>
              <input name="invoiceDate" type="date" className={input} />
            </div>
            <div>
              <label className={label}>Total</label>
              <input name="total" type="number" step="0.01" min="0" className={input} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className={label}>Note</label>
            <input name="note" className={input} placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border py-2 text-sm text-slate-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !fileUrl}
              className="flex-1 rounded-lg bg-primary-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save invoice'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
