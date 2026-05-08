# Laravel Revamp Progress

Update terakhir: 7 Mei 2026

Dokumen ini dipakai sebagai catatan kerja untuk revamp aplikasi Laravel utama agar:

- menjadi fondasi referensi bisnis utama,
- mendukung multi outlet,
- mendukung dispatch kitchen per station,
- dan bisa nanti dimirror ke versi `workers-hono`.

Dokumen ini bukan roadmap produk umum. Fokusnya adalah status implementasi teknis aktual agar sesi berikutnya bisa langsung lanjut tanpa audit ulang dari nol.

## Tujuan Revamp

Target akhir untuk aplikasi Laravel:

- satu codebase Laravel tetap berjalan sebagai aplikasi terpisah,
- seluruh alur utama menjadi `outlet-aware`,
- checkout dapat memecah item ke kitchen station terkait,
- stok outlet tidak lagi diasumsikan tunggal/global,
- dan boundary domain cukup rapi untuk dijadikan referensi porting ke `workers-hono`.

## Progress Ringkas

### Selesai

- fondasi schema multi outlet dan kitchen sudah ditambahkan
- model dasar outlet, kitchen station, kitchen ticket, dan product outlet stock sudah ditambahkan
- resolver outlet aktif sudah ditambahkan
- store profile Laravel sudah mulai membaca outlet aktif
- POS cart dan hold/resume sudah di-scope per outlet
- active cashier shift sudah dicek per outlet
- checkout transaksi sudah menulis `outlet_id`
- checkout transaksi sudah membuat `kitchen_tickets` per station relevan
- stok penjualan sudah mulai memakai `product_outlet_stocks`
- stock opname sudah membaca dan menulis stok outlet
- goods receiving sudah menambah stok outlet
- supplier return sudah mengurangi stok outlet
- sales return restock sudah menambah stok outlet
- receivable list, detail, payment, aging, dan statement mulai di-scope per outlet
- payable list, detail, payment, aging, dan statement mulai di-scope per outlet
- purchase order list, create, show, place, dan cancel mulai di-scope per outlet
- laporan sales, profit, dan advanced insights mulai default ke outlet aktif
- dashboard utama mulai menghitung transaksi, revenue, profit, low stock, top product, dan shift berdasarkan outlet aktif
- bank account workflow dan stock mutation history mulai di-scope per outlet
- validasi kesiapan bank transfer sekarang mempertimbangkan rekening aktif pada outlet aktif
- CRM campaign, CRM reminder list, dan scheduled reminder generation mulai di-scope per outlet
- customer campaign dan campaign log kini punya fondasi `outlet_id`
- customer, member, dan customer segment sekarang mulai membaca metrik transaksi per outlet aktif
- customer outlet metrics dan segment membership per outlet sudah punya schema dasar
- auto segment sync sekarang berjalan per outlet, bukan lagi mengandalkan field customer global
- shared props sekarang sudah membawa `activeOutlet` dan `availableOutlets`
- session-based outlet switching dasar sudah tersedia di Laravel dashboard dan POS layout
- monthly target, loyalty settings, dan payment settings sudah mulai membaca outlet aktif
- webhook payment sekarang mulai memilih konfigurasi gateway berdasarkan outlet transaksi
- kitchen display board dasar per station sudah tersedia di Laravel
- kitchen board sekarang sudah punya auto-refresh dasar dan station route yang aman per outlet
- kitchen board sekarang sudah device-aware, dengan feed JSON ringan dan mode tampilan `screen` vs `printer`
- baseline feature test untuk outlet switch, payment setting per outlet, dan kitchen isolation sudah mulai ditambahkan
- loyalty tier outlet sekarang punya schema dan resolver sendiri melalui `customer_outlet_metrics.loyalty_tier`
- pricing preview, member list, customer detail, segment, voucher picker, dan advanced insights loyalty sekarang mulai membaca tier outlet aktif lebih dulu
- fallback tier di flow customer/member sekarang ikut membaca outlet aktif saat request tidak membawa tier eksplisit
- baseline test sekarang juga mencakup override tier outlet terhadap tier global dan filter member berdasarkan tier outlet aktif
- pricing preview sekarang juga punya guard test untuk rule member yang membaca tier outlet aktif
- suite loyalty, member, dan advanced insights sekarang mulai punya test outlet-aware untuk tier payload dan distribusi loyalty
- kitchen board sekarang punya fondasi dispatch event per device printer, termasuk jejak `ticket.dispatched` untuk integrasi device berikutnya
- fondasi schema `foodcourt multi-tenant` sekarang mulai ada melalui `tenant_outlet_id` dan `transaction_tenant_allocations`
- foodcourt foundation sekarang juga punya guard test untuk split satu transaksi ke beberapa tenant allocation
- produk sekarang bisa punya tenant outlet default, cart membawa tenant outlet, dan checkout mulai meneruskan tenant outlet ke detail transaksi serta tenant allocation
- tenant allocation sekarang sudah membagi `voucher`, `loyalty`, `manual discount`, dan `shipping` secara proporsional per tenant, bukan hanya subtotal mentah
- invoice print dan riwayat transaksi sekarang mulai menampilkan breakdown tenant foodcourt agar alokasi tenant bisa dicek dari UI
- POS Laravel sekarang mulai mendukung override `tenant outlet` per item cart sebelum checkout, tidak lagi hanya mengikuti default produk
- laporan penjualan sekarang mulai memuat `tenant settlement` summary, top tenant, dan allocation list berbasis `transaction_tenant_allocations`
- laporan penjualan sekarang juga sudah punya aksi dasar `settle/unsettle` per tenant allocation dengan batasan outlet aktif
- laporan settlement tenant sekarang sudah punya filter `tenant/status settlement` dan export CSV berbasis filter aktif
- settlement tenant sekarang juga memuat `cost`, `profit`, dan `margin` berbasis item allocation, baik di summary report maupun CSV export
- settlement tenant sekarang mulai menghitung `management fee` dan `net payout tenant` berbasis `commission_rate_percent` pada outlet tenant
- report sekarang sudah punya halaman `tenant settlement statement` per tenant dengan summary payout dan histori allocation
- settlement tenant sekarang menyimpan metadata payout (`reference`, `notes`, `paid_at`) dan halaman statement tenant sudah bisa diexport ke CSV
- dokumentasi `docs/system-map.md` sudah disinkronkan dengan fondasi baru

### Sudah Ada Tapi Masih Parsial

- `products.stock` masih dipertahankan sebagai fallback transisi
- loyalty member tier sekarang sudah bisa di-resolve per outlet, tetapi field customer global masih dipertahankan sebagai fallback kompatibilitas
- selector outlet di UI sudah mulai tersedia, tetapi belum diuji penuh di seluruh halaman dan belum dipoles untuk semua edge case
- kitchen display Laravel sudah ada board dasar, polling feed ringan, dan mode device-aware, tetapi belum ada dispatch realtime ke device atau integrasi printer fisik
- foodcourt multi-tenant sekarang sudah punya fondasi schema, tenant propagation sampai checkout, dan tenant allocation breakdown di UI; tetapi UI kasir lintas tenant, settlement tenant, dan report tenant masih belum selesai
- query list dan detail untuk sebagian modul sudah outlet-aware, tetapi belum seluruh dashboard
- mutation trail outlet sudah mulai hidup, tapi belum semua modul operasional dipaksa lewat satu pola yang konsisten
- sebagian otomasi CRM kini outlet-aware, dan audience intelligence utama sudah mulai membaca metrik per outlet, tetapi tier state pelanggan dan beberapa fallback masih global
- beberapa fallback setting global lama masih dipertahankan untuk kompatibilitas migrasi

### Belum Selesai

- purchase order end-to-end belum sepenuhnya outlet-aware di seluruh query dan validasi
- receivable list, payment, aging, dan reminder belum diretrofit penuh ke outlet aktif
- payable list, payment, aging, dan reminder belum diretrofit penuh ke outlet aktif
- reports lanjutan dan dashboard summary belum difilter konsisten per outlet
- dashboard summary belum sepenuhnya memisahkan outlet
- dashboard tambahan, CRM reminder, dan command scheduler belum selesai outlet-aware
- bank account workflow belum seluruhnya divalidasi terhadap outlet aktif
- stock mutation history page belum dipastikan menampilkan isolasi outlet dengan benar
- product management belum punya UI stok per outlet yang utuh
- kitchen screen/printer workflow belum selesai end-to-end untuk device-specific dispatch
- checkout lintas tenant dalam satu nota belum selesai; produk belum punya assignment tenant operasional yang dipakai POS
- suite test isolasi multi outlet belum lengkap dan belum dieksekusi di environment ini

## File Penting Yang Sudah Berubah

### Schema dan Seeder

- `database/migrations/2026_05_07_120000_add_multi_outlet_and_kitchen_foundation.php`
- `database/seeders/OutletKitchenSeeder.php`
- `database/seeders/DatabaseSeeder.php`

### Model dan Resolver

- `app/Models/Outlet.php`
- `app/Models/ProductOutletStock.php`
- `app/Models/KitchenStation.php`
- `app/Models/KitchenStationDevice.php`
- `app/Models/ProductKitchenStationMapping.php`
- `app/Models/KitchenTicket.php`
- `app/Models/KitchenTicketItem.php`
- `app/Models/KitchenTicketEvent.php`
- `app/Models/Concerns/BelongsToOutlet.php`
- `app/Services/OutletResolver.php`

### POS dan Shift

- `app/Http/Controllers/Apps/TransactionController.php`
- `app/Services/KitchenTicketService.php`
- `app/Services/CashierShiftService.php`
- `app/Http/Middleware/EnsureActiveCashierShift.php`
- `app/Http/Controllers/Apps/CashierShiftController.php`

### Inventory dan Procurement

- `app/Services/StockMutationService.php`
- `app/Http/Controllers/Apps/StockOpnameController.php`
- `app/Http/Controllers/Apps/SalesReturnController.php`
- `app/Http/Controllers/Apps/GoodsReceivingController.php`
- `app/Services/GoodsReceivingService.php`
- `app/Http/Controllers/Apps/SupplierReturnController.php`
- `app/Services/SupplierReturnService.php`

### Shared App Context

- `app/Http/Middleware/HandleInertiaRequests.php`
- `app/Http/Controllers/Apps/SettingController.php`
- `app/Http/Controllers/DocumentController.php`

## Keputusan Arsitektur Saat Ini

### 1. Outlet Aktif

- context outlet aktif di-resolve server-side lewat `OutletResolver`
- fallback sementara: primary outlet user atau default outlet
- session-based outlet switching belum final

### 2. Stok

- arah arsitektur: `products` sebagai katalog global
- source of truth baru: `product_outlet_stocks`
- fallback transisi: `products.stock` tetap diisi agar modul lama tidak langsung rusak

### 3. Kitchen Routing

- satu transaksi dapat menghasilkan banyak `kitchen_tickets`
- satu ticket hanya untuk satu `kitchen_station`
- item tanpa mapping station tidak membuat ticket dapur
- routing sekarang dibentuk saat checkout melalui `KitchenTicketService`

### 4. Strategi Migrasi

- Laravel lama tidak dibuang
- Laravel menjadi aplikasi referensi bisnis utama
- `workers-hono` akan mengikuti business rules Laravel setelah Laravel stabil

## Risiko Teknis Yang Masih Ada

- beberapa modul lama bisa masih membaca `products.stock` langsung tanpa filter outlet
- laporan total bisa masih tercampur lintas outlet
- payment, receivable, dan payable bisa masih belum ketat terhadap outlet aktif
- route model binding pada modul yang belum disentuh bisa masih membuka data outlet lain jika ID diketahui
- switching outlet sudah ada di session dan layout utama, tetapi masih perlu verifikasi runtime lintas modul
- field agregat customer utama masih dipertahankan global sebagai fallback transisi, sehingga ada risiko drift bila ada modul lama yang belum memakai metrik outlet
- loyalty tier pelanggan masih global, sehingga threshold outlet berbeda dapat menimbulkan perilaku tier yang belum sepenuhnya terisolasi
- masih ada modul dan test lama yang mengasumsikan `customers.loyalty_tier` sebagai source utama, sehingga perlu audit lanjutan sebelum fallback global benar-benar bisa diperkecil

## Urutan Lanjutan Yang Disarankan

### Prioritas 1

- audit loyalty settings, voucher policy, dan membership summary yang masih global
- audit sisa permukaan loyalty yang masih mengikat ke `customers.loyalty_tier` di frontend lama dan test lama
- retrofit dashboard summary dan widget lain yang masih membaca lintas outlet
- audit ulang modul procurement sisa yang belum disentuh penuh

### Prioritas 2

- retrofit report controller agar seluruh laporan default ke outlet aktif
- retrofit stock mutation history dan product management agar stok outlet terlihat jelas di UI
- tambahkan validasi outlet pada route model binding sensitif yang belum disentuh
- retrofit payment settings dan bank transfer management bila nanti dibutuhkan per outlet secara penuh

### Prioritas 3

- tambahkan selector outlet di frontend dashboard
- tambahkan test isolation untuk transaksi, stok, receivable, payable, dan kitchen ticket

## Catatan Verifikasi

Yang sudah diverifikasi di environment kerja ini:

- `php -l` untuk file-file yang diubah lolos

Yang belum bisa diverifikasi di environment kerja ini:

- `php artisan migrate`
- `php artisan test`
- alur runtime penuh di browser

Penyebab:

- environment ini gagal koneksi ke MySQL
- test SQLite sebelumnya juga tidak siap penuh di sandbox ini

## Cara Melanjutkan Sesi Berikutnya

Kalau melanjutkan pekerjaan, baca dulu:

1. `planning/laravel-revamp-progress.md`
2. `docs/system-map.md`
3. `database/migrations/2026_05_07_120000_add_multi_outlet_and_kitchen_foundation.php`
4. `app/Services/OutletResolver.php`
5. `app/Http/Controllers/Apps/TransactionController.php`
6. `app/Services/StockMutationService.php`

Lalu lanjut dari blok prioritas ini:

- payment settings per outlet jika memang dibutuhkan operasional
- kitchen display / kitchen queue UI Laravel
- test isolation untuk transaksi, stok, receivable, payable, CRM, dan customer segment
