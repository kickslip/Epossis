'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  upsertLocation,
  upsertCategory,
  deleteCategory,
  upsertSupplier,
  upsertStaffUser,
  setUserActive,
} from '@/app/actions/admin'

const input = 'rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500'

export function OrgManager({
  locations,
  categories,
  suppliers,
  users,
}: {
  locations: { id: string; name: string; type: string; isActive: boolean }[]
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string; phone: string | null; email: string | null }[]
  users: { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean }[]
}) {
  return (
    <div className="space-y-6">
      <LocationsSection locations={locations} />
      <CategoriesSection categories={categories} />
      <SuppliersSection suppliers={suppliers} />
      <UsersSection users={users} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function LocationsSection({ locations }: { locations: any[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  return (
    <Section title="Locations (shops / warehouses)">
      <div className="mb-3 divide-y">
        {locations.map((l) => (
          <div key={l.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              {l.name}{' '}
              <span className="text-xs text-slate-400">{l.type === 'WAREHOUSE' ? 'Warehouse' : 'Store'}</span>
            </span>
          </div>
        ))}
      </div>
      {open ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const res = await upsertLocation({
              name: String(fd.get('name')),
              type: fd.get('type') as 'STORE' | 'WAREHOUSE',
              address: String(fd.get('address') || ''),
            })
            if (res.error) setError(res.error)
            else {
              setOpen(false)
              setError('')
              router.refresh()
            }
          }}
        >
          <input name="name" required placeholder="Name" className={input} />
          <select name="type" className={input}>
            <option value="STORE">Store</option>
            <option value="WAREHOUSE">Warehouse</option>
          </select>
          <input name="address" placeholder="Address (optional)" className={input} />
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">Add</button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="text-sm text-primary-600">+ Add location</button>
      )}
    </Section>
  )
}

function CategoriesSection({ categories }: { categories: any[] }) {
  const router = useRouter()
  const [name, setName] = useState('')

  return (
    <Section title="Categories">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
            {c.name}
            <button onClick={async () => { await deleteCategory(c.id); router.refresh() }} className="text-slate-400 hover:text-red-500">✕</button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await upsertCategory({ name: name.trim() })
          setName('')
          router.refresh()
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className={input} />
        <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">Add</button>
      </form>
    </Section>
  )
}

function SuppliersSection({ suppliers }: { suppliers: any[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <Section title="Suppliers">
      <div className="mb-3 divide-y">
        {suppliers.map((s) => (
          <div key={s.id} className="py-2 text-sm">
            <span className="font-medium">{s.name}</span>
            <span className="ml-2 text-xs text-slate-400">{[s.phone, s.email].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
      </div>
      {open ? (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            await upsertSupplier({
              name: String(fd.get('name')),
              contactName: String(fd.get('contactName') || ''),
              phone: String(fd.get('phone') || ''),
              email: String(fd.get('email') || ''),
            })
            setOpen(false)
            router.refresh()
          }}
        >
          <input name="name" required placeholder="Name *" className={input} />
          <input name="contactName" placeholder="Contact person" className={input} />
          <input name="phone" placeholder="Phone" className={input} />
          <input name="email" placeholder="Email" className={input} />
          <div className="col-span-2 flex gap-2">
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">Add supplier</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="text-sm text-primary-600">+ Add supplier</button>
      )}
    </Section>
  )
}

function UsersSection({ users }: { users: any[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  return (
    <Section title="Team">
      <div className="mb-3 divide-y">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium">{u.firstName} {u.lastName}</span>
              <span className="ml-2 text-xs text-slate-400">
                {u.email} · {u.role === 'ADMIN' ? 'Manager' : 'Staff'}
                {!u.isActive && ' · inactive'}
              </span>
            </div>
            <button
              onClick={async () => { await setUserActive(u.id, !u.isActive); router.refresh() }}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              {u.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
      {open ? (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            const fd = new FormData(e.currentTarget)
            const res = await upsertStaffUser({
              firstName: String(fd.get('firstName')),
              lastName: String(fd.get('lastName')),
              email: String(fd.get('email')),
              password: String(fd.get('password')),
              role: fd.get('role') as 'ADMIN' | 'STAFF',
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
          <select name="role" className={input}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Manager</option>
          </select>
          <div className="flex gap-2">
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">Add</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
          {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="text-sm text-primary-600">+ Add team member</button>
      )}
    </Section>
  )
}
