import { auth } from '@/lib/auth'
import { readStoredFile } from '@/lib/files'
import { NextResponse } from 'next/server'

/**
 * GET /api/files/<id>[ /thumb]          — DB-stored upload
 * GET /api/files/<kind>/<tenantId>/<name> — legacy disk-stored upload
 *
 * Branding files are public (tenant logos need to render on sign-in
 * pages before authentication). Other kinds require the same tenant
 * (or SUPER_ADMIN). Middleware guarantees auth for the API; the public
 * branding exception is enforced here.
 */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const file = await readStoredFile(params.path.join('/'))
  if (!file) return new NextResponse('Not found', { status: 404 })

  if (file.kind !== 'branding') {
    const session = await auth()
    if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })
    const role = (session.user as any).role
    const userTenant = (session.user as any).tenantId
    if (role !== 'SUPER_ADMIN' && userTenant !== file.tenantId) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': file.kind === 'branding' ? 'public, max-age=3600' : 'private, max-age=3600',
    },
  })
}
