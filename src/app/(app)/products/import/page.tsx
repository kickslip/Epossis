import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CsvImport } from './CsvImport'

export default async function ImportPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')
  if ((session.user as any).role === 'STAFF') redirect('/products')
  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-1 text-lg font-semibold">Import products (CSV)</h1>
      <p className="mb-3 text-xs text-slate-500">
        Columns: <code>name, barcode, sku, category, supplier, cost, sell, reorderLevel</code>.
        Rows are matched on barcode → SKU → name and updated if they already exist.
      </p>
      <CsvImport />
    </div>
  )
}
