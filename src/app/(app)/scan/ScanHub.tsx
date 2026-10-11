'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarcodeScanner, useKeyboardScanner } from '@/components/BarcodeScanner'
import { lookupBarcode, lookupExternalBarcodeAction } from '@/app/actions/products'
import { lookupCached, isOnline } from '@/lib/offline/db'

type ScannedProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  imageUrl: string | null
  sellPriceCents: number
  stockLevels: { locationId: string; quantity: number; location: { name: string } }[]
}

export function ScanHub({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [product, setProduct] = useState<ScannedProduct | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [manual, setManual] = useState('')
  const [external, setExternal] = useState<{
    name: string
    brand?: string
    description?: string
    imageUrl?: string
    source: string
  } | null>(null)
  const [searchingExternal, setSearchingExternal] = useState(false)

  const onScan = useCallback(async (scanned: string) => {
    setCode(scanned)
    setExternal(null)
    let found: ScannedProduct | null = null
    if (isOnline()) {
      found = (await lookupBarcode(scanned).catch(() => null)) as unknown as ScannedProduct | null
    }
    if (!found) {
      const cached = await lookupCached(scanned)
      found = cached
        ? { ...cached, imageUrl: cached.thumbnailUrl, stockLevels: cached.stockLevels.map((s) => ({ ...s, location: { name: '' } })) }
        : null
    }
    setProduct(found)
    setNotFound(!found)
    if (!found && isOnline()) {
      setSearchingExternal(true)
      const ext = await lookupExternalBarcodeAction(scanned).catch(() => null)
      setSearchingExternal(false)
      if (ext) setExternal(ext)
    }
  }, [])

  useKeyboardScanner(onScan)

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-lg font-semibold">Scan</h1>
      <BarcodeScanner onDetected={onScan} />

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) onScan(manual.trim())
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Type barcode / SKU…"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-primary-600 px-4 text-sm font-medium text-white">Go</button>
      </form>

      {code && (
        <div className="mt-4 rounded-xl border bg-white p-4">
          <p className="font-mono text-xs text-slate-400">{code}</p>

          {notFound && (
            <div className="mt-2">
              <p className="text-sm font-medium text-slate-700">
                {searchingExternal ? 'Searching online databases…' : 'No product with this code in your catalog.'}
              </p>
              {external && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  {external.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={external.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-100 text-xl">🔎</div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-emerald-900">{external.name}</p>
                    {external.brand && <p className="text-xs text-emerald-700">{external.brand}</p>}
                    <p className="text-[11px] text-emerald-600">Found via {external.source}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  const p = new URLSearchParams({ barcode: code })
                  if (external?.name) p.set('name', external.name)
                  const desc = external?.description || external?.brand
                  if (desc) p.set('description', desc)
                  if (external?.imageUrl) p.set('imageUrl', external.imageUrl)
                  router.push(`/products/new?${p.toString()}`)
                }}
                className="mt-2 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white"
              >
                {external ? '+ Create listing with these details' : '+ Create new listing'}
              </button>
            </div>
          )}

          {product && (
            <div className="mt-2">
              <div className="flex items-center gap-3">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-xl">📦</div>
                )}
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.sku ?? product.barcode}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {product.stockLevels.map((s) => `${s.location.name}: ${s.quantity}`).join(' · ') ||
                  'No stock recorded'}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    router.push(`/stock/receive?productId=${product.id}`)
                  }
                  className="rounded-lg border border-primary-200 bg-primary-50 py-2 text-sm font-medium text-primary-700"
                >
                  Receive
                </button>
                <button
                  onClick={() => router.push(`/pos?add=${product.id}`)}
                  className="rounded-lg border border-primary-200 bg-primary-50 py-2 text-sm font-medium text-primary-700"
                >
                  Sell
                </button>
                <button
                  onClick={() => router.push(`/stock/adjust?productId=${product.id}`)}
                  className="rounded-lg border py-2 text-sm font-medium text-slate-600"
                >
                  Adjust
                </button>
                <button
                  onClick={() => router.push(`/stock/transfer?productId=${product.id}`)}
                  className="rounded-lg border py-2 text-sm font-medium text-slate-600"
                >
                  Transfer
                </button>
                <button
                  onClick={() => router.push(`/stock/count?productId=${product.id}`)}
                  className="rounded-lg border py-2 text-sm font-medium text-slate-600"
                >
                  Count
                </button>
                <button
                  onClick={() => router.push(`/products/${product.id}`)}
                  className="rounded-lg border py-2 text-sm font-medium text-slate-600"
                >
                  View
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
