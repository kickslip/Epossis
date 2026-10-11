import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { formatCents, formatDateTime } from '@/lib/format'
import { VoidSaleButton } from './VoidSaleButton'
import { PrintButton } from './PrintButton'

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  const tenantId = (session.user as any).tenantId
  const role = (session.user as any).role

  const sale = await prisma.sale.findFirst({
    where: { id: params.id, tenantId },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      location: true,
      user: { select: { firstName: true, lastName: true } },
      tenant: true,
    },
  })
  if (!sale) notFound()

  const sym = sale.tenant.currencySymbol

  return (
    <div className="mx-auto max-w-sm p-4">
      {/* Printable receipt (80mm CSS via globals print rules) */}
      <div className="receipt-print rounded-xl border bg-white p-4 font-mono text-xs" id="receipt">
        <div className="text-center">
          {sale.tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sale.tenant.logoUrl} alt="" className="mx-auto mb-1 h-10 object-contain" />
          )}
          <p className="text-sm font-bold">{sale.tenant.name}</p>
          {sale.tenant.address && <p>{sale.tenant.address}</p>}
          {sale.tenant.contactPhone && <p>{sale.tenant.contactPhone}</p>}
        </div>
        <div className="my-2 border-t border-dashed" />
        <p>Receipt #{sale.saleNumber}</p>
        <p>{formatDateTime(sale.createdAt)}</p>
        <p>
          {sale.location.name}
          {sale.user ? ` · ${sale.user.firstName} ${sale.user.lastName}` : ''}
        </p>
        {sale.status === 'VOIDED' && <p className="font-bold">*** VOIDED ***</p>}
        <div className="my-2 border-t border-dashed" />
        {sale.items.map((it) => (
          <div key={it.id} className="mb-1">
            <p>{it.product.name}</p>
            <p className="flex justify-between">
              <span>
                {it.quantity} × {formatCents(it.unitPriceCents, sym)}
              </span>
              <span>{formatCents(it.lineTotalCents, sym)}</span>
            </p>
          </div>
        ))}
        <div className="my-2 border-t border-dashed" />
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCents(sale.subtotalCents, sym)}</span>
        </p>
        {sale.discountCents > 0 && (
          <p className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCents(sale.discountCents, sym)}</span>
          </p>
        )}
        {sale.taxCents > 0 && (
          <p className="flex justify-between">
            <span>VAT{sale.tenant.taxInclusive ? ' (incl.)' : ''}</span>
            <span>{formatCents(sale.taxCents, sym)}</span>
          </p>
        )}
        <p className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatCents(sale.totalCents, sym)}</span>
        </p>
        <p className="mt-1 flex justify-between">
          <span>{sale.paymentMethod}</span>
          {sale.cashTenderedCents != null && <span>{formatCents(sale.cashTenderedCents, sym)}</span>}
        </p>
        {sale.changeCents != null && sale.changeCents > 0 && (
          <p className="flex justify-between">
            <span>Change</span>
            <span>{formatCents(sale.changeCents, sym)}</span>
          </p>
        )}
        <div className="my-2 border-t border-dashed" />
        {sale.tenant.receiptFooter && <p className="text-center">{sale.tenant.receiptFooter}</p>}
      </div>

      <div className="no-print mt-4 space-y-2">
        <PrintButton />
        <a
          href={`/api/export/receipt/${sale.id}`}
          className="block rounded-lg border py-2 text-center text-sm text-slate-600"
        >
          Download PDF
        </a>
        {role !== 'STAFF' && sale.status === 'COMPLETED' && <VoidSaleButton saleId={sale.id} />}
        {sale.status === 'VOIDED' && (
          <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            Voided{sale.voidReason ? `: ${sale.voidReason}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
