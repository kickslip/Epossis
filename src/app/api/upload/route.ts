import { auth } from '@/lib/auth'
import { saveFile, saveFileWithThumb, MAX_UPLOAD_BYTES, type FileKind } from '@/lib/files'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

const KINDS: FileKind[] = ['products', 'invoices', 'branding']

/**
 * POST /api/upload  (multipart form-data: kind, file, [tenantId])
 * - products/branding: image → resized ≤1600px + 400px thumbnail
 * - invoices: image or PDF stored as-is (images also get a thumbnail)
 * Returns { url, thumbnailUrl? }.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const kind = form.get('kind') as FileKind
  const file = form.get('file') as File | null
  const requestedTenant = form.get('tenantId') as string | null

  if (!KINDS.includes(kind) || !file) {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }

  const role = (session.user as any).role
  const sessionTenant = (session.user as any).tenantId as string | undefined
  const tenantId =
    role === 'SUPER_ADMIN' && requestedTenant ? requestedTenant : sessionTenant
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  if (role !== 'SUPER_ADMIN' && requestedTenant && requestedTenant !== sessionTenant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (kind === 'branding' && role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 413 })
  }

  const mime = file.type || 'application/octet-stream'

  try {
    if (mime.startsWith('image/')) {
      const optimized = await sharp(bytes)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
      const thumb = await sharp(bytes)
        .rotate()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78 })
        .toBuffer()
      const { url, thumbnailUrl } = await saveFileWithThumb(
        kind,
        tenantId,
        optimized,
        'image/jpeg',
        file.name,
        thumb,
        'image/jpeg',
      )
      return NextResponse.json({ url, thumbnailUrl })
    }
    if (mime === 'application/pdf' && kind === 'invoices') {
      const url = await saveFile(kind, tenantId, bytes, mime, file.name)
      return NextResponse.json({ url })
    }
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  } catch (e) {
    console.error('[upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
