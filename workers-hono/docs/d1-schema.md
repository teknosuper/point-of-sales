# D1 Schema

Kembali ke indeks dokumentasi: `docs/README.md`

Dokumen ini menjelaskan fondasi schema D1 awal untuk versi `POINZA Workers + Hono`.

## File

- `db/migrations/0001_initial.sql`
- `db/seeds/0001_demo_seed.sql`

## Fokus Schema Awal

Schema awal ini sengaja memprioritaskan:

1. multi outlet
2. kitchen stations per outlet
3. mapping product ke station dapur
4. transaksi dan item transaksi
5. kitchen tickets per station
6. audit log dasar

## Aggregate yang Sudah Dicakup

- `outlets`
- `users`
- `user_outlets`
- `roles`
- `permissions`
- `user_outlet_roles`
- `products`
- `product_outlet_stocks`
- `kitchen_stations`
- `kitchen_station_devices`
- `product_station_mappings`
- `cashier_shifts`
- `transactions`
- `transaction_items`
- `kitchen_tickets`
- `kitchen_ticket_items`
- `kitchen_ticket_events`
- `audit_logs`

## Seed Demo

Seed demo menyiapkan:

- 1 outlet utama: `outlet-main`
- 8 kitchen stations:
  - `minuman`
  - `mie`
  - `ayam`
  - `ramen`
  - `steak`
  - `es-duren`
  - `sate`
  - `salad`
- sample device untuk beberapa station
- sample product dan mapping ke station

## Arah Evolusi Berikutnya

Setelah schema awal ini, langkah yang sehat adalah:

1. tambah tabel `customers`
2. tambah `receivables` dan `payables`
3. tambah `pricing_rules` dan `loyalty`
4. tambah `inventory mutations`
5. ubah repository in-memory ke repository D1 nyata
