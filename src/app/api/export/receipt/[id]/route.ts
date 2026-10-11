import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { receiptPdf } from '@/lib/export/pdf'
import { formatDateTime } from '@/lib/format'
import path from 'path'
import fs from 'fs/promises'

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

  let logoPath: string | null = null
  if (sale.tenant.logoUrl?.startsWith('/api/files/')) {
    const abs = path.join(process.cwd(), 'storage', sale.tenant.logoUrl.replace('/api/files/', '').replace(/\.\./g, ''))
    try {
      await fs.access(abs)
      logoPath = abs
    } catch {}
  }

  const pdf = await receiptPdf({
    brand: { name: sale.tenant.name, logoPath, footer: sale.tenant.receiptFooter },
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
