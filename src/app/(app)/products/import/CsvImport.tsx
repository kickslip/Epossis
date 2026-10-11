'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { importProductsCsv } from '@/app/actions/products'

export function CsvImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null)

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const text = await f.text()
          setCsv(text)
          setFileName(f.name)
          setRowCount(text.split(/\r?\n/).filter((l) => l.trim()).length - 1)
          setResult(null)
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex h-24 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-primary-400"
      >
        {fileName ? `📄 ${fileName} — ${rowCount} rows` : 'Choose a CSV file'}
      </button>

      <a
        href="data:text/csv,name,barcode,sku,category,supplier,cost,sell,reorderLevel%0AExample Product,6001234567890,EX-001,Snacks,Makro,9.50,17.99,10"
        download="products-template.csv"
        className="text-xs text-primary-600 hover:underline"
      >
        Download CSV template
      </a>

      {csv && !result && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await importProductsCsv(csv)
            setResult(res)
            setBusy(false)
            if (res.errors.length === 0) setTimeout(() => router.push('/products'), 1200)
          }}
          className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Importing…' : `Import ${rowCount} rows`}
        </button>
      )}

      {result && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-green-700">
            ✓ {result.created} created, {result.updated} updated
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="mt-1 text-xs text-red-600">{e}</p>
          ))}
          <button onClick={() => { setCsv(''); setFileName(''); setResult(null) }} className="mt-2 text-xs text-primary-600">
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}
