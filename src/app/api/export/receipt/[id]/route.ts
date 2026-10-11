import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { receiptPdf } from '@/lib/export/pdf'
import { formatDateTime } from '@/lib/format'

/** GET /api/export/receipt/<saleId> — branded PDF receipt. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!session?.user || !tenantId) return new NextResponse('Unauthorized', { status: 401 })

  const sale = await prisma.sale.findFirst({
    where: { id: params.id, tenantId },
    include: {
      items: { include: { product: { select: { name: true } } } },
      location: true,
      user: true,
      tenant: true,
    },
  })
  if (!sale) return new NextResponse('Not found', { status: 404 })

  let logoData: Buffer | null = null
  const logoFileId = sale.tenant.logoUrl?.match(/\/api\/files\/([^/]+)/)?.[1]
  if (logoFileId) {
    const row = await prisma.storedFile.findUnique({ where: { id: logoFileId } })
    if (row) logoData = Buffer.from(row.data)
  }

  const pdf = await receiptPdf({
    brand: { name: sale.tenant.name, logoData, footer: sale.tenant.receiptFooter },
    saleNumber: sale.saleNumber,
    dateStr: formatDateTime(sale.createdAt),
    locationName: sale.location.name,
    cashierName: sale.user ? `${sale.user.firstName} ${sale.user.lastName}` : '—',
    voided: sale.status === 'VOIDED',
    items: sale.items.map((i) => ({
      name: i.product.name,
      qty: i.quantity,
      unitCents: i.unitPriceCents,
      lineCents: i.lineTotalCents,
    })),
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    taxCents: sale.taxCents,
    taxInclusive: sale.tenant.taxInclusive,
    totalCents: sale.totalCents,
    paymentMethod: sale.paymentMethod,
    tenderedCents: sale.cashTenderedCents,
    changeCents: sale.changeCents,
    sym: sale.tenant.currencySymbol,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${sale.saleNumber}.pdf"`,
    },
  })
}
