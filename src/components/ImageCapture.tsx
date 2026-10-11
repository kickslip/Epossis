'use client'

import { useRef, useState } from 'react'
import { isOnline, queueBlob } from '@/lib/offline/db'

/**
 * Image picker: take a photo (phone camera) or choose a file, uploads to
 * /api/upload and reports back the stored URLs. Used for product photos
 * and invoice scans. Offline: if `blobKey` is set the file is queued in
 * IndexedDB and reported as `pending:<key>` — synced on reconnect.
 */
export function ImageCapture({
  kind,
  label = 'Photo',
  currentUrl,
  accept = 'image/*',
  tenantId,
  blobKey,
  onUploaded,
}: {
  kind: 'products' | 'invoices' | 'branding'
  label?: string
  currentUrl?: string | null
  accept?: string
  /** Required when a SUPER_ADMIN uploads on behalf of a tenant */
  tenantId?: string
  /** Enables offline queueing — file syncs later under this key */
  blobKey?: string
  onUploaded: (result: { url: string; thumbnailUrl?: string }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setBusy(true)
    setError('')
    try {
      setPreview(URL.createObjectURL(file))
      if (!isOnline()) {
        if (!blobKey) throw new Error('Offline — cannot attach files right now')
        await queueBlob(blobKey, file, kind)
        onUploaded({ url: `pending:${blobKey}` })
        return
      }
      const fd = new FormData()
      fd.set('kind', kind)
      fd.set('file', file)
      if (tenantId) fd.set('tenantId', tenantId)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setPreview(data.url)
      onUploaded(data)
    } catch (e: any) {
      setError(e.message)
      setPreview(currentUrl ?? null)
    } finally {
      setBusy(false)
    }
  }

  const isPdf = preview?.endsWith('.pdf') || accept === 'application/pdf,image/*'

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-primary-400"
      >
        {preview && !isPdf ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : preview && isPdf ? (
          <span className="text-slate-600">📄 {label} attached</span>
        ) : busy ? (
          'Uploading…'
        ) : (
          <span>
            📷 Tap to {currentUrl ? 'replace' : 'add'} {label.toLowerCase()}
          </span>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
