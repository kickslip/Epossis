import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Sign-in problem</h1>
        <p className="mt-2 text-sm text-slate-500">
          Something went wrong while signing you in. Please try again.
        </p>
        <Link href="/auth/signin" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
