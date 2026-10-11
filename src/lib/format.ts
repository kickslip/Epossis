/** Money/date formatting helpers. Money is stored as integer cents. */

export function formatCents(cents: number, symbol = 'R'): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const rands = (abs / 100).toFixed(2)
  const [whole, frac] = rands.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${negative ? '-' : ''}${symbol}${grouped}.${frac}`
}

export function parseMoneyToCents(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[R$\s,]/g, ''))
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
