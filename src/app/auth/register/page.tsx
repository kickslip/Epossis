import { getTenantThemeBySlug, getTenantIdBySlug } from '@/lib/tenant'
import { BrandStyle } from '@/components/BrandStyle'
import { BrandMark } from '@/components/BrandMark'
import { RegisterForm } from './RegisterForm'
import Link from 'next/link'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { tenant?: string }
}) {
  const slug = searchParams.tenant ?? ''
  const theme = await getTenantThemeBySlug(slug)
  const tenantId = slug ? await getTenantIdBySlug(slug) : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <BrandStyle theme={theme} />
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandMark theme={theme} />
          <p className="text-sm text-slate-500">Create a staff account</p>
        </div>
        {tenantId ? (
          <RegisterForm tenantId={tenantId} tenantSlug={slug} />
        ) : (
          <div className="text-center text-sm text-slate-500">
            <p>This registration link is missing a valid store.</p>
            <Link href="/auth/signin" className="mt-3 inline-block text-primary-600 hover:underline">
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
