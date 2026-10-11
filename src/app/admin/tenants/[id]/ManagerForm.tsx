'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTenantManager } from '@/app/actions/admin'

const input = 'rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'

export function ManagerForm({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-primary-600">
        + Add manager
      </button>
    )
  }

  return (
    <form
      className="grid grid-cols-2 gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        const fd = new FormData(e.currentTarget)
        const res = await createTenantManager({
          tenantId,
          firstName: String(fd.get('firstName')),
          lastName: String(fd.get('lastName')),
          email: String(fd.get('email')),
          password: String(fd.get('password')),
        })
        if (res.error) setError(res.error)
        else {
          setOpen(false)
          router.refresh()
        }
      }}
    >
      <input name="firstName" required placeholder="First name" className={input} />
      <input name="lastName" required placeholder="Last name" className={input} />
      <input name="email" type="email" required placeholder="Email" className={input} />
      <input name="password" type="password" required minLength={6} placeholder="Password" className={input} />
      <div className="col-span-2 flex gap-2">
        <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">Create manager</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
      </div>
      {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}
