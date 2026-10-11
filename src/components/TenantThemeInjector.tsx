'use client'

import { useEffect } from 'react'
import type { TenantTheme } from '@/lib/tenant'

/** Client-side: applies document title + favicon per resolved theme. */
export function TenantThemeInjector({ theme }: { theme: TenantTheme }) {
  useEffect(() => {
    document.title = theme.name
    const icon = theme.faviconUrl ?? theme.logoUrl
    if (!icon) return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = icon
  }, [theme])
  return null
}
