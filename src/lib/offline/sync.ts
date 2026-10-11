'use client'

import { pendingOps, removeOp, takeBlob, removeBlob, type QueuedOp, type CachedProduct, saveCatalog } from './db'

/** Push all queued ops to /api/sync; remove acknowledged ones. */
export async function syncOutbox(): Promise<{ synced: number; failed: number }> {
  const ops = await pendingOps()
  if (!ops.length) return { synced: 0, failed: 0 }

  // Resolve 'pending:<blobKey>' attachments captured offline — upload the
  // blob now and substitute the real URL before sending the op.
  for (const op of ops) {
    for (const [k, v] of Object.entries(op.payload)) {
      if (typeof v === 'string' && v.startsWith('pending:')) {
        const url = await uploadQueuedBlob(v.slice('pending:'.length))
        if (url) {
          op.payload[k] = url
          await removeBlob(v.slice('pending:'.length))
        } else {
          delete op.payload[k]
        }
      }
    }
  }

  let res: Response
  try {
    res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    })
  } catch {
    return { synced: 0, failed: ops.length }
  }
  if (!res.ok) return { synced: 0, failed: ops.length }

  const { results } = (await res.json()) as { results: { clientKey: string; ok: boolean }[] }
  let synced = 0
  for (const r of results) {
    if (r.ok) {
      await removeOp(r.clientKey)
      await removeBlob(r.clientKey)
      synced++
    }
  }
  return { synced, failed: ops.length - synced }
}

/** Refresh the offline product snapshot. */
export async function refreshCatalog(): Promise<number> {
  const res = await fetch('/api/sync/catalog')
  if (!res.ok) return 0
  const products = (await res.json()) as CachedProduct[]
  await saveCatalog(products)
  return products.length
}

/** Upload a queued blob (invoice image) to /api/upload, returns url or null. */
export async function uploadQueuedBlob(clientKey: string): Promise<string | null> {
  const b = await takeBlob(clientKey)
  if (!b) return null
  const fd = new FormData()
  fd.set('kind', b.kind)
  fd.set('file', b.blob, b.blob.type === 'application/pdf' ? 'capture.pdf' : 'capture.jpg')
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) return null
  const { url } = await res.json()
  return url ?? null
}

export type { QueuedOp }
