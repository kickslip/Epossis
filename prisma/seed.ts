import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const url = process.env.DATABASE_URL!
const prisma = url.startsWith('prisma+postgres://')
  ? new PrismaClient({ accelerateUrl: url })
  : new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main() {
  console.log('Seeding Epossis…')

  // ── Platform super admin ────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@epossis.app' },
    update: {},
    create: {
      email: 'admin@epossis.app',
      passwordHash: await bcrypt.hash('admin123', 10),
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Super admin:', superAdmin.email)

  // ── Demo tenant ─────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Store',
      slug: 'demo',
      contactEmail: 'manager@demo.co.za',
      currency: 'ZAR',
      currencySymbol: 'R',
      taxRate: 15,
      taxInclusive: true,
      receiptFooter: 'Thank you for shopping with us!',
      defaultReorderLevel: 5,
      deadStockDays: 60,
    },
  })
  console.log('Tenant:', tenant.name)

  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.co.za' },
    update: { tenantId: tenant.id },
    create: {
      email: 'manager@demo.co.za',
      passwordHash: await bcrypt.hash('admin123', 10),
      firstName: 'Demo',
      lastName: 'Manager',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  })
  const staff = await prisma.user.upsert({
    where: { email: 'staff@demo.co.za' },
    update: { tenantId: tenant.id },
    create: {
      email: 'staff@demo.co.za',
      passwordHash: await bcrypt.hash('staff123', 10),
      firstName: 'Demo',
      lastName: 'Staff',
      role: 'STAFF',
      tenantId: tenant.id,
    },
  })
  console.log('Users:', manager.email, '/', staff.email)

  // ── Locations ───────────────────────────────────────────────────────────
  const store = await prisma.location.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Main Store' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Main Store', type: 'STORE' },
  })
  const warehouse = await prisma.location.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Backroom' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Backroom', type: 'WAREHOUSE' },
  })

  // ── Categories & suppliers ──────────────────────────────────────────────
  const catDefs = ['Beverages', 'Snacks', 'Household', 'Personal Care']
  const cats: Record<string, string> = {}
  for (const name of catDefs) {
    const c = await prisma.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    })
    cats[name] = c.id
  }

  const supDefs = [
    { name: 'Makro Wholesale', phone: '011 000 0000', email: 'orders@makro.example' },
    { name: 'Local Distributor', phone: '021 000 0000' },
  ]
  const sups: Record<string, string> = {}
  for (const s of supDefs) {
    const rec = await prisma.supplier.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: s.name } },
      update: {},
      create: { tenantId: tenant.id, ...s },
    })
    sups[s.name] = rec.id
  }

  // ── Products ────────────────────────────────────────────────────────────
  const products = [
    { name: 'Coca-Cola 330ml Can', barcode: '6009473000010', sku: 'CC-330', cat: 'Beverages', sup: 'Makro Wholesale', cost: 850, sell: 1450, reorder: 24 },
    { name: 'Sprite 330ml Can', barcode: '6009473000027', sku: 'SP-330', cat: 'Beverages', sup: 'Makro Wholesale', cost: 820, sell: 1400, reorder: 24 },
    { name: 'Still Water 500ml', barcode: '6001111222333', sku: 'WT-500', cat: 'Beverages', sup: 'Local Distributor', cost: 450, sell: 1000, reorder: 30 },
    { name: 'Simba Chips 125g', barcode: '6009510400019', sku: 'SC-125', cat: 'Snacks', sup: 'Makro Wholesale', cost: 950, sell: 1799, reorder: 20 },
    { name: 'Mageu 1L', barcode: '6001012300014', sku: 'MG-1L', cat: 'Beverages', sup: 'Local Distributor', cost: 1100, sell: 1999, reorder: 12 },
    { name: 'Sunlight Soap 175g', barcode: '6001087300011', sku: 'SS-175', cat: 'Household', sup: 'Makro Wholesale', cost: 1050, sell: 1899, reorder: 15 },
    { name: 'Omo Washing Powder 1kg', barcode: '6001087400010', sku: 'OMO-1K', cat: 'Household', sup: 'Makro Wholesale', cost: 4200, sell: 6999, reorder: 8 },
    { name: 'Colgate Toothpaste 100ml', barcode: '6001067000018', sku: 'CG-100', cat: 'Personal Care', sup: 'Local Distributor', cost: 1800, sell: 3299, reorder: 10 },
    { name: 'White Bread 700g', barcode: '6001122000016', sku: 'BR-700', cat: 'Snacks', sup: 'Local Distributor', cost: 1350, sell: 2099, reorder: 15 },
    { name: 'Full Cream Milk 1L', barcode: '6001124000014', sku: 'MK-1L', cat: 'Beverages', sup: 'Local Distributor', cost: 1650, sell: 2499, reorder: 20 },
  ]

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { tenantId_barcode: { tenantId: tenant.id, barcode: p.barcode } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: p.name,
        barcode: p.barcode,
        sku: p.sku,
        categoryId: cats[p.cat],
        supplierId: sups[p.sup],
        costPriceCents: p.cost,
        sellPriceCents: p.sell,
        reorderLevel: p.reorder,
      },
    })

    // Opening stock at Main Store — idempotent via deterministic clientKey
    const key = `seed-opening-${product.id}`
    const existing = await prisma.stockMovement.findUnique({ where: { clientKey: key } })
    if (!existing) {
      const qty = 20 + Math.floor(Math.random() * 60)
      await prisma.$transaction(async (tx) => {
        const level = await tx.stockLevel.upsert({
          where: { productId_locationId: { productId: product.id, locationId: store.id } },
          create: { tenantId: tenant.id, productId: product.id, locationId: store.id, quantity: qty },
          update: { quantity: { increment: qty } },
        })
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            locationId: store.id,
            type: 'RESTOCK',
            qtyDelta: qty,
            qtyAfter: level.quantity,
            unitCostCents: p.cost,
            note: 'Opening stock (seed)',
            userId: manager.id,
            clientKey: key,
          },
        })
      })
    }
  }
  console.log(`Products: ${products.length} seeded with opening stock`)

  console.log('\nDone. Sign in:')
  console.log('  Platform admin : admin@epossis.app / admin123')
  console.log('  Store manager  : manager@demo.co.za / admin123')
  console.log('  Staff          : staff@demo.co.za / staff123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
