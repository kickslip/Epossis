'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BarcodeScanner, useKeyboardScanner } from '@/components/BarcodeScanner'
import { ProductPicker, type PickedProduct } from '@/components/ProductPicker'
import { lookupBarcode } from '@/app/actions/products'
import { completeSale } from '@/app/actions/sales'
import { formatCents, parseMoneyToCents } from '@/lib/format'
import { randomUUID } from '@/lib/uuid'
import { isOnline, queueOp, lookupCached } from '@/lib/offline/db'

type CartLine = {
  productId: string
  name: string
  imageUrl: string | null
  unitPriceCents: number
  quantity: number
  discountCents: number
  available: number | null
}

export function PosScreen({
  locations,
  currencySymbol,
  taxRate,
  taxInclusive,
  addProductId,
}: {
  locations: { id: string; name: string }[]
  currencySymbol: string
  taxRate: number
  taxInclusive: boolean
  addProductId?: string
}) {
  const router = useRouter()
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [cart, setCart] = useState<CartLine[]>([])
  const [scanning, setScanning] = useState(true)
  const [basketDiscount, setBasketDiscount] = useState('')
  const [checkout, setCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE' | 'OTHER'>('CASH')
  const [tendered, setTendered] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ saleId: string; saleNumber: number; changeCents: number; queued?: boolean } | null>(null)
  const clientKeyRef = useRef(randomUUID())

  const sym = currencySymbol

  const addProduct = useCallback(
    (p: { id: string; name: string; thumbnailUrl?: string | null; imageUrl?: string | null; sellPriceCents: number; stockLevels?: { locationId: string; quantity: number }[] }) => {
      const available = p.stockLevels?.find((l) => l.locationId === locationId)?.quantity ?? null
      setCart((prev) => {
        const existing = prev.find((l) => l.productId === p.id)
        if (existing) {
          return prev.map((l) =>
            l.productId === p.id ? { ...l, quantity: l.quantity + 1, available } : l,
          )
        }
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            imageUrl: p.thumbnailUrl ?? p.imageUrl ?? null,
            unitPriceCents: p.sellPriceCents,
            quantity: 1,
            discountCents: 0,
            available,
          },
        ]
      })
    },
    [locationId],
  )

  // ?add=<productId> deep link from scan/product pages
  useEffect(() => {
    if (!addProductId) return
    fetch(`/api/products/${addProductId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && addProduct(p))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addProductId])

  const onScan = useCallback(
    async (code: string) => {
      if (isOnline()) {
        const p = await lookupBarcode(code).catch(() => null)
        if (p) return addProduct(p)
      }
      const cached = await lookupCached(code)
      if (cached) addProduct(cached)
    },
    [addProduct],
  )
  useKeyboardScanner(onScan, !checkout)

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unitPriceCents - l.discountCents, 0)
  const basketDiscountCents = parseMoneyToCents(basketDiscount)
  const preTax = Math.max(0, subtotal - basketDiscountCents)
  const tax = taxInclusive ? Math.round(preTax - preTax / (1 + taxRate / 100)) : Math.round((preTax * taxRate) / 100)
  const total = taxInclusive ? preTax : preTax + tax
  const tenderedCents = parseMoneyToCents(tendered)
  const change = Math.max(0, tenderedCents - total)

  function setQty(productId: string, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)),
    )
  }

  async function pay() {
    if (!cart.length || busy) return
    setBusy(true)
    setError('')
    const payload = {
      locationId,
      items: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        discountCents: l.discountCents,
      })),
      discountCents: basketDiscountCents,
      paymentMethod,
      cashTenderedCents: paymentMethod === 'CASH' ? tenderedCents : undefined,
      paymentRef: paymentRef || undefined,
      clientKey: clientKeyRef.current,
    }

    // Offline → queue the sale in IndexedDB; server assigns the real number on sync
    if (!isOnline()) {
      await queueOp({
        clientKey: clientKeyRef.current,
        kind: 'sale',
        payload: { ...payload, provisionalNumber: `OFF-${clientKeyRef.current.slice(0, 8)}` },
        queuedAt: Date.now(),
      })
      setBusy(false)
      setDone({ saleId: '', saleNumber: 0, changeCents: change, queued: true })
      setCart([])
      setCheckout(false)
      setTendered('')
      setPaymentRef('')
      setBasketDiscount('')
      clientKeyRef.current = randomUUID()
      return
    }

    const res = await completeSale(payload)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setDone({ saleId: res.saleId!, saleNumber: res.saleNumber!, changeCents: res.changeCents ?? 0 })
    setCart([])
    setCheckout(false)
    setTendered('')
    setPaymentRef('')
    setBasketDiscount('')
    clientKeyRef.current = randomUUID()
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <div className="rounded-2xl border bg-white p-8">
          <p className="text-4xl">{done.queued ? '📥' : '✅'}</p>
          <h1 className="mt-2 text-lg font-semibold">
            {done.queued ? 'Sale queued' : `Sale #${done.saleNumber} complete`}
          </h1>
          {done.queued && (
            <p className="mt-1 text-sm text-slate-500">Saved on this device — syncs when you&rsquo;re back online.</p>
          )}
          {done.changeCents > 0 && (
            <p className="mt-1 text-2xl font-bold text-primary-600">
              Change: {formatCents(done.changeCents, sym)}
            </p>
          )}
          <div className="mt-4 space-y-2">
            {!done.queued && (
              <button
                onClick={() => router.push(`/sales/${done.saleId}`)}
                className="w-full rounded-lg border py-2 text-sm font-medium text-slate-600"
              >
                View / print receipt
              </button>
            )}
            <button
              onClick={() => setDone(null)}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white"
            >
              New sale
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:flex-row">
      {/* Left: scan + pick */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Sell</h1>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border bg-white px-2 py-1.5 text-sm"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setScanning(!scanning)}
          className={`w-full rounded-lg border py-2 text-sm font-medium ${
            scanning ? 'border-primary-500 bg-primary-50 text-primary-700' : 'text-slate-600'
          }`}
        >
          {scanning ? '📷 Scanner on — point at a barcode' : '📷 Tap to scan'}
        </button>
        {scanning && <BarcodeScanner onDetected={onScan} />}

        <ProductPicker onPick={addProduct} placeholder="Search products…" />
      </div>

      {/* Right: cart */}
      <div className="w-full lg:w-96">
        <div className="rounded-xl border bg-white">
          <h2 className="border-b p-3 text-sm font-semibold">Cart ({cart.length})</h2>
          <div className="max-h-[40vh] divide-y overflow-y-auto">
            {cart.length === 0 && (
              <p className="p-4 text-center text-sm text-slate-400">Scan or search to add items</p>
            )}
            {cart.map((l) => (
              <div key={l.productId} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatCents(l.unitPriceCents, sym)}
                    {l.available != null && (
                      <span className={l.available < l.quantity ? 'text-red-500' : ''}>
                        {' '}
                        · {l.available} in stock
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={() => setQty(l.productId, l.quantity - 1)} className="h-7 w-7 rounded border text-sm">
                  −
                </button>
                <span className="w-7 text-center text-sm font-medium">{l.quantity}</span>
                <button onClick={() => setQty(l.productId, l.quantity + 1)} className="h-7 w-7 rounded border text-sm">
                  +
                </button>
                <span className="w-16 text-right text-sm font-medium">
                  {formatCents(l.quantity * l.unitPriceCents - l.discountCents, sym)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t p-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{formatCents(subtotal, sym)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Discount</span>
              <input
                value={basketDiscount}
                onChange={(e) => setBasketDiscount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-20 rounded border px-2 py-0.5 text-right text-sm"
              />
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>VAT ({taxRate}%){taxInclusive ? ' incl.' : ''}</span>
                <span>{formatCents(tax, sym)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold">
              <span>Total</span>
              <span>{formatCents(total, sym)}</span>
            </div>
            <button
              onClick={() => setCheckout(true)}
              disabled={!cart.length}
              className="mt-1 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Charge {formatCents(total, sym)}
            </button>
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      {checkout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="mb-3 text-center text-2xl font-bold">{formatCents(total, sym)}</h2>
            {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {(['CASH', 'CARD', 'MOBILE', 'OTHER'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-lg border py-2 text-xs font-medium ${
                    paymentMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'text-slate-600'
                  }`}
                >
                  {m === 'CASH' ? '💵' : m === 'CARD' ? '💳' : m === 'MOBILE' ? '📱' : '⋯'} {m}
                </button>
              ))}
            </div>

            {paymentMethod === 'CASH' ? (
              <>
                <input
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  placeholder="Cash tendered"
                  inputMode="decimal"
                  autoFocus
                  className="mb-2 w-full rounded-lg border px-3 py-2.5 text-center text-lg"
                />
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  {[2000, 5000, 10000, 20000].map((c) => (
                    <button
                      key={c}
                      onClick={() => setTendered((c / 100).toFixed(2))}
                      className="rounded-lg border py-1.5 text-xs text-slate-600"
                    >
                      {formatCents(c, sym)}
                    </button>
                  ))}
                </div>
                {tenderedCents >= total && total > 0 && (
                  <p className="mb-3 text-center text-lg font-bold text-green-600">
                    Change: {formatCents(change, sym)}
                  </p>
                )}
              </>
            ) : (
              <input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="Payment reference (optional)"
                className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setCheckout(false)}
                className="flex-1 rounded-lg border py-2.5 text-sm text-slate-600"
              >
                Back
              </button>
              <button
                onClick={pay}
                disabled={busy || (paymentMethod === 'CASH' && tenderedCents < total)}
                className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Processing…' : 'Complete sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
