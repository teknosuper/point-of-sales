# System Map

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Dokumen ini adalah peta kerja developer untuk versi `POINZA Cloudflare Workers + Hono`. Fokusnya sama dengan peta sistem repo utama, tetapi dengan tiga perbedaan mendasar:

1. runtime utama adalah `Cloudflare Workers`, bukan Laravel,
2. boundary backend dibangun per modul Hono, bukan controller monolith,
3. `multi outlet` adalah requirement inti, bukan roadmap lanjutan.

Dokumen ini membantu tim menjawab empat hal dengan cepat:

1. sistem target terdiri dari modul apa saja,
2. boundary kode, data, dan runtime tiap modul ada di mana,
3. milestone implementasi paling masuk akal apa,
4. bagaimana multi outlet memengaruhi semua keputusan arsitektur.

## Snapshot Sistem

### Stack

- Runtime: Cloudflare Workers
- Framework: Hono
- Language: TypeScript
- Dev tooling: Wrangler
- Data layer target:
  - D1 untuk data relasional
  - R2 untuk file dan image
  - KV untuk cache ringan
  - Durable Objects bila perlu locking atau coordination state

### Karakter Sistem Target

Versi Workers ini bukan landing page atau microservice kecil. Targetnya tetap sistem operasional retail yang mencakup:

- front-office penjualan,
- kitchen routing per kategori produksi,
- kontrol shift kasir,
- inventory audit dan mutation trail,
- receivable dan payable lifecycle,
- procurement dasar,
- loyalty, voucher, dan pricing engine,
- CRM segmentasi dan campaign reminder,
- audit trail dan security hardening,
- multi outlet sebagai boundary data utama.

Artinya, desain Workers tidak boleh dibuat seolah hanya memindahkan endpoint POS sederhana.

## Sumber Kebenaran Utama

Karena proyek ini masih dalam fase scaffold, sumber kebenaran untuk versi Workers harus diprioritaskan sebagai berikut:

1. `workers-hono/docs/system-map.md`
2. `workers-hono/docs/coding-standard.md`
3. `workers-hono/src/`
4. repo Laravel utama sebagai referensi domain bisnis
5. `docs/system-map.md` pada repo utama untuk parity fitur

Catatan:

- repo Laravel utama adalah referensi domain, bukan template implementasi 1:1,
- untuk Workers, desain modul dan storage boleh berbeda selama kontrak bisnis tetap setara atau lebih baik.

## Peta Arsitektur

### Layer Backend

| Layer | Lokasi target | Peran |
| --- | --- | --- |
| Worker entry | `src/index.ts` | Bootstrapping app dan mounting route modules |
| Route modules | `src/modules/*/routes.ts` | HTTP surface, routing, validation boundary, response contract |
| Application services | `src/modules/*/service.ts` | Workflow bisnis lintas repository atau lintas aggregate |
| Repositories | `src/modules/*/repository.ts` | Akses D1 dan query domain |
| Policies/guards | `src/shared/auth`, `src/shared/middleware` | Auth, outlet scoping, permission, step-up, audit context |
| Schemas | `src/modules/*/schema.ts` | Validasi request/response |
| DTO/serializers | `src/modules/*/dto.ts` | Contract output ke client atau API consumer |
| Infrastructure adapters | `src/shared/db`, `src/shared/cache`, `src/shared/storage` | D1, KV, R2, external gateway, env binding |

### Layer Frontend

Untuk versi Workers, ada dua kemungkinan deployment:

1. Workers dipakai sebagai backend API untuk frontend terpisah.
2. Workers melayani UI tertentu secara langsung.

Dokumen ini mengasumsikan minimal ada contract backend yang stabil untuk dikonsumsi frontend POS, dashboard, atau mobile layer.

### Cross-Cutting Concerns

| Concern | Desain target |
| --- | --- |
| Auth | session/token strategy yang kompatibel dengan Workers |
| Authorization | permission + outlet scope wajib di route boundary |
| Active outlet | setiap request bisnis harus punya `activeOutletId` yang tervalidasi |
| Active shift | operasi POS mutasi data wajib shift aktif pada outlet aktif |
| Kitchen routing | item transaksi harus diarahkan ke dapur atau station yang tepat |
| Multi outlet | semua aggregate operasional terikat outlet |
| Auditability | event penting wajib membentuk audit trail |
| Idempotency | payment webhook, share campaign, dan retry mutation harus aman |
| Observability | request logs, audit logs, error logs, correlation id |

## Kitchen Routing sebagai Boundary Inti

### Use Case Dasar

Sistem harus mendukung pola seperti ini:

- ada pembeli,
- kasir memilih item pesanan di POS,
- satu outlet punya banyak dapur atau production station,
- setiap dapur punya layar atau printer sendiri,
- hanya dapur yang relevan yang menerima item yang menjadi tanggung jawabnya.

Contoh:

- satu outlet punya 8 station: `minuman`, `mie`, `ayam`, `ramen`, `steak`, `es duren`, `sate`, `salad`
- pembeli dengan nota `1` memesan:
  - `ayam pedas 1`
  - `ayam bakar 2`
  - `minuman es 2`
  - `minuman anget 3`
  - `salad 5`

Hasil yang wajib terjadi:

- station `minuman` hanya menerima:
  - `minuman es 2`
  - `minuman anget 3`
- station `ayam` hanya menerima:
  - `ayam pedas 1`
  - `ayam bakar 2`
- station `salad` hanya menerima:
  - `salad 5`
- station lain tidak menerima notifikasi untuk nota `1`

### Prinsip Dasar

- Routing dilakukan per item, bukan hanya per nota.
- Satu transaksi dapat dipecah ke banyak kitchen station.
- Kitchen station bersifat outlet-bound.
- Printer dan layar dapur adalah target delivery dari kitchen ticket.
- Kitchen ticket harus idempotent dan tidak boleh dobel print atau dobel notify tanpa alasan.

### Aggregate Kitchen yang Disarankan

| Aggregate | Scope |
| --- | --- |
| kitchen_stations | wajib `outlet_id` |
| kitchen_station_devices | wajib `outlet_id` dan `station_id` |
| product_station_mappings | global + override outlet atau langsung outlet-bound |
| kitchen_tickets | wajib `outlet_id`, `transaction_id`, `station_id` |
| kitchen_ticket_items | ikut parent ticket |
| kitchen_ticket_events | audit event untuk dispatch, print, acknowledge, ready, retry |

### Aturan Routing

1. Setiap product yang membutuhkan proses dapur harus terhubung ke satu `station_id`.
2. Product yang tidak butuh dapur boleh ditandai `no_station`.
3. Saat checkout sukses, sistem membagi `transaction_items` berdasarkan `station_id`.
4. Untuk setiap `station_id`, sistem membuat satu `kitchen_ticket`.
5. Setiap `kitchen_ticket` hanya berisi item milik station tersebut.
6. Delivery ke printer atau layar dilakukan berdasarkan device aktif milik station pada outlet itu.
7. Retry pengiriman harus aman dan tidak membuat ticket duplikat.

## Multi Outlet sebagai Boundary Inti

### Prinsip Dasar

- Semua data operasional harus scoped ke outlet.
- User bisa punya satu atau banyak outlet.
- Outlet aktif harus eksplisit di setiap request bisnis.
- Tidak boleh ada query operasional yang diam-diam lintas outlet.
- Laporan global harus opt-in, bukan default.

### Aggregate yang Wajib Mengenal Outlet

| Aggregate | Outlet scope |
| --- | --- |
| carts | wajib `outlet_id` |
| transactions | wajib `outlet_id` |
| transaction_details | ikut parent transaction |
| cashier_shifts | wajib `outlet_id` |
| stock_mutations | wajib `outlet_id` |
| stock_opnames | wajib `outlet_id` |
| receivables | wajib `outlet_id` |
| payables | wajib `outlet_id` |
| purchase_orders | wajib `outlet_id` |
| goods_receivings | wajib `outlet_id` |
| supplier_returns | wajib `outlet_id` |
| sales_returns | wajib `outlet_id` |
| audit_logs | wajib `outlet_id` bila event terkait outlet |
| bank_accounts | sebaiknya `outlet_id` atau global + mapping |
| settings | gunakan `outlet_settings` |

### Aggregate yang Bisa Global atau Hybrid

| Aggregate | Strategi disarankan |
| --- | --- |
| products | global catalog |
| categories | global atau outlet-bound sesuai kebutuhan bisnis |
| customers | global customer master + relasi activity per outlet |
| suppliers | global supplier master |
| pricing rules | global dengan optional outlet targeting |
| loyalty | global customer account, tetapi transaksi sumber tetap per outlet |

### Model Data Multi Outlet yang Disarankan

#### Master

- `outlets`
- `users`
- `user_outlets`
- `roles`
- `permissions`
- `user_outlet_roles`

#### Commerce

- `products`
- `product_outlet_stocks`
- `transactions`
- `transaction_items`
- `carts`
- `pricing_rules`
- `pricing_rule_outlets`
- `product_station_mappings`

#### Inventory

- `stock_mutations`
- `stock_opnames`
- `stock_opname_items`
- `goods_receivings`
- `supplier_returns`

#### Finance

- `receivables`
- `receivable_payments`
- `payables`
- `payable_payments`

#### CRM

- `customer_segments`
- `customer_segment_memberships`
- `customer_campaigns`
- `customer_campaign_logs`

#### Config

- `outlet_settings`
- `payment_settings`
- `bank_accounts`

#### Kitchen Runtime

- `kitchen_stations`
- `kitchen_station_devices`
- `kitchen_tickets`
- `kitchen_ticket_items`
- `kitchen_ticket_events`

## Module Map

### 1. Identity, Access, and Security

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Auth | `src/modules/auth` | login, logout, refresh, password flow |
| RBAC | `src/modules/access` | roles, permissions, outlet scoping |
| Session & security | `src/shared/auth`, `src/shared/middleware` | auth guard, step-up, throttle, audit context |

Catatan penting:

- auth tidak cukup hanya “user valid”, tetapi juga harus memuat outlet memberships,
- permission harus dievaluasi bersama outlet scope,
- aksi privileged harus bisa meminta re-auth atau step-up.

### 2. Outlets and Settings

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Outlets | `src/modules/outlets` | daftar outlet, active outlet, outlet profile |
| Outlet settings | `src/modules/settings` | store profile, sales target, loyalty setting |
| Payment settings | `src/modules/payments` | gateway config, bank accounts, callback tokens |

Boundary penting:

- pengaturan outlet tidak boleh bocor ke outlet lain,
- active outlet resolution wajib terjadi sebelum route bisnis berjalan.

### 3. Master Data

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Categories | `src/modules/catalog` | category list, create, update |
| Products | `src/modules/catalog` | product master + stock view |
| Customers | `src/modules/customers` | customer CRUD, history, loyalty context |
| Members | `src/modules/customers` | member upgrade, loyalty state |
| Suppliers | `src/modules/suppliers` | supplier CRUD |

Boundary penting:

- hindari menempelkan stok langsung ke product master,
- gunakan catalog global + stock per outlet untuk desain yang scalable.

### 4. POS and Sales Core

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| POS cart & checkout | `src/modules/transactions` | carts, checkout, totals, payment handoff |
| Hold/resume | `src/modules/transactions` | held cart per user + outlet |
| Invoice/share | `src/modules/documents`, `src/modules/transactions` | invoice payload, public share |
| Payment confirmation | `src/modules/payments` | post-payment reconciliation |
| Transaction history | `src/modules/transactions` | history, filters, receipt context |
| Kitchen dispatch trigger | `src/modules/transactions`, `src/modules/kitchen` | split item by station setelah checkout |

Boundary penting:

- cart harus terikat `user_id + outlet_id`,
- checkout wajib shift aktif dan outlet aktif,
- transaction adalah pusat relasi ke stock, profit, receivable, loyalty, campaign log, dan kitchen ticket.

### 4A. Kitchen Display, Printer, and Production Flow

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Kitchen stations | `src/modules/kitchen` | station CRUD, outlet binding |
| Station devices | `src/modules/kitchen` | layar dapur, printer dapur, device status |
| Kitchen tickets | `src/modules/kitchen` | ticket create, acknowledge, in-progress, ready |
| Kitchen live feed | `src/modules/kitchen` | pull/push feed untuk layar dapur |
| Kitchen print dispatch | `src/modules/kitchen`, `src/modules/print` | routing print ke station device |

Boundary penting:

- station harus outlet-bound,
- satu transaksi bisa membentuk banyak kitchen ticket,
- satu station hanya boleh melihat ticket miliknya,
- printer dan layar dapur tidak boleh menerima item dari station lain.

### 5. Pricing, Loyalty, and Commercial Engine

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Pricing rules | `src/modules/pricing` | rule CRUD, preview, precedence |
| Loyalty | `src/modules/loyalty` | point earn/redeem, tier sync |
| Voucher | `src/modules/loyalty` | voucher issue, validate, apply |
| Segment | `src/modules/crm` | manual dan auto segment |

Boundary penting:

- pricing engine harus tahu apakah rule global atau outlet-specific,
- loyalty account boleh global, tetapi transaksi sumber tetap per outlet,
- voucher dan promo tidak boleh overlap tanpa precedence rule eksplisit.

### 6. Inventory Control

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Stock view | `src/modules/inventory` | stock per outlet |
| Stock mutations | `src/modules/inventory` | mutation log, source typing |
| Stock opname | `src/modules/inventory` | draft, item count, finalize |
| Inter-outlet transfer | `src/modules/inventory-transfer` | transfer request, approve, receive |

Boundary penting:

- inventory adalah outlet-bound,
- transfer antar outlet harus dianggap dua mutasi: keluar dari outlet A, masuk ke outlet B,
- stock opname finalize wajib transactional terhadap outlet yang sama.

### 7. Returns, Procurement, and Supplier Flow

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Sales returns | `src/modules/sales-returns` | return, restock, receivable correction |
| Purchase orders | `src/modules/procurement` | draft, place, cancel |
| Goods receivings | `src/modules/procurement` | receiving against PO |
| Supplier returns | `src/modules/procurement` | vendor correction flow |

Boundary penting:

- setiap dokumen procurement harus punya outlet owner,
- supplier boleh global, tetapi dokumen PO/receiving/return tetap outlet-bound,
- perubahan status harus diperlakukan sebagai state machine.

### 8. Receivables and Payables

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Receivables | `src/modules/receivables` | due date, payment, aging |
| Payables | `src/modules/payables` | payable lifecycle, payment, aging |
| Statements | `src/modules/reports`, `src/modules/documents` | customer/supplier statement |

Boundary penting:

- aging summary default harus per outlet aktif,
- cross-outlet finance consolidation harus route terpisah dengan guard lebih ketat.

### 9. CRM and Retention

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| CRM campaigns | `src/modules/crm` | campaign create, process, log |
| CRM reminders | `src/modules/crm` | due-soon, overdue, repeat order |
| Segment sync | `src/modules/crm` | auto membership update |

Boundary penting:

- customer bisa global, tetapi campaign source event bisa datang dari outlet spesifik,
- perlu diputuskan apakah campaign dijalankan per outlet atau global customer base.

### 10. Reports, Documents, and Observability

| Area | Route module target | Komponen inti |
| --- | --- | --- |
| Sales report | `src/modules/reports` | sales aggregation per outlet |
| Profit report | `src/modules/reports` | margin and profit per outlet |
| Insights | `src/modules/reports` | dashboard analytics |
| Audit logs | `src/modules/audit` | event trail |
| Documents | `src/modules/documents` | invoice, statement, receipt payload |

Boundary penting:

- report query adalah hotspot performa, jadi cache strategy harus direncanakan,
- audit logs harus menyimpan `user_id`, `outlet_id`, `module`, `event`, `correlation_id`.

## Peta Alur Bisnis

### Penjualan Reguler Multi Outlet

1. User login dan mendapatkan daftar outlet yang diizinkan.
2. User memilih atau mewarisi `activeOutlet`.
3. Sistem memastikan ada shift aktif untuk user pada outlet aktif.
4. POS membangun cart scoped ke `user + outlet`.
5. Pricing dan loyalty preview dihitung dengan context outlet aktif.
6. Checkout membentuk transaction, items, profit, dan stock mutation di outlet yang sama.
7. Sistem memecah item transaksi per kitchen station dan membentuk kitchen ticket yang relevan.
8. Hanya station yang relevan yang menerima layar atau printer notification.
9. Jika metode bayar kredit, sistem membentuk receivable pada outlet tersebut.

### Kitchen Routing per Nota

1. Kasir menyimpan transaksi.
2. Sistem membaca `transaction_items`.
3. Setiap item dipetakan ke `station_id`.
4. Item dikelompokkan per station.
5. Untuk setiap station yang punya item, sistem membuat `kitchen_ticket`.
6. Ticket dikirim ke device aktif station:
   - printer dapur
   - kitchen display screen
7. Station yang tidak punya item pada nota itu tidak menerima notifikasi.

### Kitchen Ticket Lifecycle

1. `pending_dispatch`
2. `dispatched`
3. `acknowledged`
4. `in_progress`
5. `ready`
6. `completed` atau `cancelled`

### Procurement per Outlet

1. Admin outlet membuat purchase order.
2. Barang diterima di outlet yang sama atau warehouse outlet tersebut.
3. Receiving membentuk mutation masuk dan update hutang supplier yang relevan.
4. Jika ada retur supplier, mutation keluar dan koreksi finance dibuat pada outlet yang sama.

### Inter-Outlet Transfer

1. Outlet asal membuat permintaan transfer.
2. Approval atau validation rule dijalankan.
3. Mutation keluar dicatat di outlet asal.
4. Mutation masuk dicatat di outlet tujuan.
5. Audit log dan status transfer harus sinkron.

### CRM dan Retention

1. Customer activity tercatat dengan asal outlet.
2. Segment global atau outlet-specific dihitung sesuai aturan.
3. Campaign log dibuat idempotent dengan context key.
4. Reminder receivable default berjalan pada scope outlet aktif atau outlet tertentu.

### Security dan Privileged Action

1. User terautentikasi.
2. Outlet scope tervalidasi.
3. Route sensitif memeriksa permission + outlet access.
4. Aksi sangat sensitif dapat meminta step-up auth.
5. Semua event penting membentuk audit trail.

## Peta Kode untuk Developer

### Struktur Folder yang Disarankan

```txt
workers-hono/
  src/
    index.ts
    shared/
      auth/
      db/
      middleware/
      utils/
    modules/
      auth/
      access/
      outlets/
      settings/
      catalog/
      customers/
      suppliers/
      transactions/
      kitchen/
      print/
      pricing/
      loyalty/
      inventory/
      inventory-transfer/
      procurement/
      sales-returns/
      receivables/
      payables/
      crm/
      reports/
      payments/
      documents/
      audit/
```

### Saat Menambah Modul Baru

Sentuh area berikut secara sadar:

1. route module,
2. schema validation,
3. service,
4. repository,
5. outlet scope enforcement,
6. audit trail bila sensitif,
7. test module,
8. dokumentasi.

### Saat Mengubah Workflow Sensitif

Checklist minimal:

1. cek auth dan outlet guard,
2. cek permission boundary,
3. cek idempotency,
4. cek transactional consistency D1 atau compensation strategy,
5. cek audit log,
6. cek dampak cache,
7. cek apakah query bisa bocor lintas outlet,
8. cek apakah item routing ke dapur masih benar.

### Saat Menyentuh POS

Perhatikan dependency tersembunyi berikut:

- active outlet,
- active shift,
- stock per outlet,
- pricing preview,
- loyalty/voucher,
- payment gateway readiness,
- receivable creation,
- invoice share/public access,
- low stock notification per outlet,
- station mapping product,
- kitchen ticket dispatch,
- printer atau layar dapur per outlet.

## Milestone Map

### Milestone 0 — Foundation and Parity Planning

Status: harus dibuat lebih dulu.

- Worker bootstrap
- Hono route modules
- env binding dan data adapter baseline
- auth contract
- active outlet resolution

### Milestone 1 — Multi Outlet Core

Status: requirement inti, bukan optional enhancement.

- outlets master
- user-outlet membership
- active outlet context
- cart, transaction, shift, stock mutation scoped per outlet
- report filter per outlet

Fokus improvement:

- pastikan tidak ada query unscoped,
- definisikan contract outlet-aware sejak awal,
- siapkan migration strategy dari single-store domain lama.

### Milestone 2 — Operational Core

- cashier shift
- kitchen stations dan kitchen ticket routing
- stock opname
- stock mutation
- sales return
- audit log
- authorization consistency

Fokus improvement:

- state transition rapi,
- side effect outlet-bound,
- observability mutation lebih kuat,
- routing item ke dapur tidak boleh salah station.

### Milestone 3 — Backoffice Financial and Procurement

- receivables lifecycle
- payables lifecycle
- aging summary
- purchase orders
- goods receivings
- supplier returns

Fokus improvement:

- integrity stok dan finance per outlet,
- procurement state machine,
- consolidated report opt-in.

### Milestone 4 — Commercial Growth Engine

- pricing rules engine
- loyalty membership, points, tiering
- customer vouchers
- customer segments
- CRM campaigns dan reminders
- advanced insights

Fokus improvement:

- rule precedence,
- outlet-specific promotion,
- loyalty global vs outlet source clarity.

### Milestone 5 — Hardening and Scale

- inter-outlet transfer
- approval workflow
- import/export toolkit
- backup/restore
- advanced monitoring
- external integrations

Urutan prioritas disarankan:

1. foundation,
2. multi outlet core,
3. operational parity,
4. procurement and finance,
5. growth engine,
6. scale and hardening.

## Definition of Done untuk Modul Baru

Sebuah modul dianggap layak merge jika:

1. route boundary jelas,
2. input schema dan output contract jelas,
3. outlet scope tervalidasi,
4. workflow state masuk akal,
5. side effect penting konsisten,
6. audit/logging dipertimbangkan,
7. test minimal tersedia,
8. kitchen routing benar bila modul menyentuh transaksi atau product mapping,
9. dokumentasi system map tetap sinkron.

## Rekomendasi Fokus Engineering Berikutnya

Prioritas paling sehat untuk versi Workers ini:

1. definisikan data model multi outlet lebih dulu,
2. bangun auth + active outlet context,
3. definisikan kitchen station dan product-to-station mapping,
4. pindahkan POS read/write path dengan outlet isolation + kitchen dispatch,
5. lanjut ke inventory dan finance,
6. setelah itu baru growth engine dan report advance.
