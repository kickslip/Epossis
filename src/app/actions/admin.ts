'use server'

import { prisma } from '@/lib/db'
import { requireAdminUser, requireSuperAdmin, tenantScope, assertTenantScope } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// ─── Tenants (SUPER_ADMIN) ───────────────────────────────────────────────────

const tenantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens'),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional().nullable(),
  faviconUrl: z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
})

export async function upsertTenant(input: unknown): Promise<{ id?: string; error?: string }> {
  const session = await requireSuperAdmin()
  const parsed = tenantSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid tenant data' }
  const d = parsed.data

  const slugClash = await prisma.tenant.findFirst({
    where: { slug: d.slug, ...(d.id ? { NOT: { id: d.id } } : {}) },
  })
  if (slugClash) return { error: 'Slug already in use' }

  const data = {
    name: d.name,
    slug: d.slug,
    contactEmail: d.contactEmail || null,
    contactPhone: d.contactPhone || null,
    address: d.address || null,
    logoUrl: d.logoUrl || null,
    faviconUrl: d.faviconUrl || null,
    primaryColor: d.primaryColor,
    accentColor: d.accentColor || null,
  }

  const tenant = d.id
    ? await prisma.tenant.update({ where: { id: d.id }, data })
    : await prisma.tenant.create({ data })

  await audit({
    userId: session.user.id,
    action: d.id ? 'tenant.update' : 'tenant.create',
    entity: 'Tenant',
    entityId: tenant.id,
    details: { slug: tenant.slug },
  })
  revalidatePath('/admin')
  return { id: tenant.id }
}

export async function setTenantActive(tenantId: string, active: boolean) {
  const session = await requireSuperAdmin()
  await prisma.tenant.update({ where: { id: tenantId }, data: { isActive: active } })
  await audit({ userId: session.user.id, action: 'tenant.toggle', entity: 'Tenant', entityId: tenantId, details: { active } })
  revalidatePath('/admin')
  return {}
}

/** Create the first ADMIN (manager) user for a tenant — SUPER_ADMIN only. */
export async function createTenantManager(input: {
  tenantId: string
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<{ error?: string }> {
  const session = await requireSuperAdmin()
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) return { error: 'Email already registered' }
  await prisma.user.create({
    data: {
      tenantId: input.tenantId,
      role: 'ADMIN',
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  })
  await audit({ userId: session.user.id, action: 'tenant.manager.create', entity: 'User', details: { email: input.email } })
  revalidatePath('/admin')
  return {}
}

// ─── Tenant settings (ADMIN) ─────────────────────────────────────────────────

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().optional().nullable(),
  faviconUrl: z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.coerce.boolean().optional(),
  receiptFooter: z.string().optional().nullable(),
  allowNegativeStock: z.coerce.boolean().optional(),
  defaultReorderLevel: z.coerce.number().int().min(0).optional(),
  deadStockDays: z.coerce.number().int().min(1).optional(),
})

/** Tenant manager updates own branding + commerce settings. */
export async function updateTenantSettings(input: unknown): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid settings' }
  await prisma.tenant.update({ where: { id: tenantId }, data: parsed.data as any })
  await audit({ tenantId, userId: session.user.id, action: 'tenant.settings', entity: 'Tenant', entityId: tenantId })
  revalidatePath('/settings')
  return {}
}

// ─── Locations / categories / suppliers (ADMIN) ──────────────────────────────

export async function upsertLocation(input: {
  id?: string
  name: string
  type: 'STORE' | 'WAREHOUSE'
  address?: string
}): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }
  if (input.id) {
    const loc = await prisma.location.findUnique({ where: { id: input.id } })
    if (!loc || loc.tenantId !== tenantId) return { error: 'Not found' }
    await prisma.location.update({
      where: { id: input.id },
      data: { name: input.name, type: input.type, address: input.address || null },
    })
  } else {
    await prisma.location.create({
      data: { tenantId, name: input.name, type: input.type, address: input.address || null },
    })
  }
  revalidatePath('/settings')
  revalidatePath('/stock')
  return {}
}

export async function upsertCategory(input: { id?: string; name: string }): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }
  if (input.id) {
    const c = await prisma.category.findUnique({ where: { id: input.id } })
    if (!c || c.tenantId !== tenantId) return { error: 'Not found' }
    await prisma.category.update({ where: { id: input.id }, data: { name: input.name } })
  } else {
    await prisma.category.create({ data: { tenantId, name: input.name } })
  }
  revalidatePath('/settings')
  return {}
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  const c = await prisma.category.findUnique({ where: { id } })
  if (!c || c.tenantId !== tenantId) return { error: 'Not found' }
  await prisma.category.delete({ where: { id } }).catch(() => {})
  revalidatePath('/settings')
  return {}
}

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export async function upsertSupplier(input: unknown): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }
  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid data' }
  const { id, ...data } = parsed.data
  if (id) {
    const s = await prisma.supplier.findUnique({ where: { id } })
    if (!s || s.tenantId !== tenantId) return { error: 'Not found' }
    await prisma.supplier.update({ where: { id }, data })
  } else {
    await prisma.supplier.create({ data: { tenantId, ...data } })
  }
  revalidatePath('/settings')
  return {}
}

// ─── Users (ADMIN manages own tenant's staff) ────────────────────────────────

export async function upsertStaffUser(input: {
  id?: string
  firstName: string
  lastName: string
  email: string
  password?: string
  role: 'ADMIN' | 'STAFF'
}): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }

  if (input.id) {
    const u = await prisma.user.findUnique({ where: { id: input.id } })
    if (!u || u.tenantId !== tenantId) return { error: 'Not found' }
    await prisma.user.update({
      where: { id: input.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
      },
    })
  } else {
    const existing = await prisma.user.findUnique({ where: { email: input.email } })
    if (existing) return { error: 'Email already registered' }
    if (!input.password || input.password.length < 6) return { error: 'Password min 6 chars' }
    await prisma.user.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
    })
  }
  revalidatePath('/settings')
  return {}
}

export async function setUserActive(userId: string, active: boolean): Promise<{ error?: string }> {
  const session = await requireAdminUser()
  const { tenantId } = tenantScope(session)
  const u = await prisma.user.findUnique({ where: { id: userId } })
  if (!u || u.tenantId !== tenantId) return { error: 'Not found' }
  if (u.id === session.user.id) return { error: 'Cannot deactivate yourself' }
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } })
  revalidatePath('/settings')
  return {}
}
