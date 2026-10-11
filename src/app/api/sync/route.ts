import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { completeSale } from '@/app/actions/sales'
import { receiveStock, adjustStock } from '@/app/actions/stock'

type Op = { clientKey: string; kind: 'sale' | 'receive' | 'adjust'; payload: Record<string, unknown> }

/**
 * POST /api/sync — drains the client's IndexedDB outbox.
 * Each op is applied via the same validated server actions used online;
 * clientKey idempotency makes retries safe. Returns per-op results.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let ops: Op[]
  try {
    const body = await req.json()
    ops = body.ops
    if (!Array.isArray(ops)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (ops.length > 200) return NextResponse.json({ error: 'Too many ops' }, { status: 400 })

  const results: { clientKey: string; ok: boolean; error?: string }[] = []
  for (const op of ops) {
    if (!op?.clientKey || !op?.kind) {
      results.push({ clientKey: op?.clientKey ?? '?', ok: false, error: 'Malformed op' })
      continue
    }
    try {
      let res: { error?: string }
      if (op.kind === 'sale') {
        res = await completeSale({ ...op.payload, clientKey: op.clientKey, offlineCreated: true })
      } else if (op.kind === 'receive') {
        res = await receiveStock({ ...op.payload, clientKey: op.clientKey })
      } else if (op.kind === 'adjust') {
        res = await adjustStock({ ...op.payload, clientKey: op.clientKey })
      } else {
        res = { error: `Unknown kind ${op.kind}` }
      }
      results.push({ clientKey: op.clientKey, ok: !res.error, error: res.error })
    } catch (e: any) {
      results.push({ clientKey: op.clientKey, ok: false, error: e.message?.slice(0, 120) })
    }
  }

  return NextResponse.json({ results })
}
