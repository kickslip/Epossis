import { auth } from './auth'
import type { Session } from 'next-auth'

/** Any signed-in user (staff included). */
export async function requireUser(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session
}

/** Tenant manager (ADMIN) or platform super admin. */
export async function requireAdminUser(): Promise<Session> {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
    throw new Error('Unauthorized')
  }
  return session
}

/** Platform super admin only. */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id || (session.user as any)?.role !== 'SUPER_ADMIN') {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Prisma `where` fragment that scopes a query to the caller's tenant.
 * Returns `{}` for SUPER_ADMIN (platform-wide view).
 * Throws if a tenant user has no tenant assigned.
 */
export function tenantScope(session: Session): { tenantId?: string } {
  if ((session.user as any)?.role === 'SUPER_ADMIN') return {}
  const tenantId = (session.user as any)?.tenantId
  if (!tenantId) throw new Error('User has no tenant assigned')
  return { tenantId }
}

/**
 * Throws if a tenant user tries to touch an entity outside their tenant.
 * SUPER_ADMIN may cross tenant boundaries intentionally.
 */
export function assertTenantScope(session: Session, entityTenantId: string | null | undefined) {
  if ((session.user as any)?.role === 'SUPER_ADMIN') return
  const { tenantId } = tenantScope(session)
  if (entityTenantId !== tenantId) {
    throw new Error('Forbidden — outside your tenant')
  }
}
