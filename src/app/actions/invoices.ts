'use server'

import { prisma } from '@/lib/db'
import { requireUser, tenantScope, assertTenantScope } from '@/lib/admin-auth'
import { deleteStoredFile } from '@/lib/files'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const invoiceSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  totalCents: z.coerce.number().int().min(0).optional().nullable(),
  fileUrl: z.string().min(1),
  mimeType: z.string().default('image/jpeg'),
  note: z.string().optional().nullable(),
})

/** Record a supplier invoice (photo/PDF already uploaded via /api/upload). */
export async function createPurchaseInvoice(input: unknown): Promise<{ id?: string; error?: string }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  if (!tenantId) return { error: 'No tenant' }
  const parsed = invoiceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid data' }
  const d = parsed.data

  const inv = await prisma.purchaseInvoice.create({
    data: {
      tenantId,
      supplierId: d.supplierId || null,
      invoiceNumber: d.invoiceNumber || null,
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : new Date(),
      totalCents: d.totalCents ?? null,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType,
      note: d.note || null,
      uploadedById: session.user.id,
    },
  })
  revalidatePath('/invoices')
  return { id: inv.id }
}

export async function updatePurchaseInvoice(input: unknown): Promise<{ error?: string }> {
  const session = await requireUser()
  const { tenantId } = tenantScope(session)
  const parsed = invoiceSchema.safeParse(input)
  if (!parsed.success || !parsed.data.id) return { error: 'Invalid data' }
  const d = parsed.data

  const inv = await prisma.purchaseInvoice.findUnique({ where: { id: d.id } })
  if (!inv) return { error: 'Not found' }
  try {
    assertTenantScope(session, inv.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }

  await prisma.purchaseInvoice.update({
    where: { id: d.id },
    data: {
      supplierId: d.supplierId || null,
      invoiceNumber: d.invoiceNumber || null,
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : inv.invoiceDate,
      totalCents: d.totalCents ?? null,
      note: d.note || null,
    },
  })
  revalidatePath('/invoices')
  return {}
}

export async function deletePurchaseInvoice(id: string): Promise<{ error?: string }> {
  const session = await requireUser()
  const inv = await prisma.purchaseInvoice.findUnique({ where: { id } })
  if (!inv) return { error: 'Not found' }
  try {
    assertTenantScope(session, inv.tenantId)
  } catch {
    return { error: 'Forbidden' }
  }
  await prisma.purchaseInvoice.delete({ where: { id } })
  await deleteStoredFile(inv.fileUrl)
  revalidatePath('/invoices')
  return {}
}
