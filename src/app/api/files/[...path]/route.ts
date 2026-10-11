import { auth } from '@/lib/auth'
import { readStoredFile } from '@/lib/files'
import { NextResponse } from 'next/server'

/**
 * GET /api/files/<kind>/<tenantId>/<name>
 * Serves locally stored uploads. Tenant users may only read their own
 * tenant's files; SUPER_ADMIN can read any. Middleware guarantees auth.
 */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const session = await auth()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const [kind, tenantId, ...rest] = params.path
  if (!kind || !tenantId || rest.length === 0) {
    return new NextResponse('Not found', { status: 404 })
  }

  const role = (session.user as any).role
  const userTenant = (session.user as any).tenantId
  if (role !== 'SUPER_ADMIN' && userTenant !== tenantId) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const file = await readStoredFile([kind, tenantId, ...rest].join('/'))
  if (!file) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
