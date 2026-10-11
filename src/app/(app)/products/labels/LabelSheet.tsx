'use client'

import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { formatCents } from '@/lib/format'

type Product = { id: string; name: string; barcode: string | null; sellPriceCents: number }

export function LabelSheet({
  products,
  currencySymbol,
}: {
  products: Product[]
  currencySymbol: string
}) {
  const [selected, setSelected] = useState<Map<string, number>>(new Map())
  const [labels, setLabels] = useState<Product[]>([])
  const [showPrice, setShowPrice] = useState(true)
  const svgRef = useRef<HTMLDivElement>(null)

  function toggle(id: string) {
    setSelected((m) => {
      const n = new Map(m)
      if (n.has(id)) n.delete(id)
      else n.set(id, 1)
      return n
    })
  }

  function buildSheet() {
    const out: Product[] = []
    for (const [id, copies] of selected) {
      const p = products.find((x) => x.id === id)
      if (p) for (let i = 0; i < copies; i++) out.push(p)
    }
    setLabels(out)
  }

  // Render JsBarcode into each label's svg after sheet builds
  useEffect(() => {
    if (!svgRef.current) return
    svgRef.current.querySelectorAll<SVGSVGElement>('svg[data-barcode]').forEach((el) => {
      const code = el.dataset.barcode!
      try {
        JsBarcode(el, code, {
          format: code.length === 13 ? 'EAN13' : code.length === 12 ? 'UPC' : code.length === 8 ? 'EAN8' : 'CODE128',
          width: 1.2,
          height: 32,
          fontSize: 10,
          margin: 0,
        })
      } catch {
        try {
          JsBarcode(el, code, { format: 'CODE128', width: 1.2, height: 32, fontSize: 10, margin: 0 })
        } catch {}
      }
    })
  }, [labels])

  return (
    <div className="space-y-4">
      <div className="max-h-64 divide-y overflow-y-auto rounded-xl border bg-white">
        {products.map((p) => {
          const copies = selected.get(p.id)
          return (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={!!copies} onChange={() => toggle(p.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.name}</p>
                <p className="font-mono text-xs text-slate-400">{p.barcode}</p>
              </div>
              {copies != null && (
                <input
                  type="number"
                  min="1"
                  value={copies}
                  onChange={(e) =>
                    setSelected((m) => new Map(m).set(p.id, Math.max(1, Number(e.target.value))))
                  }
                  className="w-14 rounded border px-1 py-0.5 text-center text-xs"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
          Include price
        </label>
        <button
          onClick={buildSheet}
          disabled={!selected.size}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Preview sheet
        </button>
        {labels.length > 0 && (
          <button onClick={() => window.print()} className="rounded-lg border px-4 py-2 text-sm">
            Print {labels.length} labels
          </button>
        )}
      </div>

      {labels.length > 0 && (
        <div ref={svgRef} className="grid grid-cols-3 gap-1 rounded-xl border bg-white p-3 print:grid-cols-4">
          {labels.map((p, i) => (
            <div key={`${p.id}-${i}`} className="flex flex-col items-center border border-dashed border-slate-200 p-1">
              <p className="max-w-full truncate text-center text-[10px] font-medium">{p.name}</p>
              <svg data-barcode={p.barcode!} />
              {showPrice && <p className="text-[10px]">{formatCents(p.sellPriceCents, currencySymbol)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
