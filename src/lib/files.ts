import path from 'path'
import fs from 'fs/promises'
import { prisma } from '@/lib/db'

/**
 * File storage for uploaded images/docs (product photos, invoice scans,
 * tenant logos). Files are stored as `StoredFile` rows in Postgres —
 * served through /api/files/<id> and /api/files/<id>/thumb — so uploads
 * survive serverless/ephemeral deployments. A disk fallback under
 * storage/ remains for files uploaded before this change.
 */
const STORAGE_ROOT = path.join(process.cwd(), 'storage')

export type FileKind = 'products' | 'invoices' | 'branding'

export async function saveFile(
  kind: FileKind,
  tenantId: string,
  data: Buffer,
  mimeType: string,
  filename = 'file',
): Promise<string> {
  const row = await prisma.storedFile.create({
    data: { tenantId, kind, filename, mimeType, data: new Uint8Array(data) },
  })
  return `/api/files/${row.id}`
}

export async function saveFileWithThumb(
  kind: FileKind,
  tenantId: string,
  data: Buffer,
  mimeType: string,
  filename: string,
  thumbnail: Buffer,
  thumbMime: string,
): Promise<{ url: string; thumbnailUrl: string }> {
  const row = await prisma.storedFile.create({
    data: {
      tenantId,
      kind,
      filename,
      mimeType,
      data: new Uint8Array(data),
      thumbnail: new Uint8Array(thumbnail),
      thumbMime,
    },
  })
  return { url: `/api/files/${row.id}`, thumbnailUrl: `/api/files/${row.id}/thumb` }
}

export async function readStoredFile(
  relPath: string,
): Promise<{ data: Buffer; mimeType: string; tenantId: string; kind: string } | null> {
  const segments = relPath.replace(/^\/+/, '').split('/')
  // DB format: <id> or <id>/thumb
  if (segments.length <= 2) {
    const row = await prisma.storedFile.findUnique({ where: { id: segments[0] } })
    if (row) {
      if (segments[1] === 'thumb' && row.thumbnail) {
        return {
          data: Buffer.from(row.thumbnail),
          mimeType: row.thumbMime ?? 'image/jpeg',
          tenantId: row.tenantId,
          kind: row.kind,
        }
      }
      return { data: Buffer.from(row.data), mimeType: row.mimeType, tenantId: row.tenantId, kind: row.kind }
    }
  }
  // Legacy disk format: <kind>/<tenantId>/<name>.<ext>
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
    const tenantId = clean.split('/')[1] ?? ''
    return { data, mimeType: mime, tenantId, kind: clean.split('/')[0] ?? '' }
  } catch {
    return null
  }
}

export async function deleteStoredFile(urlPath: string) {
  const rel = urlPath.replace(/^\/api\/files\//, '')
  const segments = rel.split('/')
  if (segments.length <= 2) {
    await prisma.storedFile.delete({ where: { id: segments[0] } }).catch(() => {})
    return
  }
  const abs = path.join(STORAGE_ROOT, rel.replace(/\.\./g, ''))
  if (!abs.startsWith(STORAGE_ROOT)) return
  await fs.unlink(abs).catch(() => {})
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8MB
