import { primaryScaleVars, hexToRgb } from '@/lib/color'
import type { TenantTheme } from '@/lib/tenant'

/**
 * Server component — emits a <style> tag setting the --primary-N RGB
 * triplets + accent vars from the resolved theme so SSR renders branded.
 */
export function BrandStyle({ theme }: { theme: TenantTheme }) {
  const vars = primaryScaleVars(theme.primaryColor)
  const accent = hexToRgb(theme.accentColor)
  const css = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('')}--accent-rgb:${accent[0]} ${accent[1]} ${accent[2]};}`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
