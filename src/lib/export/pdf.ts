import PDFDocument from 'pdfkit'

export type PdfBrand = {
  name: string
  logoPath?: string | null // absolute fs path to a logo image
  footer?: string | null
}

/** Simple branded table PDF: title, generated date, monospace table. */
export async function tablePdf(opts: {
  brand: PdfBrand
  title: string
  subtitle?: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
  colWidths?: number[] // character widths per column
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  // Header
  if (opts.brand.logoPath) {
    try {
      doc.image(opts.brand.logoPath, 40, 32, { height: 36 })
    } catch {}
  }
  doc.fontSize(16).font('Helvetica-Bold').text(opts.brand.name, opts.brand.logoPath ? 90 : 40, 40)
  doc.fontSize(10).font('Helvetica').fillColor('#666').text(opts.title)
  if (opts.subtitle) doc.text(opts.subtitle)
  doc.text(`Generated ${new Date().toLocaleString('en-ZA')}`)
  doc.moveDown(0.5)
  doc.moveTo(40, doc.y).lineTo(800, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.5)

  const widths =
    opts.colWidths ??
    opts.headers.map((h, i) =>
      Math.min(30, Math.max(h.length, ...opts.rows.slice(0, 50).map((r) => String(r[i] ?? '').length)) + 2),
    )
  const fmt = (cells: (string | number | null | undefined)[]) =>
    cells.map((c, i) => String(c ?? '').slice(0, widths[i]).padEnd(widths[i])).join(' ')

  doc.font('Courier-Bold').fontSize(8).fillColor('#000').text(fmt(opts.headers), 40)
  doc.font('Courier').text('-'.repeat(fmt(opts.headers).length))
  for (const row of opts.rows) {
    if (doc.y > 540) {
      doc.addPage()
      doc.font('Courier').fontSize(8)
    }
    doc.font('Courier').fontSize(8).text(fmt(row))
  }

  if (opts.brand.footer) {
    doc.moveDown().font('Helvetica').fontSize(8).fillColor('#888').text(opts.brand.footer)
  }

  doc.end()
  return done
}

/** Branded PDF receipt for a sale. */
export async function receiptPdf(opts: {
  brand: PdfBrand
  saleNumber: number
  dateStr: string
  locationName: string
  cashierName: string
  voided: boolean
  items: { name: string; qty: number; unitCents: number; lineCents: number }[]
  subtotalCents: number
  discountCents: number
  taxCents: number
  taxInclusive: boolean
  totalCents: number
  paymentMethod: string
  tenderedCents?: number | null
  changeCents?: number | null
  sym: string
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 30, size: [226, 800] }) // ~80mm width
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const money = (c: number) => `${opts.sym}${(c / 100).toFixed(2)}`
  const W = 226 - 60

  if (opts.brand.logoPath) {
    try {
      doc.image(opts.brand.logoPath, 83, 20, { width: 60 })
      doc.moveDown(3)
    } catch {}
  }
  doc.font('Helvetica-Bold').fontSize(11).text(opts.brand.name, { align: 'center' })
  doc.font('Helvetica').fontSize(8).text(`Receipt #${opts.saleNumber}`, { align: 'center' })
  doc.text(`${opts.dateStr} · ${opts.locationName}`, { align: 'center' })
  doc.text(`Cashier: ${opts.cashierName}`, { align: 'center' })
  if (opts.voided) doc.font('Helvetica-Bold').fontSize(10).text('*** VOIDED ***', { align: 'center' })
  doc.moveDown(0.5)
  line(doc)

  for (const it of opts.items) {
    doc.font('Helvetica').fontSize(8).text(it.name, { width: W })
    doc.text(`  ${it.qty} x ${money(it.unitCents)}`, { continued: true, width: W })
    doc.text(money(it.lineCents), { align: 'right' })
  }
  line(doc)

  const row = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8)
    doc.text(label, { continued: true, width: W })
    doc.text(value, { align: 'right' })
  }
  row('Subtotal', money(opts.subtotalCents))
  if (opts.discountCents > 0) row('Discount', `-${money(opts.discountCents)}`)
  if (opts.taxCents > 0) row(`VAT${opts.taxInclusive ? ' (incl.)' : ''}`, money(opts.taxCents))
  row('TOTAL', money(opts.totalCents), true)
  doc.moveDown(0.3)
  row(opts.paymentMethod, opts.tenderedCents != null ? money(opts.tenderedCents) : '')
  if (opts.changeCents != null && opts.changeCents > 0) row('Change', money(opts.changeCents))
  line(doc)
  if (opts.brand.footer) doc.font('Helvetica').fontSize(8).text(opts.brand.footer, { align: 'center' })

  doc.end()
  return done
}

function line(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.3)
  doc.moveTo(30, doc.y).lineTo(196, doc.y).dash(2, { space: 2 }).strokeColor('#aaa').stroke().undash()
  doc.moveDown(0.3)
}
