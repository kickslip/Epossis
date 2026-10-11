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

## Deploy (Vercel + hosted Postgres)

1. **Database** — any hosted Postgres works (Neon, Vercel Postgres, Railway,
   Supabase). Create one and copy the `postgres://…` connection string.
2. **Import** — vercel.com → Add New → Project → import `kickslip/Epossis`.
3. **Env vars** on the project:
   - `DATABASE_URL` = your `postgres://…` string
   - `AUTH_SECRET` = any long random string (`openssl rand -hex 32`)
   - `AUTH_URL` = `https://<your-app>.vercel.app`
   - `NEXT_PUBLIC_PLATFORM_NAME` = `Epossis` (or your white-label brand)
4. **Deploy.** Then, from this repo on your machine:
   ```bash
   DATABASE_URL="postgres://…prod…" npx prisma migrate deploy
   DATABASE_URL="postgres://…prod…" npm run db:seed   # optional demo data
   ```
5. **PWA** — open the site on your phone → browser menu → "Add to Home
   Screen" (or tap the Install app button on the landing/More page). Camera
   scanning works because Vercel serves HTTPS.

CLI alternative: run `npx vercel login` once, then `npx vercel --yes` +
`npx vercel env add …` + `npx vercel deploy --prod`.

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
