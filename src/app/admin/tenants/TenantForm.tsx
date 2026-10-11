'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertTenant } from '@/app/actions/admin'
import { ImageCapture } from '@/components/ImageCapture'

const input = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'
const label = 'mb-1 block text-xs font-medium text-slate-600'

type Initial = {
  id?: string
  name?: string
  slug?: string
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  logoUrl?: string | null
  primaryColor?: string
  accentColor?: string | null
}

export function TenantForm({ initial }: { initial?: Initial }) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? null)
  const [primary, setPrimary] = useState(initial?.primaryColor ?? '#3b82f6')
  const [accent, setAccent] = useState(initial?.accentColor ?? '#0ea5e9')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await upsertTenant({
      id: initial?.id,
      name: fd.get('name'),
      slug: String(fd.get('slug')).toLowerCase(),
      contactEmail: fd.get('contactEmail'),
      contactPhone: fd.get('contactPhone'),
      address: fd.get('address'),
      logoUrl,
      primaryColor: primary,
      accentColor: accent || null,
    })
    setBusy(false)
    if (res.error) setError(res.error)
    else router.push(`/admin/tenants/${res.id}`)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div>
        <label className={label}>Business name *</label>
        <input name="name" required defaultValue={initial?.name} className={input} />
      </div>
      <div>
        <label className={label}>Slug * (branded links: /auth/signin?tenant=slug)</label>
        <input name="slug" required pattern="[a-z0-9-]+" defaultValue={initial?.slug} className={input} placeholder="my-store" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Contact email</label>
          <input name="contactEmail" type="email" defaultValue={initial?.contactEmail ?? ''} className={input} />
        </div>
        <div>
          <label className={label}>Contact phone</label>
          <input name="contactPhone" defaultValue={initial?.contactPhone ?? ''} className={input} />
        </div>
      </div>
      <div>
        <label className={label}>Address</label>
        <input name="address" defaultValue={initial?.address ?? ''} className={input} />
      </div>

      {initial?.id && (
        <div>
          <span className={label}>Logo</span>
          <ImageCapture kind="branding" label="Logo" currentUrl={logoUrl} tenantId={initial.id} onUploaded={(r) => setLogoUrl(r.url)} />
        </div>
      )}

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

      <button disabled={busy} className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Saving…' : initial?.id ? 'Save tenant' : 'Create tenant'}
      </button>
    </form>
  )
}
