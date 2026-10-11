import { prisma } from './db'

export async function audit(entry: {
  tenantId?: string | null
  userId?: string | null
  action: string
  entity: string
  entityId?: string | null
  details?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    })
  } catch (e) {
    console.error('[audit] failed to write', e)
  }
}
