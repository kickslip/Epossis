import type { TenantTheme } from '@/lib/tenant'

/** Renders the tenant/platform logo or a text wordmark — never hardcode names. */
export function BrandMark({
  theme,
  className = '',
  textClassName = 'text-xl font-bold text-slate-900',
}: {
  theme: TenantTheme
  className?: string
  textClassName?: string
}) {
  if (theme.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={theme.logoUrl} alt={theme.name} className={`h-9 w-auto object-contain ${className}`} />
    )
  }
  return <span className={`${textClassName} ${className}`}>{theme.name}</span>
}
