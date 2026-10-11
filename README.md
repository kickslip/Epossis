# Epossis

Mobile-first inventory + point-of-sale SaaS. Scan barcodes with a phone camera,
manage stock across locations, sell at the till — online or offline.

## Stack

- **Next.js 14** (App Router) + TypeScript strict + Tailwind CSS
- **Prisma 7 + PostgreSQL** (`@prisma/adapter-pg`, or local `prisma dev` Postgres)
- **NextAuth v5** — JWT sessions, credentials provider
- **@zxing/browser** — client-side barcode decode (EAN/UPC/Code128/QR), no API
- **idb** — IndexedDB outbox for offline sync; hand-rolled `public/sw.js` PWA
- **xlsx / pdfkit / jsbarcode / sharp** — exports, label printing, image processing
- No third-party service APIs anywhere — everything runs in-process.

## Run it

```bash
npm install
npx prisma dev            # local Postgres (prints DATABASE_URL) — keep running
npm run db:migrate        # first time: creates schema
npm run db:seed           # demo tenant + catalog + users
npm run dev               # http://localhost:3000
```

`.env` needs `DATABASE_URL` (the `prisma dev` output works directly) and `AUTH_SECRET`.

### Demo accounts (after seeding)

| Role | Login | Password |
|---|---|---|
| Platform admin | `admin@epossis.app` | `admin123` |
| Store manager (Demo Store) | `manager@demo.co.za` | `admin123` |
| Staff | `staff@demo.co.za` | `staff123` |

Branded sign-in/registration: `/auth/signin?tenant=demo` and `/auth/register?tenant=demo`.

## How it's organised

- `src/app/(app)/` — tenant app: `dashboard`, `scan`, `pos`, `products`, `stock`
  (receive/adjust/transfer/count), `sales`, `invoices`, `alerts`, `reports`,
  `settings`, `more`
- `src/app/admin/` — platform console (SUPER_ADMIN): tenants + branding + managers
- `src/app/actions/` — server actions, all tenant-scoped via `tenantScope`/`assertTenantScope`
- `src/app/api/` — auth, upload, files, export (`<resource>.<csv|xlsx|pdf>`), sync
- `src/lib/stock.ts` — **the only path that mutates stock**: `StockLevel` +
  `StockMovement` ledger written in one transaction, delta-based so
  offline-queued ops apply in any order
- `src/lib/offline/` — IndexedDB outbox + catalog cache + sync engine
- `src/components/BarcodeScanner.tsx` — camera scanner + hardware
  keyboard-wedge listener

## Offline design

Sales/adjustments captured offline go into an IndexedDB outbox with a client
UUID (`clientKey`). `/api/sync` drains the queue through the same server actions;
the unique `clientKey` constraint makes retries and double-taps idempotent.
Product catalog is snapshotted to IndexedDB for offline scan/search.

## Roles

- `SUPER_ADMIN` — platform operator; manages tenants at `/admin` (label: "Admin")
- `ADMIN` — tenant manager; settings, users, prices, voids (label: "Manager")
- `STAFF` — cashier/stocker; scan, sell, receive, adjust, count (label: "Staff")
