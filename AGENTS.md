# Epossis Inventory & POS

## Build & Dev Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build (runs `prisma generate` first)
- `npx prisma dev` — local Prisma Postgres; prints `DATABASE_URL`/`SHADOW_DATABASE_URL` (keep running in a separate terminal)
- `npx prisma generate` — regenerate client after schema changes
- `npx prisma migrate dev --name <name>` — create + apply migration
- `npm run db:seed` — seed demo tenant/catalog/users (reads `.env`)

## Environment

- `.env` holds `DATABASE_URL` (postgres:// from `prisma dev`, or any hosted Postgres) and `AUTH_SECRET`
- `db.ts` auto-selects: `prisma+postgres://` → `accelerateUrl`; `postgres://` → `PrismaPg` adapter
- Demo accounts: `admin@epossis.app`/`admin123` (platform), `manager@demo.co.za`/`admin123`, `staff@demo.co.za`/`staff123`
- Camera features (barcode scan, photo capture) need HTTPS or localhost

## Architecture rules

- **Stock invariant**: `StockLevel` may ONLY change inside `src/lib/stock.ts` `applyMovement()` within a transaction that also appends a `StockMovement` row. Never write `quantity` directly.
- **Idempotency**: every mutation path accepts `clientKey` (unique). Offline sync + retries rely on it — preserve it.
- **Tenant isolation**: every entity has `tenantId`; use `tenantScope(session)`/`assertTenantScope` from `src/lib/admin-auth.ts`. Only `SUPER_ADMIN` may cross tenants.
- Roles: `SUPER_ADMIN`→"Admin", `ADMIN`→"Manager", `STAFF`→"Staff" via `roleLabel()`.
- Money is integer cents (`*Cents`); format via `formatCents` in `src/lib/format.ts`.
- Self-registration only creates `STAFF` bound to a tenant slug; managers are created by SUPER_ADMIN or tenant admins.
- White-label: brand via `BrandStyle`/`TenantThemeInjector`/CSS vars — never hardcode names/colours. Platform fallback in `src/lib/brand.ts` (`NEXT_PUBLIC_PLATFORM_*`).
- Icons: lucide-react (no Font Awesome).

## Feature map

- Barcode scanning: `src/components/BarcodeScanner.tsx` (ZXing, camera) + `useKeyboardScanner` (USB gun wedge)
- Stock ops: receive/adjust/transfer/count in `src/app/actions/stock.ts` + `stocktakes.ts`
- Sales: `src/app/actions/sales.ts` — `completeSale` (tx: sale+items+SALE movements+decrement), `voidSale` (reversing movements)
- Alerts: computed live in `src/lib/alerts.ts` (low/out/dead stock) — nothing stored
- Analytics: `src/lib/analytics.ts` (best/slow sellers, reorder suggestions, valuation)
- Exports: `/api/export/<products|stock|movements|sales|best-sellers|slow-sellers|invoices>.<csv|xlsx|pdf>` + `/api/export/receipt/<id>`
- Files: uploads via `/api/upload` (sharp resize+thumb) → `storage/` → served tenant-checked via `/api/files/[...path]`
- Offline: `public/sw.js`, `src/lib/offline/{db,sync}.ts`, `/api/sync`, `/api/sync/catalog`, `SyncStatus` component
