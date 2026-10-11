'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchProducts } from '@/app/actions/products'
import { BarcodeScanner } from './BarcodeScanner'
import { loadCatalog } from '@/lib/offline/db'

export type PickedProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  thumbnailUrl: string | null
  sellPriceCents: number
  costPriceCents: number
  stockLevels: { locationId: string; quantity: number }[]
}

/**
 * Typeahead product picker with optional camera-scan. Use on forms that
 * need to choose a product (receive/adjust/transfer/count/POS).
 */
export function ProductPicker({
  onPick,
  placeholder = 'Search or scan a product…',
  autoFocus,
}: {
  onPick: (product: PickedProduct) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PickedProduct[]>([])
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    debounce.current = setTimeout(async () => {
      try {
        const rows = (await searchProducts(term)) as unknown as PickedProduct[]
        setResults(rows)
      } catch {
        // Offline → filter the cached catalog
        const cat = await loadCatalog()
        const t = term.toLowerCase()
        setResults(
          (cat?.products ?? [])
            .filter(
              (p) =>
                p.name.toLowerCase().includes(t) ||
                p.barcode?.includes(term) ||
                p.sku?.toLowerCase().includes(t),
            )
            .slice(0, 25) as PickedProduct[],
        )
      }
      setOpen(true)
    }, 250)
    return () => clearTimeout(debounce.current)
  }, [term])

  const pick = useCallback(
    (p: PickedProduct) => {
      onPick(p)
      setTerm('')
      setResults([])
      setOpen(false)
      setScanning(false)
    },
    [onPick],
  )

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={term}
          autoFocus={autoFocus}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
        <button
          type="button"
          onClick={() => setScanning(!scanning)}
          className={`shrink-0 rounded-lg border px-3 text-sm ${scanning ? 'bg-primary-50 text-primary-700' : 'text-slate-600'}`}
          title="Scan barcode"
        >
          📷
        </button>
      </div>

      {scanning && (
        <div className="mt-2">
          <BarcodeScanner
            onDetected={async (code) => {
              let rows: PickedProduct[] = []
              try {
                rows = (await searchProducts(code)) as unknown as PickedProduct[]
              } catch {
                const cat = await loadCatalog()
                rows = (cat?.products ?? []).filter((p) => p.barcode === code || p.sku === code) as PickedProduct[]
              }
              const exact = rows.find((r) => r.barcode === code || r.sku === code) ?? rows[0]
              if (exact) pick(exact)
            }}
          />
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            >
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-xs">📦</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-slate-400">{p.sku ?? p.barcode ?? ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
