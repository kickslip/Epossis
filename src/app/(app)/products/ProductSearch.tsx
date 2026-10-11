'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export function ProductSearch({
  q,
  categoryId,
  categories,
}: {
  q: string
  categoryId: string
  categories: { id: string; name: string }[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [term, setTerm] = useState(q)

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString())
      if (term) p.set('q', term)
      else p.delete('q')
      router.replace(`/products?${p.toString()}`)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  return (
    <div className="flex gap-2">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search name, barcode or SKU…"
        className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
      />
      <select
        value={categoryId}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString())
          if (e.target.value) p.set('category', e.target.value)
          else p.delete('category')
          router.replace(`/products?${p.toString()}`)
        }}
        className="rounded-lg border bg-white px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
