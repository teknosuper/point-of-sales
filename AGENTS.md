# AGENTS.md — Point of Sales

## Stack

- **Backend**: Laravel 12 (PHP 8.2+)
- **Frontend**: Inertia.js 2.0 + React 18, Vite 5
- **Styling**: Tailwind CSS 3 (custom theme in `tailwind.config.js`)
- **Auth/RBAC**: Spatie Laravel Permission + Laravel Breeze
- **DB**: MySQL (default); SQLite in-memory for tests
- **Payment webhooks**: Midtrans, Xendit (`routes/api.php`)

## Developer Commands

```bash
# Initial setup (run in order)
cp .env.example .env
composer install
npm install
php artisan key:generate
php artisan migrate --seed
php artisan storage:link

# Dev servers — run BOTH in parallel
npm run dev        # Vite (HMR)
php artisan serve  # Laravel API

# Testing
php artisan test                     # all tests
php artisan test --filter=FooTest    # single test class
php artisan test --filter=test_name  # single test method

# Formatting
vendor/bin/pint                      # PHP formatter (Laravel Pint)
```

## Architecture

- **Controllers**: `app/Http/Controllers/Apps/` — dashboard module controllers
- **React pages**: `resources/js/Pages/Dashboard/` — Inertia page components
- **Entry point**: `resources/js/app.jsx` — bootstraps Inertia + React
- **Services**: `app/Services/` — cross-cutting logic (AuditLog, CashierShift, StockMutation, Payments/)
- **Middleware**: `app/Http/Middleware/` — custom middleware including `EnsureActiveCashierShift`
- **Inertia shared props**: `app/Http/Middleware/HandleInertiaRequests.php` — shares auth, permissions, notifications, store profile to all pages
- **Routes**: `routes/web.php` (dashboard), `routes/api.php` (payment webhooks), `routes/auth.php` (Breeze auth)

## Middleware & Access Control

- **`permission`** (Spatie): every dashboard route is protected by a specific permission string
- **`active_shift`**: required for all POS transaction actions (search product, cart CRUD, hold/resume, store). Blocks if cashier has no open shift
- **`bot.guard`**: applied on login/register/forgot-password for throttle protection
- **`registration.enabled`**: public registration is **off by default** (`AUTH_PUBLIC_REGISTRATION=false`)

## Critical Gotchas

1. **Permission cache stale after seeding** — after `db:seed`, logout + login again to refresh Spatie's permission cache
2. **Webhooks need public APP_URL** — Midtrans/Xendit webhooks will not work with `localhost`; set `APP_URL` to a public URL
3. **Product images require storage link** — run `php artisan storage:link` or images won't render
4. **New module routes may 500 without migrations** — newer modules (sales returns, stock opname, cashier shifts, audit logs) need their migrations run: `php artisan migrate`
5. **Tests use SQLite in-memory** — `phpunit.xml` forces `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`. Do not assume MySQL features in tests.
6. **Both dev servers required** — Inertia needs Vite running for HMR and asset serving. `php artisan serve` alone will not load JS/CSS.
7. **Report date filters can use converted display dates** — untuk halaman report yang menampilkan tanggal hasil konversi timezone frontend, `start_date` / `end_date` harus dikonversi balik ke timezone sumber sebelum query. Jangan campur `whereDate(...)`, `applyUtcDateRange(...)`, dan `CONVERT_TZ(...)` secara ad hoc. Gunakan helper terpusat di `app/Support/ReportTimezone.php` agar filter, grouping harian, dan label tanggal konsisten.
8. **Date bucket harian harus source-aware** — jika `created_at` disimpan/dibaca sebagai `REPORT_SOURCE_TIMEZONE`, maka key harian untuk chart, summary, atau regrouping collection harus dibuat lewat helper source-aware di `ReportTimezone`, bukan lewat `localDateKey()` umum atau parsing mentah.
9. **Insights tenant tidak boleh pakai total invoice penuh** — pada `/dashboard/reports/insights`, jika workspace aktif adalah tenant maka agregasi omzet/profit/order tidak boleh memakai `transactions.grand_total` atau `profits.total` per invoice penuh hanya karena ada satu detail tenant. Gunakan agregasi scoped detail/allocation tenant. Jika modul seperti loyalty atau CRM belum punya sumber data tenant-safe, sembunyikan blok owner-level itu di workspace tenant agar data tidak tercampur.
9. **Profit report tenant payout punya 3 angka yang tidak boleh dicampur** — `saldo tenant` dihitung dari `transaction_tenant_allocations`. Untuk kebutuhan outstanding, saldo ini dibaca kumulatif sampai `end_date` report, bukan dipotong `start_date`. `payout sudah dibayar` diambil dari `cashier_settlement_requests.approved_amount` untuk request tenant (`cashier_shift_id = null`, `status = approved`) dengan cutoff `paid_at <= end_date`. `outstanding ke tenant = saldo tenant kumulatif - payout sudah dibayar kumulatif`. Jangan pakai settlement approved sebagai pengganti saldo tenant, dan jangan pakai allocation payout estimate sebagai pengganti payout aktual.

## Frontend Conventions

- **Routing**: use Ziggy `route()` helper in React components (Ziggy is installed)
- **Styling**: Tailwind with semantic color tokens — `primary`, `accent`, `success`, `warning`, `danger` (see `tailwind.config.js`)
- **Icons**: `@tabler/icons-react`
- **Alerts**: `react-hot-toast` and `sweetalert2` (both installed)
- **Charts**: `chart.js`

## Database & Seeding

- Default seeders create roles, permissions, 2 users (admin + cashier), and sample data
- Admin: `arya@gmail.com` / `password`
- Cashir: `cashier@gmail.com` / `password`
- Indonesia region data loaded via `laravolt/indonesia` package

## Module Map (dashboard routes)

| Path | Purpose |
|------|---------|
| `/dashboard` | Main dashboard (permission: `dashboard-access`) |
| `/transactions` | POS — cart, hold/resume, checkout, print |
| `/transactions/history` | Transaction history + sales return entry |
| `/sales-returns` | Sales return management |
| `/customers` | Customer CRUD + Indonesia region data |
| `/receivables` | Customer receivables (piutang) |
| `/suppliers` | Supplier CRUD |
| `/payables` | Supplier payables (hutang) |
| `/stock-opnames` | Stock opname (audit inventory) |
| `/stock-mutations` | Stock mutation history |
| `/cashier-shifts` | Open/close cashier shifts |
| `/audit-logs` | Activity audit trail |
| `/settings/*` | Payments, bank accounts, store profile, targets |
| `/reports/sales` | Sales report |
| `/reports/profits` | Profit report |

## Docs

- Module docs: `docs/README.md` (index), `docs/features/` (per-module)
- Architecture: `docs/architecture-overview.md`
- Planning: `planning/improvement-planning.md`

## Fast Context Rules For Codex

Gunakan aturan ini agar cepat paham repo dan hemat token:

- Jangan mulai dengan scan seluruh repo. Mulai dari sumber kebenaran berikut, urut:
  1. `routes/web.php`
  2. controller terkait di `app/Http/Controllers/Apps` atau `app/Http/Controllers/Reports`
  3. service terkait di `app/Services`
  4. page terkait di `resources/js/Pages/Dashboard`
  5. test terkait di `tests/Feature`
  6. baru setelah itu baca `docs/` atau `planning/` bila perlu klarifikasi
- Jika task menyebut modul bisnis, cari dulu dokumen yang paling dekat di `docs/features/`, jangan baca semua file markdown.
- Jika task menyentuh multi-outlet, kitchen, loyalty tier, settlement tenant, atau stok, anggap repo ini masih fase transisi. Verifikasi implementasi aktual di kode, jangan hanya percaya dokumen lama.
- Jika ada konflik antara dokumentasi, planning, dan kode, prioritaskan kode aktif. Dokumentasi dipakai untuk orientasi, bukan sumber kebenaran final.
- Untuk pencarian, prioritaskan `rg` dan baca cuplikan file seperlunya. Hindari membuka file besar penuh jika cukup baca bagian relevan.
- Saat menjelaskan hasil, ringkas per area perubahan. Jangan copy-paste isi file panjang, log terminal panjang, atau stack trace penuh.

## Repo Mental Model

Pahami repo ini dengan model berikut agar keputusan teknis tidak salah arah:

- Ini bukan lagi POS sederhana. Sistem sudah mencakup kasir, shift, inventory audit, receivable, payable, procurement, loyalty, CRM, outlet, kitchen dispatch, dan fondasi foodcourt multi-tenant.
- `Transaction` adalah pusat alur penjualan dan berelasi ke profit, receivable, loyalty, sales return, payment reference, `outlet_id`, dan kitchen dispatch.
- `Product` adalah katalog global. Source of truth stok jangka panjang bergerak ke `product_outlet_stocks`. `products.stock` masih fallback kompatibilitas.
- Outlet aktif di-resolve server-side. Jangan asumsikan setting toko global tanpa cek `OutletResolver` dan shared props Inertia.
- Banyak modul sekarang harus dipikirkan sebagai `outlet-aware`. Jika query, policy, route model binding, report, atau summary belum memfilter outlet aktif, anggap ada potensi bug.
- Kitchen routing dipisah per station dan per outlet. Satu transaksi bisa menghasilkan banyak `kitchen_tickets`.
- Foodcourt multi-tenant sudah punya fondasi schema, tetapi UI dan sebagian flow masih parsial. Jangan refactor seolah fondasi itu belum ada.

## Task Routing Prompts

Gunakan prompt internal berikut sebagai heuristik kerja. Jangan tulis ulang ke user kecuali relevan.

### Saat menerima task bugfix

- Temukan route, controller, service, dan page yang menangani flow itu.
- Verifikasi apakah bug terkait permission, `active_shift`, outlet aktif, fallback stok, atau shared props Inertia sebelum mengubah UI.
- Perbaiki dengan patch sekecil mungkin dan pertahankan pola Laravel + Inertia yang sudah ada.

### Saat menerima task fitur baru

- Pastikan fitur ditempatkan dalam boundary modul yang sudah ada, bukan membuat pola baru tanpa alasan kuat.
- Cek apakah fitur perlu `permission`, `step_up`, `active_shift`, audit log, atau isolasi `outlet_id`.
- Jika fitur menyentuh transaksi, stok, kitchen, receivable, payable, atau loyalty, cek dampak lintas modul sebelum implementasi.

### Saat menerima task frontend

- Cari page utama di `resources/js/Pages/Dashboard` lalu telusuri komponen pendukungnya.
- Gunakan Ziggy `route()` untuk navigasi atau action endpoint.
- Ikuti token Tailwind yang sudah ada: `primary`, `accent`, `success`, `warning`, `danger`.
- Jangan memindahkan validasi domain ke frontend jika backend sudah punya boundary yang benar.

### Saat menerima task backend

- Mulai dari route surface dan middleware aktif pada route tersebut.
- Pindahkan business logic lintas model ke service bila pola repo sudah melakukannya.
- Untuk perubahan data sensitif, pertimbangkan audit log dan isolasi outlet.
- Untuk test, prioritaskan feature test paling sempit yang membuktikan perubahan.

### Saat menerima task laporan atau query data

- Asumsikan risiko utama adalah kebocoran data lintas outlet, bukan sekadar salah total angka.
- Verifikasi filter `outlet_id`, period filter, dan relasi agregasi sebelum mengubah tampilan.
- Jika report menyangkut tenant, loyalty, receivable, payable, atau profit, cek apakah agregasinya masih bergantung pada fallback global lama.
- Jika report memakai tanggal yang sudah dikonversi untuk tampilan user, pastikan filter query dan grouping harian memakai helper `ReportTimezone` yang sama dengan formatter tampilannya.
- Jika report profit menyentuh payout tenant, pisahkan selalu:
  - saldo tenant kumulatif sampai akhir periode: dari `transaction_tenant_allocations`
  - payout sudah dibayar kumulatif sampai akhir periode: dari `cashier_settlement_requests` tenant yang `approved`
  - outstanding ke tenant: `saldo tenant kumulatif - payout sudah dibayar kumulatif`

## Token Efficiency Rules

- Jawab singkat, langsung, dan fokus ke hasil.
- Jangan ulangi isi pertanyaan user.
- Jangan beri beberapa opsi jika satu opsi terbaik sudah cukup jelas.
- Jangan membaca seluruh markdown di `docs/` atau `planning/` tanpa alasan spesifik.
- Jangan menjalankan test full suite jika cukup test file atau method yang terdampak.
- Jangan refactor besar di luar scope task.
- Jangan membuat abstraction baru jika patch kecil pada pola existing sudah cukup.
- Jika butuh asumsi, pilih asumsi paling aman dan tulis singkat.
- Jika ada blocker nyata, jelaskan blocker dan satu langkah paling logis berikutnya.

## High-Risk Checks Before Concluding

Sebelum menganggap task selesai, cek cepat apakah perubahan menyentuh salah satu area ini:

- permission atau Spatie cache
- `active_shift`
- outlet isolation
- `products.stock` vs `product_outlet_stocks`
- kitchen station / ticket routing
- payment gateway config per outlet
- receivable / payable side effects
- sales return atau stock mutation trail
- shared props Inertia yang mempengaruhi banyak halaman

## Fast Start Prompt Pack

Pakai template singkat ini sebagai pola pikir awal saat mulai sesi:

```md
Pahami repo ini sebagai sistem POS retail yang sudah berkembang menjadi multi-modul dan sedang transisi ke multi-outlet, kitchen dispatch, dan foodcourt tenant allocation.

Saat mengerjakan task:
- cari route, controller, service, page, dan test yang paling relevan lebih dulu
- prioritaskan kode aktif dibanding dokumentasi jika ada konflik
- anggap `Transaction` sebagai pusat alur penjualan dan `product_outlet_stocks` sebagai arah source of truth stok
- cek `permission`, `active_shift`, `outlet_id`, dan shared props Inertia sebelum menyimpulkan akar masalah
- buat patch sekecil mungkin, ikuti pola existing, dan hindari scan repo berlebihan
- ringkas jawaban, fokus pada hasil, risiko, dan verifikasi
```
