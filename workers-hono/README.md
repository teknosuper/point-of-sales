# POINZA Workers Hono

Folder ini adalah scaffold awal untuk versi `Cloudflare Workers + Hono` dari aplikasi POINZA.

## Tujuan

Versi ini dipisahkan dari aplikasi Laravel utama agar migrasi bisa dilakukan bertahap, bukan rewrite besar sekaligus.

## Stack

- Cloudflare Workers
- Hono
- TypeScript
- Wrangler

## Struktur Awal

- `src/index.ts` — entry point Hono
- `wrangler.toml` — konfigurasi Workers
- `package.json` — dependency dan scripts
- `tsconfig.json` — konfigurasi TypeScript
- `docs/system-map.md` — peta sistem target
- `docs/coding-standard.md` — standar implementasi
- `docs/d1-schema.md` — fondasi schema database D1

## Database

Schema awal D1 tersedia di:

- `db/migrations/0001_initial.sql`
- `db/seeds/0001_demo_seed.sql`

## Menjalankan

```bash
cd workers-hono
npm install
npm run dev
```

## Endpoint Awal

- `GET /`
- `GET /health`
- `GET /api`

## Arah Migrasi yang Disarankan

### Phase 1

- auth strategy untuk Workers
- route products
- route customers
- route transactions read-only

### Phase 2

- cart dan checkout
- inventory mutation
- cashier shift
- receivable dan payable

### Phase 3

- reports
- pricing engine
- loyalty
- webhook payments

## Catatan Arsitektur

Untuk versi Workers, sebaiknya domain model lama tidak dipindahkan 1:1 ke pola Laravel controller.

Boundary yang lebih sehat:

- `src/modules/auth`
- `src/modules/catalog`
- `src/modules/transactions`
- `src/modules/inventory`
- `src/modules/customers`
- `src/modules/reports`
- `src/modules/payments`

## Next Step yang Masuk Akal

1. Tentukan storage layer Workers.
2. Buat route module `products`.
3. Definisikan kontrak auth dan session.
4. Buat adapter data untuk transaksi POS.

Storage layer yang umum dipertimbangkan:

- D1 untuk relational data
- R2 untuk file dan image
- KV untuk cache ringan
- Durable Objects jika nanti perlu session atau locking tertentu
