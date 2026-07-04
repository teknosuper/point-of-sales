# Feature Index

Kembali ke indeks dokumentasi: `docs/README.md`

## Modul Inti

### POS & Transaksi

Modul kasir untuk membangun cart, hold/resume transaksi, checkout multi-metode pembayaran, dan cetak/share dokumen transaksi.

Dokumen: `docs/features/pos-transactions.md`

### Parking Flow Design

Desain modul parkir yang menyatu dengan transaksi POS, mendukung banyak kendaraan dalam satu nota, tetap terpisah dalam laporan, dan fleksibel untuk kasir maupun self order.

Dokumen: `docs/features/parking-flow-design.md`

### Manajemen Meja

Modul master meja dine in per outlet untuk dipakai pada transaksi makan di tempat.

Dokumen: `docs/features/dining-tables.md`

### Table Order QR

Modul self-order publik untuk meja yang baru diteruskan ke dapur setelah pembayaran tunai dikonfirmasi kasir.

Dokumen: `docs/features/table-order-qr.md`

### Customer & Wilayah

Modul customer mendukung CRUD dan data wilayah Indonesia sampai level desa, serta histori transaksi pelanggan.

Dokumen: `docs/features/customers-regions.md`

### Receivables

Modul piutang pelanggan untuk transaksi `pay_later`, termasuk pembayaran parsial, jatuh tempo, dan status piutang.

Dokumen: `docs/features/receivables.md`

### Payables & Suppliers

Modul supplier dan hutang supplier untuk pencatatan kewajiban ke vendor serta pelunasan hutang.

Dokumen: `docs/features/payables-suppliers.md`

### Inventory & Stock

Modul inventory saat ini mencakup produk, stock opname, dan stock mutation.

Dokumen: `docs/features/inventory-stock.md`

### Sales Returns

Modul retur penjualan untuk koreksi transaksi pasca-penjualan, termasuk restock, pengurangan profit, koreksi piutang, dan store credit.

Dokumen: `docs/features/sales-returns.md`

### Cashier Shifts

Modul shift kasir untuk membuka dan menutup shift, serta membatasi operasi transaksi yang memerlukan shift aktif.

Dokumen: `docs/features/cashier-shifts.md`

### Audit Logs

Modul observability untuk melihat perubahan penting yang dilakukan user pada fitur-fitur sensitif.

Dokumen: `docs/features/audit-logs.md`

### Settings & Payments

Modul konfigurasi yang mencakup payment settings, bank accounts, profil toko, dan target penjualan.

Dokumen: `docs/features/settings-payments.md`

### RBAC, Users, Roles

Modul akses dan administrasi user berbasis role dan permission.

Dokumen: `docs/features/rbac-users-roles.md`

### Reports & Documents

Modul laporan dan dokumen PDF/print untuk transaksi, receivables, dan payables.

Dokumen: `docs/features/reports-documents.md`
