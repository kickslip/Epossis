'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="w-full rounded-lg bg-primary-600 py-2 text-sm font-semibold text-white"
    >
      Print receipt
    </button>
  )
}
