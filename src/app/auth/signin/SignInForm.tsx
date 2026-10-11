'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function SignInForm({ tenantSlug, callbackUrl }: { tenantSlug?: string; callbackUrl?: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await signIn('credentials', {
        email: fd.get('email'),
        password: fd.get('password'),
        redirect: false,
      })
      if (res?.error) {
        setError('Invalid email or password')
      } else {
        router.push(callbackUrl || '/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-lg border px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {tenantSlug && (
        <p className="text-center text-xs text-slate-400">
          Staff member?{' '}
          <a href={`/auth/register?tenant=${tenantSlug}`} className="text-primary-600 hover:underline">
            Create an account
          </a>
        </p>
      )}
    </form>
  )
}
