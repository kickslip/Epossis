import { prisma } from './db'
import { auth } from './auth'
import { PLATFORM } from './brand'

export type TenantTheme = {
  name: string
  slug: string | null
  primaryColor: string
  accentColor: string
  logoUrl: string | null
  faviconUrl: string | null
  /** true when this theme came from a real tenant rather than the platform fallback */
  isTenant: boolean
}

export const PLATFORM_THEME: TenantTheme = {
  name: PLATFORM.name,
  slug: null,
  primaryColor: PLATFORM.primary,
  accentColor: PLATFORM.accent,
  logoUrl: PLATFORM.logoUrl,
  faviconUrl: null,
  isTenant: false,
}

function toTheme(t: {
  name: string
  slug: string
  primaryColor: string | null
  accentColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
}): TenantTheme {
  return {
    name: t.name,
    slug: t.slug,
    primaryColor: t.primaryColor ?? PLATFORM.primary,
    accentColor: t.accentColor ?? PLATFORM.accent,
    logoUrl: t.logoUrl,
    faviconUrl: t.faviconUrl ?? t.logoUrl,
    isTenant: true,
  }
}

const THEME_SELECT = {
  name: true,
  slug: true,
  primaryColor: true,
  accentColor: true,
  logoUrl: true,
  faviconUrl: true,
} as const

/** Theme for the signed-in user's tenant; platform brand when none. */
export async function getTenantTheme(): Promise<TenantTheme> {
  try {
    const session = await auth()
    const tenantId = (session?.user as any)?.tenantId
    if (!tenantId) return PLATFORM_THEME

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: THEME_SELECT,
    })
    return tenant ? toTheme(tenant) : PLATFORM_THEME
  } catch {
    return PLATFORM_THEME
  }
}

/** Theme for a tenant slug — used on public auth pages (?tenant=acme). */
export async function getTenantThemeBySlug(slug: string): Promise<TenantTheme> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { ...THEME_SELECT, id: true, isActive: true },
    })
    if (!tenant || !tenant.isActive) return PLATFORM_THEME
    return toTheme(tenant)
  } catch {
    return PLATFORM_THEME
  }
}

/** Resolve a tenant slug to its id (for registration binding). Null if unknown/inactive. */
export async function getTenantIdBySlug(slug: string): Promise<string | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })
    return tenant?.isActive ? tenant.id : null
  } catch {
    return null
  }
}
