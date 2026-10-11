import { getTenantThemeBySlug, getTenantTheme } from '@/lib/tenant'
import { BrandStyle } from '@/components/BrandStyle'
import { BrandMark } from '@/components/BrandMark'
import { SignInForm } from './SignInForm'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { tenant?: string; callbackUrl?: string }
}) {
  const theme = searchParams.tenant
    ? await getTenantThemeBySlug(searchParams.tenant)
    : await getTenantTheme()

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <BrandStyle theme={theme} />
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandMark theme={theme} />
          <p className="text-sm text-slate-500">Sign in to your account</p>
        </div>
        <SignInForm tenantSlug={searchParams.tenant} callbackUrl={searchParams.callbackUrl} />
      </div>
    </main>
  )
}
