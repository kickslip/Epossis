import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

/**
 * Local file storage for uploaded images (product photos, invoice scans,
 * tenant logos). Files live under storage/<kind>/<tenantId>/<name>.<ext>
 * and are served through /api/files/[...path] which enforces auth +
 * tenant isolation.
 */
const STORAGE_ROOT = path.join(process.cwd(), 'storage')

export type FileKind = 'products' | 'invoices' | 'branding'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export async function saveFile(
  kind: FileKind,
  tenantId: string,
  data: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = EXT_BY_MIME[mimeType] ?? 'bin'
  const name = `${randomUUID()}.${ext}`
  const dir = path.join(STORAGE_ROOT, kind, tenantId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, name), data)
  // URL path — the API route resolves it back to disk
  return `/api/files/${kind}/${tenantId}/${name}`
}

export async function readStoredFile(relPath: string): Promise<{ data: Buffer; mimeType: string } | null> {
  // relPath like products/<tenant>/<name>.jpg — prevent traversal
  const clean = relPath.replace(/\.\./g, '').replace(/^\/+/, '')
  const abs = path.join(STORAGE_ROOT, clean)
  if (!abs.startsWith(STORAGE_ROOT)) return null
  try {
    const data = await fs.readFile(abs)
    const ext = path.extname(abs).slice(1).toLowerCase()
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
      : ext === 'pdf' ? 'application/pdf'
      : 'application/octet-stream'
    return { data, mimeType: mime }
  } catch {
    return null
  }
}

export async function deleteStoredFile(urlPath: string) {
  // urlPath like /api/files/products/<tenant>/<name>
  const rel = urlPath.replace(/^\/api\/files\//, '')
  const abs = path.join(STORAGE_ROOT, rel.replace(/\.\./g, ''))
  if (!abs.startsWith(STORAGE_ROOT)) return
  await fs.unlink(abs).catch(() => {})
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8MB
