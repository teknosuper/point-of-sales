# Feature Completeness Checklist

Kembali ke indeks dokumentasi: `docs/README.md`

Dokumen ini dipakai untuk menilai kelengkapan fitur aktual aplikasi Laravel utama dari sudut pandang `admin` dan `cashier`.

Status yang dipakai:

- `Sudah`: fitur utama sudah ada dan bisa dipakai.
- `Parsial`: fondasi sudah ada, tetapi alur operasional, UI, atau isolasi data belum rapi penuh.
- `Belum`: modul belum ada atau belum cukup untuk dipakai operasional.

## Ringkasan Saat Ini

### Admin

| Area | Status | Catatan |
| --- | --- | --- |
| Dashboard utama | Parsial | Sudah ada, tetapi audit pemisahan outlet dan widget tambahan masih perlu hardening |
| Master data kategori | Sudah | Search, filter, pagination, rows per page sudah ada |
| Master data produk | Parsial | Mapping tenant/kitchen, bulk mapping, audit ada; UI stok per outlet baru mulai terlihat, manajemen stok outlet belum utuh |
| Customer & member | Parsial | CRUD, loyalty, segment, outlet metrics ada; sebagian fallback global masih dipertahankan |
| Supplier | Sudah | CRUD dasar admin sudah ada |
| Receivable | Parsial | Workflow ada, tetapi audit isolasi outlet dan reminder masih perlu dicek penuh |
| Payable | Parsial | Workflow ada, tetapi audit isolasi outlet dan reminder masih perlu dicek penuh |
| Purchase order & receiving | Parsial | Modul ada, namun belum seluruh query/validasi dipastikan outlet-aware penuh |
| Sales return & supplier return | Sudah | Modul dan alur stok dasar sudah ada |
| Stock opname & mutation | Parsial | Modul ada, tetapi surface audit stok outlet per produk belum utuh |
| Role / user / permission | Sudah | RBAC inti ada |
| Permission per outlet | Parsial | Assignment outlet ada, tetapi RBAC granular per outlet/tenant belum final |
| Outlet & tenant management | Sudah | CRUD, tipe outlet, assignment user, komisi tenant sudah ada |
| Kitchen ops & printer settings | Parsial | Station/device/template ada; printer fisik end-to-end belum selesai |
| Sales / profit / analytics report | Parsial | Banyak report sudah ada; audit konsistensi outlet masih perlu diselesaikan |
| Tenant settlement & statement | Parsial | Summary, settle/unsettle, CSV, payout metadata ada; approval workflow belum ada |
| Setup wizard / audit / guide | Sudah | Sudah ada dan saling terhubung |

### Cashier

| Area | Status | Catatan |
| --- | --- | --- |
| Login & access | Sudah | Flow auth dasar berjalan tanpa verifikasi email |
| Shift kasir | Sudah | Open/close shift dan guard aktif sudah ada |
| POS cart & checkout | Parsial | Alur utama ada; foodcourt lintas tenant masih perlu pemolesan operasional |
| Hold / resume cart | Sudah | Sudah di-scope per outlet |
| Barcode search / product grid | Sudah | Sudah ada |
| Camera barcode scan | Parsial | Sudah ada pendekatan lintas browser, masih perlu verifikasi runtime device nyata |
| Multi-tenant item override | Parsial | Override tenant per item sudah ada, tetapi UX kasir foodcourt belum final |
| Kitchen queue | Parsial | Board dasar, polling, device-aware sudah ada; realtime push/printer fisik belum selesai |
| Print invoice / receipt | Sudah | Sudah ada, termasuk breakdown tenant dasar |
| Payment confirmation | Sudah | Workflow dasar sudah ada |
| Transaction history | Sudah | Sudah ada |

## Checklist Detail

### 1. Multi Outlet

- `Sudah`
  - active outlet resolver
  - outlet switcher dasar
  - outlet-aware pada banyak modul inti
  - outlet & tenant admin module
- `Parsial`
  - route model binding sensitif belum diaudit semua
  - report dan dashboard belum seluruhnya diverifikasi runtime
  - assignment permission per outlet belum final

### 2. Foodcourt Multi-Tenant

- `Sudah`
  - `tenant_outlet_id` pada produk, cart, transaction detail
  - `transaction_tenant_allocations`
  - settlement, statement, payout metadata
  - komisi tenant
- `Parsial`
  - UX kasir lintas tenant masih perlu dipoles
  - kitchen dispatch tenant-aware penuh belum final
  - approval settlement tenant belum ada

### 3. Kitchen & Printer

- `Sudah`
  - kitchen station
  - kitchen device
  - queue board
  - polling feed
  - printer template dasar
  - dispatch event dasar
- `Parsial`
  - realtime push
  - thermal printer fisik
  - health check nyata per driver
  - retry/fallback queue per device

### 4. Inventory

- `Sudah`
  - stock opname
  - stock mutation
  - receiving
  - returns
  - fallback stok global tetap aman
- `Parsial`
  - UI stok per outlet per produk belum lengkap
  - audit stok lintas outlet belum punya surface khusus

### 5. Loyalty, CRM, Segment

- `Sudah`
  - loyalty settings
  - voucher
  - segment
  - campaign/reminder dasar
  - customer outlet metrics
- `Parsial`
  - fallback `customers.loyalty_tier` masih hidup
  - beberapa summary dan test lama masih perlu dibersihkan

### 6. Testing & Hardening

- `Sudah`
  - baseline feature test untuk beberapa flow outlet dan loyalty
- `Parsial`
  - suite end-to-end belum lengkap
  - belum semua test dijalankan penuh pada environment target
  - audit akhir runtime browser lintas modul belum selesai

## Gap Terbesar Yang Masih Tersisa

1. permission granular per outlet / tenant
2. printer thermal fisik dan realtime kitchen dispatch
3. stok per outlet yang benar-benar terlihat dan mudah dikelola dari admin
4. hardening report/dashboard agar isolasi outlet konsisten
5. suite test end-to-end dan verifikasi runtime penuh

## Definisi Realistis `100%`

Sistem bisa dianggap mendekati `100%` jika:

1. seluruh modul admin/cashier utama lolos alur runtime tanpa 500
2. seluruh report dan transaksi sensitif konsisten terhadap outlet aktif
3. tenant foodcourt bisa diproses dari kasir sampai settlement tanpa workaround
4. kitchen queue bisa didispatch ke device nyata dengan alur yang dapat diandalkan
5. test isolation utama berjalan dan lulus

Saat ini status realistisnya belum di titik itu, tetapi fondasi terbesar sudah ada.
