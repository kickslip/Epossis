import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { formatCents, formatDate } from '@/lib/format'
import { InvoiceUpload } from './InvoiceUpload'

export default async function InvoicesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) redirect('/dashboard')

  const [invoices, suppliers, tenant] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: { tenantId },
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currencySymbol: true } }),
  ])

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-lg font-semibold">Supplier invoices</h1>

      <InvoiceUpload suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {invoices.length === 0 && (
          <p className="col-span-full rounded-xl border bg-white p-6 text-center text-sm text-slate-400">
            No invoices yet — photograph a supplier invoice to keep it on file.
          </p>
        )}
        {invoices.map((inv) => (
          <a key={inv.id} href={inv.fileUrl} target="_blank" className="rounded-xl border bg-white p-3 hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl">
                {inv.mimeType === 'application/pdf' ? '📄' : '🧾'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {inv.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : 'Supplier invoice'}
                </p>
                <p className="text-xs text-slate-400">
                  {inv.supplier?.name ?? 'No supplier'} · {formatDate(inv.invoiceDate ?? inv.createdAt)}
                </p>
              </div>
              {inv.totalCents != null && (
                <span className="text-sm font-semibold">{formatCents(inv.totalCents, tenant.currencySymbol)}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
