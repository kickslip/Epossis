import * as XLSX from 'xlsx'

/** Build an .xlsx buffer from headers + rows (SheetJS, fully local). */
export function toXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): Buffer {
  const aoa = [headers, ...rows.map((r) => r.map((v) => v ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // Reasonable column widths
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(40, Math.max(h.length + 2, ...rows.map((r) => String(r[i] ?? '').length + 2))),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
