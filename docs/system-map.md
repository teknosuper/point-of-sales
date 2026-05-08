# System Map

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Dokumen ini adalah peta kerja developer untuk repo Point of Sales saat ini. Fokusnya bukan menjelaskan UI per halaman, tetapi membantu tim menjawab empat hal dengan cepat:

1. sistem ini sekarang terdiri dari modul apa saja,
2. boundary kode dan data tiap modul ada di mana,
3. milestone pengembangan paling masuk akal berikutnya apa,
4. coding standard apa yang harus dijaga agar repo tetap konsisten.

## Snapshot Sistem

### Stack

- Backend: Laravel 12 + PHP 8.2
- Frontend: Inertia.js 2 + React 18
- Styling: Tailwind CSS 3
- Auth dan RBAC: Laravel Breeze + Spatie Permission
- Database: MySQL untuk aplikasi, SQLite in-memory untuk test
- Payment: cash, bank transfer, Midtrans, Xendit

### Karakter Sistem Saat Ini

Repo ini sudah berkembang dari POS dasar menjadi sistem operasional retail yang mencakup:

- front-office penjualan,
- kontrol shift kasir,
- inventory audit dan mutation trail,
- receivable dan payable lifecycle,
- procurement dasar,
- loyalty, voucher, dan pricing engine,
- CRM segmentasi dan campaign reminder,
- audit trail dan security hardening dasar.

Artinya, keputusan engineering tidak boleh lagi dibuat seolah sistem ini hanya punya modul transaksi dan master data.

### Fondasi Baru: Multi Outlet dan Kitchen Routing

Per tanggal 7 Mei 2026, repo Laravel ini sudah memiliki fondasi schema untuk:

- `outlets` sebagai store profile dan konteks operasional,
- `outlet_user` untuk membership user ke outlet,
- `product_outlet_stocks` untuk stok per outlet,
- `kitchen_stations`, `kitchen_station_devices`, `product_kitchen_station_mappings`,
- `kitchen_tickets`, `kitchen_ticket_items`, `kitchen_ticket_events`,
- `outlet_id` di tabel operasional utama untuk isolasi data lintas outlet.

Catatan penting:

- implementasi ini mempertahankan `products.stock` sebagai backward-compatible field transisi,
- source of truth stok multi outlet ke depan adalah `product_outlet_stocks`,
- store profile tidak lagi diasumsikan global dari `settings`, tetapi di-resolve dari outlet aktif dengan fallback aman ke setting lama.

## Sumber Kebenaran Utama

Jika ada perbedaan antara dokumen lama dan implementasi aktual, prioritaskan sumber berikut:

1. `routes/web.php`
2. `app/Http/Controllers/Apps` dan `app/Http/Controllers/Reports`
3. `app/Services`
4. `resources/js/Pages/Dashboard`
5. `tests/Feature`
6. `docs/` dan `planning/`

Catatan: roadmap di `planning/` sudah tidak sepenuhnya merepresentasikan status implementasi sekarang, karena beberapa fase di sana sudah sebagian atau penuh terimplementasi.

## Peta Arsitektur

### Layer Backend

| Layer | Lokasi utama | Peran |
| --- | --- | --- |
| Route surface | `routes/web.php`, `routes/api.php` | Mendefinisikan endpoint, middleware, dan permission boundary |
| Controller | `app/Http/Controllers/Apps`, `app/Http/Controllers/Reports` | Orkestrasi request, render Inertia, response JSON/redirect |
| Request validation | `app/Http/Requests` | Validasi input untuk workflow yang sudah diformalisasi |
| Domain service | `app/Services` | Menangani business logic lintas model atau lintas modul |
| Model | `app/Models` | State domain, relasi, scope, helper model |
| Middleware | `app/Http/Middleware` | Guard akses, hardening, Inertia shared props |
| Persistence | `database/migrations`, `database/seeders` | Skema domain dan seed permission/role/sample data |

### Layer Frontend

| Layer | Lokasi utama | Peran |
| --- | --- | --- |
| App bootstrap | `resources/js/app.jsx` | Inisialisasi Inertia dan provider global |
| Layout | `resources/js/Layouts` | Shell halaman dashboard, guest, dan POS |
| Page modules | `resources/js/Pages/Dashboard` | Entry point UI per modul |
| Shared components | `resources/js/Components` | Building blocks UI reusable |
| POS components | `resources/js/Components/POS` | Komponen workflow kasir |
| Auth/permission utilities | `resources/js/Utils/authorization.js`, `resources/js/Utils/Permission.jsx` | Konsumsi permission di frontend |
| Styling | `resources/css`, `tailwind.config.js` | Token desain dan utility classes |

### Cross-Cutting Concerns

| Concern | Implementasi saat ini |
| --- | --- |
| Shared props | `HandleInertiaRequests` membagikan auth, permissions, `activeOutlet`, store profile, notifications, security warnings, active shift |
| Route authorization | Mayoritas route dashboard dijaga `permission:*` |
| Step-up auth | Middleware `step_up` untuk aksi sensitif seperti update payment settings, bank account mutation, role/user mutation, confirm payment |
| Active shift guard | Middleware `active_shift` untuk operasi POS yang mengubah cart atau checkout |
| Outlet context | `OutletResolver` memilih outlet dari session/user membership/default outlet |
| Auditability | `AuditLogService` dipakai untuk event sensitif dan perubahan operasional |
| Payment integration | API webhook terpisah di `routes/api.php` |

## Module Map

### 1. Identity, Access, and Security

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Auth & profile | `routes/auth.php`, `/dashboard/profile` | Breeze controllers, `ProfileController` |
| RBAC | `/dashboard/roles`, `/dashboard/users`, `/dashboard/permissions` | `RoleController`, `UserController`, `PermissionController`, `PermissionSeeder` |
| Security hardening | global web middleware | `SecureHeaders`, `EnforceAbsoluteSessionLifetime`, `EnsureRecentPasswordConfirmation`, `EnsureBotGuard`, `EnsurePublicRegistrationEnabled` |

Catatan penting:

- super admin di-handle sebagai bypass authorization dan diuji di `tests/Feature/Authorization/AuthorizationConsistencyTest.php`
- aksi privileged menggunakan password reconfirmation, bukan hanya permission biasa

### 2. Dashboard and Settings

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Dashboard | `/dashboard` | `DashboardController`, `Pages/Dashboard/Index.jsx` |
| Store profile | `/dashboard/settings/store` | `SettingController`, `OutletResolver`, `Outlet` |
| Sales target | `/dashboard/settings/target` | `SettingController` |
| Loyalty settings | `/dashboard/settings/loyalty` | `SettingController`, `LoyaltyService` |
| Payment settings | `/dashboard/settings/payments` | `PaymentSettingController`, `PaymentGatewayManager` |
| Bank accounts | `/dashboard/settings/bank-accounts` | `BankAccountController` |

Catatan penting:

- target penjualan dan loyalty masih global di `settings`,
- profil outlet sudah mulai dibaca dari `outlets` dan hanya fallback ke `settings` bila migrasi belum ada,
- UI selector outlet belum final, jadi outlet aktif saat ini masih mengikuti resolver server-side.
- shift kasir sekarang dibuka per outlet aktif, bukan lagi diasumsikan global per user.

### 3. Master Data

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Categories | `/dashboard/categories` | `CategoryController`, `Category` |
| Products | `/dashboard/products` | `ProductController`, `Product` |
| Customers | `/dashboard/customers` | `CustomerController`, `Customer` |
| Members | `/dashboard/members` | `MemberController`, loyalty fields pada `Customer` |
| Suppliers | `/dashboard/suppliers` | `SupplierController`, `Supplier` |
| Indonesia regions | AJAX dashboard endpoints | `RegionController`, Laravolt Indonesia |

### 4. POS and Sales Core

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| POS cart & checkout | `/dashboard/transactions` | `TransactionController`, `Cart`, `Transaction`, `TransactionDetail` |
| Hold/resume | POS routes `hold`, `resume`, `held` | `Cart` hold fields |
| Invoice/receipt/share | `/transactions/{invoice}/print`, `/share/transactions/{invoice}` | `DocumentController`, receipt PDF views |
| Payment confirmation | `/dashboard/transactions/{transaction}/confirm-payment` | `TransactionController`, `step_up` |
| Transaction history | `/dashboard/transactions/history` | `TransactionController` |

Boundary penting:

- operasi POS mutasi data dijaga `active_shift`
- transaksi adalah pusat relasi ke profit, receivable, loyalty, sales return, campaign share, dan payment reference
- transaksi sekarang juga harus dipandang sebagai parent untuk `outlet_id` dan kitchen ticket routing

Status implementasi saat ini:

- cart aktif dan held cart sudah di-scope per `cashier_id + outlet_id`,
- pencarian barcode dan grid produk POS sudah membaca stok outlet,
- checkout Laravel sudah menulis `outlet_id` ke transaksi dan receivable,
- checkout Laravel sudah membentuk `kitchen_tickets` per station yang relevan,
- pengurangan stok penjualan sudah mulai diarahkan ke `product_outlet_stocks`,
- stock opname, goods receiving, supplier return, dan sales return mulai memperbarui stok outlet,
- receivable, payable, purchase order, dan laporan utama mulai default ke outlet aktif.

### 4A. Multi Outlet and Kitchen Dispatch

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Outlet master | schema + model foundation | `Outlet`, `outlet_user`, `OutletResolver` |
| Outlet stock ledger | schema foundation | `ProductOutletStock` |
| Kitchen station | schema + model foundation | `KitchenStation`, `KitchenStationDevice`, `ProductKitchenStationMapping` |
| Kitchen dispatch | schema + model foundation | `KitchenTicket`, `KitchenTicketItem`, `KitchenTicketEvent` |

Boundary penting:

- satu transaksi boleh menghasilkan banyak kitchen ticket,
- satu kitchen ticket hanya untuk satu station dan satu outlet,
- station yang tidak punya item dalam transaksi tidak boleh menerima notifikasi,
- printer atau layar dapur harus diikat ke `kitchen_station_devices`, bukan langsung ke transaksi.

### 4B. Foodcourt Multi-Tenant Foundation

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Master transaction | `/dashboard/transactions` | `Transaction`, `TransactionDetail` |
| Tenant allocation | schema + service foundation | `TransactionTenantAllocation`, `TransactionTenantAllocationItem`, `FoodcourtTenantAllocationService` |
| Tenant revenue split | domain foundation | `transaction_details.tenant_outlet_id` |

Boundary penting:

- satu `Transaction` tetap menjadi nota dan pembayaran utama di kasir,
- setiap `TransactionDetail` sekarang bisa menunjuk `tenant_outlet_id` yang berbeda dari outlet kasir,
- revenue tenant dipisah melalui `transaction_tenant_allocations`,
- satu nota bisa menghasilkan banyak alokasi tenant untuk settlement foodcourt,
- kitchen ticket tetap bisa dipecah lebih lanjut per tenant dan per station.

Status implementasi saat ini:

- fondasi schema dan model tenant allocation sudah ditambahkan,
- produk sekarang mulai bisa punya `tenant_outlet_id` default,
- cart POS sekarang mulai membawa `tenant_outlet_id` dari produk,
- checkout lama masih menulis satu tenant yang sama dengan outlet aktif sebagai fallback kompatibilitas,
- service `FoodcourtTenantAllocationService` sudah membentuk alokasi tenant dari detail transaksi,
- flow kasir lintas tenant dalam satu nota belum selesai di UI dan belum mengganti mapping produk ke tenant secara penuh.

### 5. Pricing, Loyalty, and Commercial Engine

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Pricing rules | `/dashboard/pricing-rules` | `PricingRuleController`, `PricingService`, `PricingRule*` models |
| Pricing preview | POS preview + `/dashboard/pricing-rules/preview` | `PricingService` |
| Loyalty membership | customer/member modules | `LoyaltyService` |
| Voucher | `/dashboard/customer-vouchers` | `CustomerVoucherController`, `CustomerVoucher` |
| Segment | `/dashboard/customer-segments` | `CustomerSegmentController`, `CustomerSegmentationService` |

Boundary penting:

- `PricingService` sudah mengandung rule engine nyata: standard discount, qty break, bundle, dan buy-x-get-y
- `LoyaltyService` menghitung earn/redeem points, voucher discount, tier sync, dan checkout preview

### 6. Inventory Control

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Stock opname | `/dashboard/stock-opnames` | `StockOpnameController`, `StockOpname`, `StockOpnameItem` |
| Stock mutations | `/dashboard/stock-mutations` | `StockMutationController`, `StockMutationService`, `StockMutation` |
| Low stock notification | shared props dashboard | `HandleInertiaRequests`, `ProductNotificationRead` |

Boundary penting:

- stock opname finalize harus transactional dan menghasilkan mutation trail
- perubahan stok bukan hanya concern `Product`, tetapi harus punya histori asal mutasi

Status implementasi saat ini:

- stock opname list dan finalize sudah di-scope ke outlet aktif,
- `system_stock` pada stock opname item sudah membaca stok outlet,
- receiving procurement sudah menambah stok outlet,
- supplier return dan sales return restock sudah menyesuaikan stok outlet,
- fallback ke `products.stock` masih dipertahankan untuk kompatibilitas transisi.

### 7. Returns, Procurement, and Supplier Flow

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Sales returns | `/dashboard/sales-returns` | `SalesReturnController`, `SalesReturn`, `SalesReturnItem` |
| Purchase orders | `/dashboard/purchase-orders` | `PurchaseOrderController`, `PurchaseOrderService`, `PurchaseOrder` |
| Goods receivings | `/dashboard/goods-receivings` | `GoodsReceivingController`, `GoodsReceivingService`, `GoodsReceiving` |
| Supplier returns | `/dashboard/supplier-returns` | `SupplierReturnController`, `SupplierReturnService`, `SupplierReturn` |

Boundary penting:

- modul ini adalah jembatan antara inventory dan financial obligation
- perubahan status procurement seharusnya selalu dilihat sebagai workflow state machine, bukan CRUD biasa

### 8. Receivables and Payables

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Receivables | `/dashboard/receivables` | `ReceivableController`, `ReceivableService`, `Receivable`, `ReceivablePayment` |
| Payables | `/dashboard/payables` | `PayableController`, `PayableAgingService`, `Payable`, `PayablePayment` |
| Aging | `/dashboard/aging`, summary shared props | `AgingController`, `ReceivableService`, `PayableAgingService` |
| Customer/Supplier statement | dedicated routes + PDF documents | controllers + Blade PDF views |

Boundary penting:

- transaksi `pay_later` dan procurement flow memunculkan data keuangan lanjutan
- aging summary sudah dipakai di shared props, jadi perubahan query dapat berdampak global ke dashboard

### 9. CRM and Retention

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| CRM campaigns | `/dashboard/crm-campaigns` | `CrmCampaignController`, `CrmAutomationService`, `CustomerCampaign`, `CustomerCampaignLog` |
| CRM reminders | `/dashboard/crm-reminders` | `CrmReminderController`, command `crm:generate-reminders` |
| Segment sync | manual dan auto | `CustomerSegmentationService`, segment membership tables |
| Share from transaction/receivable | action route per domain | campaign creation yang idempotent |

Boundary penting:

- CRM saat ini berbasis log record dan context key agar proses share/reminder idempotent
- pengembangan fitur pesan WhatsApp/SMS/email berikutnya harus masuk lewat boundary campaign/log, bukan menempel langsung ke transaksi

### 10. Reports, Documents, and Observability

| Area | Route/Page | Komponen inti |
| --- | --- | --- |
| Sales report | `/dashboard/reports/sales` | `SalesReportController` |
| Profit report | `/dashboard/reports/profits` | `ProfitReportController` |
| Advanced insights | `/dashboard/reports/insights` | `AdvancedSalesInsightsController` |
| Audit logs | `/dashboard/audit-logs` | `AuditLogController`, `AuditLogService`, `AuditLog` |
| PDF documents | `/dashboard/documents/*` | `DocumentController`, Blade PDF templates |

## Peta Alur Bisnis

### Penjualan Reguler

1. Kasir membuka shift.
2. Resolver memilih outlet aktif.
3. POS membangun cart aktif untuk kombinasi kasir + outlet.
4. `PricingService` menghasilkan promo preview.
5. `LoyaltyService` menghitung voucher, redeem point, dan grand total final.
6. Checkout membentuk `Transaction`, `TransactionDetail`, profit, serta mutasi stok.
7. Jika item punya mapping station, sistem memecah item menjadi kitchen ticket per station.
8. Jika metode bayar kredit, sistem membentuk `Receivable`.
9. Invoice dapat dicetak, dibagikan publik, atau dijadikan campaign CRM.

Catatan implementasi:

- fallback backward compatibility ke `products.stock` masih dipertahankan,
- source of truth stok penjualan multi outlet diarahkan ke `product_outlet_stocks`.

### Dispatch Dapur

1. Produk dipetakan ke station seperti `minuman`, `ayam`, `salad`, `mie`, `ramen`, `steak`, `es-duren`, `sate`.
2. Saat checkout, item dipisah berdasarkan station di outlet aktif.
3. Sistem membuat satu ticket per station yang relevan.
4. Dapur yang tidak memiliki item di nota tersebut tidak menerima ticket.
5. Layar dapur atau printer station membaca ticket berdasarkan `kitchen_station_id` miliknya sendiri.

### Procurement Dasar

1. Admin membuat purchase order.
2. PO ditempatkan ke supplier.
3. Barang diterima lewat goods receiving.
4. Stok bertambah dan hutang supplier dapat terbentuk atau diperbarui.
5. Jika ada masalah vendor, supplier return melakukan koreksi operasional dan finansial.

### Kontrol Inventory

1. Produk berubah stok karena penjualan, receiving, return, atau stock opname.
2. `StockMutationService` harus menjadi jejak perubahan resmi.
3. Stock opname finalize menjadi mekanisme koreksi sistem ke stok fisik.

### CRM dan Retention

1. Customer diklasifikasikan lewat segment manual atau auto.
2. Reminder generator membuat campaign untuk due soon, overdue, repeat order, dan segment lain.
3. Campaign membentuk log per customer agar pengiriman dapat dilacak dan dibuat idempotent.

### Security dan Privileged Action

1. User masuk lewat auth flow yang sudah ditambah throttle/bot guard.
2. Route sensitif wajib permission spesifik.
3. Aksi yang sangat sensitif wajib `step_up`.
4. Akses data operasional ke depan harus selalu dibatasi oleh outlet aktif, bukan hanya role.

## Coding Standard Tambahan

- Semua query domain operasional baru wajib memikirkan `outlet_id` sejak awal.
- Stok baru tidak boleh menambah asumsi bahwa `products.stock` adalah satu-satunya source of truth.
- Workflow dapur tidak boleh broadcast ke semua station. Routing harus berbasis mapping produk ke station.
- Satu service transaksi bertanggung jawab atas split item per station; logic ini tidak boleh tercecer di controller atau komponen React.
- Dokumen cetak harus memakai profil outlet dari transaksi atau domain induknya, bukan setting global buta.
5. Event penting direkam ke audit log.

## Peta Kode untuk Developer

### Saat Menambah Modul Baru

Sentuh area berikut secara sadar:

1. migration dan model,
2. controller dan route permission,
3. page Inertia di `resources/js/Pages/Dashboard`,
4. service jika workflow lintas model,
5. test feature untuk happy path, authorization, dan side effect,
6. seeder permission jika modul punya gate baru,
7. dokumentasi modul di `docs/features/`.

### Saat Mengubah Workflow Sensitif

Checklist minimal:

1. cek apakah route perlu `permission:*`,
2. cek apakah aksi perlu `step_up`,
3. cek apakah perubahan perlu `DB::transaction()`,
4. cek apakah audit log harus ditulis,
5. cek dampak ke shared props Inertia,
6. cek apakah test SQLite akan tetap lolos.

### Saat Menyentuh POS

Perhatikan dependency tersembunyi berikut:

- shift aktif,
- stok produk,
- pricing preview,
- loyalty/voucher,
- payment gateway readiness,
- receivable creation,
- invoice share/public print,
- low stock notification.

## Milestone Map

### Milestone 0 — Foundation yang Sudah Ada

Status: sudah tersedia di repo.

- Auth, profile, RBAC, dashboard shell
- Categories, products, customers, suppliers
- POS checkout, print, payment gateway, transaction history
- Reports dasar, PDF documents

### Milestone 1 — Operational Core

Status: sudah terimplementasi dan perlu stabilisasi berkelanjutan.

- Cashier shift
- Stock opname
- Stock mutation
- Sales return
- Audit log
- Authorization consistency

Fokus improvement:

- kurangi logic berat di controller lama,
- rapikan state transition dan audit coverage,
- tambah test side effect untuk stok, profit, dan receivable/payable coupling.

### Milestone 2 — Backoffice Financial and Procurement

Status: sudah masuk repo, tetapi harus diperlakukan sebagai area yang masih berkembang.

- Receivables lifecycle
- Payables lifecycle
- Aging summary
- Purchase orders
- Goods receivings
- Supplier returns

Fokus improvement:

- perkuat state machine dokumen,
- pastikan integritas stok dan hutang/piutang,
- tambah test regresi untuk procurement end-to-end.

### Milestone 3 — Commercial Growth Engine

Status: fondasi sudah ada dan nilainya tinggi untuk diferensiasi produk.

- Pricing rules engine
- Loyalty membership, points, tiering
- Customer vouchers
- Customer segments
- CRM campaigns dan reminders
- Advanced sales insights

Fokus improvement:

- dokumentasikan rule precedence,
- perjelas boundary antara promo, voucher, dan loyalty,
- tambah observability untuk campaign execution dan pricing debug.

### Milestone 4 — Hardening and Scale

Status: sebagian baru ada di planning, belum menjadi fondasi matang di kode.

- multi outlet / multi warehouse,
- approval workflow,
- import/export toolkit,
- backup/restore,
- integrasi eksternal yang lebih luas,
- MFA dan security monitoring lanjutan.

Urutan prioritas disarankan:

1. stabilisasi module existing,
2. state machine dan transactional integrity,
3. observability dan audit depth,
4. scale features.

## Coding Standard

### Prinsip Umum

- Perlakukan repo ini sebagai sistem operasional bisnis, bukan CRUD app biasa.
- Setiap perubahan yang menyentuh uang, stok, hutang, piutang, shift, atau akses harus dianggap high-risk.
- Optimalkan konsistensi domain lebih dulu, baru kecepatan implementasi.

### Standard Backend

1. Route harus menjadi boundary authorization resmi.
2. Gunakan permission granular, jangan hanya mengandalkan hide/show tombol di frontend.
3. Gunakan `FormRequest` untuk input yang punya rule bisnis non-trivial.
4. Gunakan service untuk workflow lintas model atau lintas concern.
5. Gunakan `DB::transaction()` saat satu aksi menulis ke lebih dari satu aggregate penting.
6. Tulis audit log untuk aksi sensitif, state transition penting, dan perubahan yang sulit direkonstruksi dari data biasa.
7. Simpan nilai uang, stok, qty, dan poin sebagai integer.
8. Pakai eager loading pada halaman index/show yang memerlukan relasi untuk mencegah N+1.
9. Jangan letakkan business rule utama di Blade atau React; controller hanya mengorkestrasi.
10. Untuk modul baru, definisikan status/state secara eksplisit sejak awal.

### Standard Frontend

1. Halaman Inertia per modul harus berada di `resources/js/Pages/Dashboard/<Module>`.
2. Gunakan Ziggy `route()` untuk URL generation, jangan hardcode path string.
3. Permission check di UI harus memakai helper authorization yang sudah ada.
4. Pertahankan pemisahan antara page container, shared dashboard component, dan POS-specific component.
5. Data dari backend harus diperlakukan sebagai contract. Jika payload diubah, cek semua page yang mengonsumsi shared props atau response serupa.
6. Untuk workflow berat seperti POS, utamakan preview data dari backend daripada menduplikasi kalkulasi bisnis di React.
7. Notifikasi user gunakan pola yang sudah dipakai repo: `react-hot-toast` atau `sweetalert2`.

### Standard Testing

1. Setiap modul baru minimal punya feature test happy path.
2. Tambahkan test authorization untuk route permission penting.
3. Tambahkan test side effect untuk stok, profit, receivable, payable, loyalty point, atau audit log jika relevan.
4. Ingat bahwa test berjalan di SQLite in-memory; hindari asumsi MySQL-only tanpa fallback.
5. Untuk bug regresi, tambahkan test sebelum atau bersamaan dengan fix.

### Standard Dokumentasi

1. Jika modul baru menambah route dashboard, tambahkan ke `docs/features/` dan indeks dokumentasi.
2. Jika modul mengubah milestone produk, perbarui dokumen ini juga.
3. Jika implementasi aktual sudah melampaui roadmap di `planning/`, jangan biarkan planning menjadi sumber kebingungan baru.

## Definition of Done untuk Modul Baru

Sebuah modul dianggap layak merge jika:

1. route dan permission boundary jelas,
2. model dan migration mendukung workflow sebenarnya,
3. UI Inertia utama tersedia,
4. validasi request ada,
5. side effect kritis transactional,
6. test feature minimal tersedia,
7. audit/logging untuk aksi sensitif dipertimbangkan,
8. dokumentasi modul dan system map diperbarui bila ada perubahan boundary sistem.

## Rekomendasi Fokus Engineering Berikutnya

Prioritas paling sehat untuk repo ini:

1. refactor controller lama yang masih gemuk, terutama area POS dan transaksi,
2. rapikan state machine procurement, return, receivable, dan payable,
3. perkuat test end-to-end untuk coupling stok, profit, loyalty, dan finance,
4. perdalam auditability dan debugging untuk pricing, campaign, dan payment flow,
5. baru setelah itu dorong fitur scale seperti multi outlet atau approval workflow.
