'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerStaff } from '@/app/actions/auth'

const inputCls =
  'rounded-lg border px-3 py-2 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100'

export function RegisterForm({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await registerStaff({
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      email: fd.get('email'),
      password: fd.get('password'),
      tenantId,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else router.push(`/auth/signin?tenant=${tenantSlug}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">First name</span>
          <input name="firstName" required className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Last name</span>
          <input name="lastName" required className={inputCls} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Email</span>
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Password</span>
        <input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}
