import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { z } from 'zod'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantId: z.string().optional(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant ID', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const parsed = credentialsSchema.parse(credentials)

          const user = await prisma.user.findUnique({
            where: { email: parsed.email },
          })

          if (!user || !user.passwordHash || !user.isActive) return null

          const isValid = await bcrypt.compare(parsed.password, user.passwordHash)
          if (!isValid) return null

          if (parsed.tenantId && user.tenantId !== parsed.tenantId) return null

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            tenantId: user.tenantId,
            image: user.avatarUrl,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.tenantId = (user as any).tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).tenantId = token.tenantId
      }
      return session
    },
  },
})
