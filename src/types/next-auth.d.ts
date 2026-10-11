import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: string
      tenantId?: string | null
    } & DefaultSession['user']
  }

  interface User {
    role?: string
    tenantId?: string | null
  }
}
