import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL!

function createClient(): PrismaClient {
  // `prisma dev` local Postgres uses the prisma+postgres:// protocol which the
  // client handles natively; plain postgres:// URLs go through the pg adapter.
  if (connectionString?.startsWith('prisma+postgres://')) {
    return new PrismaClient({ accelerateUrl: connectionString })
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
