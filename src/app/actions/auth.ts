'use server'

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  tenantId: z.string().min(1),
})

/**
 * Self-registration creates a STAFF account bound to the tenant from the
 * branded link (?tenant=slug). ADMIN/SUPER_ADMIN are created by platform
 * admin — never via public registration.
 */
export async function registerStaff(input: unknown): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid details' }
  const { firstName, lastName, email, password, tenantId } = parsed.data

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { isActive: true } })
  if (!tenant?.isActive) return { error: 'Unknown store' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'An account with this email already exists' }

  await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'STAFF',
      tenantId,
    },
  })
  return {}
}
