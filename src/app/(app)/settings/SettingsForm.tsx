'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTenantSettings } from '@/app/actions/admin'
import { ImageCapture } from '@/components/ImageCapture'

const input = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'
const label = 'mb-1 block text-xs font-medium text-slate-600'

type TenantData = {
  name: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  currencySymbol: string
  taxRate: number
  taxInclusive: boolean
  receiptFooter: string | null
  allowNegativeStock: boolean
  defaultReorderLevel: number
  deadStockDays: number
}

export function SettingsForm({ tenant }: { tenant: TenantData }) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl)
  const [primary, setPrimary] = useState(tenant.primaryColor)
  const [accent, setAccent] = useState(tenant.accentColor ?? '#0ea5e9')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await updateTenantSettings({
      name: fd.get('name'),
      logoUrl,
      primaryColor: primary,
      accentColor: accent || null,
      contactEmail: fd.get('contactEmail') || null,
      contactPhone: fd.get('contactPhone') || null,
      address: fd.get('address') || null,
      currencySymbol: fd.get('currencySymbol'),
      taxRate: Number(fd.get('taxRate') || 0),
      taxInclusive: fd.get('taxInclusive') === 'on',
      receiptFooter: fd.get('receiptFooter') || null,
      allowNegativeStock: fd.get('allowNegativeStock') === 'on',
      defaultReorderLevel: Number(fd.get('defaultReorderLevel') || 0),
      deadStockDays: Number(fd.get('deadStockDays') || 60),
    })
    setBusy(false)
    if (res.error) setError(res.error)
    else {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold">Store profile & branding</h2>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Store name</label>
          <input name="name" defaultValue={tenant.name} required className={input} />
        </div>
        <div>
          <label className={label}>Currency symbol</label>
          <input name="currencySymbol" defaultValue={tenant.currencySymbol} className={input} />
        </div>
      </div>

      <div>
        <span className={label}>Logo (shown in app, receipts, exports)</span>
        <ImageCapture kind="branding" label="Logo" currentUrl={logoUrl} onUploaded={(r) => setLogoUrl(r.url)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Brand colour</label>
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded border" />
        </div>
        <div>
          <label className={label}>Accent colour</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded border" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Contact email</label>
          <input name="contactEmail" type="email" defaultValue={tenant.contactEmail ?? ''} className={input} />
        </div>
        <div>
          <label className={label}>Contact phone</label>
          <input name="contactPhone" defaultValue={tenant.contactPhone ?? ''} className={input} />
        </div>
      </div>

      <div>
        <label className={label}>Address (prints on receipts)</label>
        <input name="address" defaultValue={tenant.address ?? ''} className={input} />
      </div>

      <h2 className="pt-2 text-sm font-semibold">Commerce</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={label}>Tax rate %</label>
          <input name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue={tenant.taxRate} className={input} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input name="taxInclusive" type="checkbox" defaultChecked={tenant.taxInclusive} />
            Prices incl. tax
          </label>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input name="allowNegativeStock" type="checkbox" defaultChecked={tenant.allowNegativeStock} />
            Allow negative stock
          </label>
        </div>
      </div>

      <div>
        <label className={label}>Receipt footer</label>
        <input name="receiptFooter" defaultValue={tenant.receiptFooter ?? ''} className={input} />
      </div>

      <h2 className="pt-2 text-sm font-semibold">Alert thresholds</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Default low-stock level</label>
          <input name="defaultReorderLevel" type="number" min="0" defaultValue={tenant.defaultReorderLevel} className={input} />
        </div>
        <div>
          <label className={label}>Dead stock after (days)</label>
          <input name="deadStockDays" type="number" min="1" defaultValue={tenant.deadStockDays} className={input} />
        </div>
      </div>

      <button type="submit" disabled={busy} className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
