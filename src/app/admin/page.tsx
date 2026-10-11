import { requireSuperAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export default async function AdminPage() {
  await requireSuperAdmin()

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, products: true, sales: true } },
    },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tenants</h1>
        <Link href="/admin/tenants/new" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">
          + New tenant
        </Link>
      </div>

      <div className="divide-y rounded-xl border bg-white">
        {tenants.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No tenants yet.</p>}
        {tenants.map((t) => (
          <Link key={t.id} href={`/admin/tenants/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg" style={{ backgroundColor: t.primaryColor }} />
              <div>
                <p className="text-sm font-medium">
                  {t.name}
                  {!t.isActive && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">inactive</span>}
                </p>
                <p className="text-xs text-slate-400">/{t.slug}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              {t._count.users} users · {t._count.products} products · {t._count.sales} sales
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
