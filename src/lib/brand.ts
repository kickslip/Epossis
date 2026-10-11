/**
 * Platform brand — the fallback identity when no tenant context applies
 * (landing page, super admin, tenant-less users).
 *
 * Override via env:
 *   NEXT_PUBLIC_PLATFORM_NAME
 *   NEXT_PUBLIC_PLATFORM_LOGO_URL
 *   NEXT_PUBLIC_PLATFORM_PRIMARY   (hex, drives the primary-* scale)
 *   NEXT_PUBLIC_PLATFORM_ACCENT    (hex, drives the secondary accent)
 */
export const PLATFORM = {
  name: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Epossis',
  logoUrl: process.env.NEXT_PUBLIC_PLATFORM_LOGO_URL || null,
  primary: process.env.NEXT_PUBLIC_PLATFORM_PRIMARY || '#3b82f6',
  accent: process.env.NEXT_PUBLIC_PLATFORM_ACCENT || '#0ea5e9',
} as const

export type PlatformBrand = typeof PLATFORM
