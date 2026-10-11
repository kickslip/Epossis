'use client'

import { openDB, type IDBPDatabase } from 'idb'

/**
 * IndexedDB stores:
 *  - outbox: pending mutations keyed by clientKey (idempotent sync)
 *  - kv: cached product catalog + misc
 *  - blobs: image/invoice files captured offline, keyed by clientKey
 */
let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  dbPromise ??= openDB('epos-offline', 1, {
    upgrade(db) {
      db.createObjectStore('outbox', { keyPath: 'clientKey' })
      db.createObjectStore('kv')
      db.createObjectStore('blobs', { keyPath: 'clientKey' })
    },
  })
  return dbPromise
}

export type QueuedOp = {
  clientKey: string
  kind: 'sale' | 'receive' | 'adjust'
  payload: Record<string, unknown>
  queuedAt: number
}

export async function queueOp(op: QueuedOp) {
  await (await getDb()).put('outbox', op)
}

export async function pendingOps(): Promise<QueuedOp[]> {
  return (await getDb()).getAll('outbox')
}

export async function pendingCount(): Promise<number> {
  return (await getDb()).count('outbox')
}

export async function removeOp(clientKey: string) {
  await (await getDb()).delete('outbox', clientKey)
}

export async function queueBlob(clientKey: string, blob: Blob, kind: string) {
  await (await getDb()).put('blobs', { clientKey, blob, kind })
}

export async function takeBlob(clientKey: string): Promise<{ blob: Blob; kind: string } | null> {
  const row = await (await getDb()).get('blobs', clientKey)
  if (!row) return null
  return { blob: row.blob, kind: row.kind }
}

export async function removeBlob(clientKey: string) {
  await (await getDb()).delete('blobs', clientKey)
}

export type CachedProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  thumbnailUrl: string | null
  sellPriceCents: number
  costPriceCents: number
  stockLevels: { locationId: string; quantity: number }[]
}

export async function saveCatalog(products: CachedProduct[]) {
  await (await getDb()).put('kv', { at: Date.now(), products }, 'catalog')
}

export async function loadCatalog(): Promise<{ at: number; products: CachedProduct[] } | null> {
  return (await getDb()).get('kv', 'catalog')
}

export async function lookupCached(code: string): Promise<CachedProduct | null> {
  const cat = await loadCatalog()
  if (!cat) return null
  const c = code.trim()
  return cat.products.find((p) => p.barcode === c || p.sku === c) ?? null
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
