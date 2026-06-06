# RBAC, Users, Roles

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Mengatur kontrol akses berbasis role dan permission untuk semua modul dashboard.

## Fitur Saat Ini

- user management
- role management
- permission list
- route protection dengan middleware permission
- permission map dibagikan ke frontend via Inertia

## Halaman dan Route

- `dashboard/users`
- `dashboard/roles`
- `dashboard/permissions`

## Permission Umum

Setiap modul memakai permission sendiri, contohnya:

- `transactions-access`
- `transactions-history-access`
- `products-stock-update`
- `kitchen-access`
- `kitchen-manage`
- `cashier-settlements-access`
- `cashier-settlements-approve`
- `business-settings-access`
- `business-settings-update`
- `sales-returns-*`
- `stock-opnames-*`
- `cashier-shifts-*`
- `audit-logs-access`

## Matriks Role Acuan

- `super-admin`: semua menu dan semua fitur.
- `admin-sistem`: dashboard, user, role, permission, audit, laporan, dan pengaturan sistem; tidak untuk POS operasional.
- `outlet-owner`: operasional outlet owner, settlement, laporan, produk, stok, promo, outlet, dan pengaturan bisnis.
- `admin-owner-outlet`: operasional outlet, produk, stok, dapur, laporan, settlement, dan pengaturan bisnis; tidak untuk RBAC sistem dan tidak default ke POS.
- `tenant-owner`: dashboard tenant, produk tenant, harga tenant, promo tenant, laporan tenant, dan profit tenant; tidak untuk kasir outlet.
- `tenant-operasional`: dashboard, produk, stok, dan mutasi stok tenant; tidak untuk promo, settlement, atau pengaturan sistem.
- `kitchen-operator`: dashboard, layar dapur, dan update stok operasional; tidak untuk POS, settlement, promo, atau pengaturan user.
- `tenant-petugas-antar`: dashboard dan papan antar tenant.
- `waiter`: dashboard dan papan antar.
- `cashier` / `kasir-operasional`: dashboard, POS, riwayat transaksi, pesanan meja, shift kasir, dan pelanggan.

Jika perlu role campuran, source of truth tetap kombinasi permission di database. Nama role preset hanya titik awal.

## Matriks Menu

| Role | Dashboard | Kasir | Riwayat | Papan Antar | Dapur | Produk | Stok | Promo | Laporan | Settlement | Pengguna | Role | Permission | Outlet/Tenant | Pengaturan Bisnis |
|------|-----------|-------|---------|-------------|-------|--------|------|-------|----------|------------|----------|------|------------|---------------|-------------------|
| `super-admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin-sistem` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `outlet-owner` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin-owner-outlet` | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `tenant-owner` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `tenant-operasional` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `kitchen-operator` / `operator-dapur` | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `waiter` / `petugas-antar` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `tenant-petugas-antar` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `cashier` / `kasir-operasional` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Alur Otorisasi

1. permission diseed di `PermissionSeeder`
2. role disusun di `RoleSeeder`
3. user default disusun di `UserSeeder`
4. route memakai middleware `permission:*`
5. frontend membaca map permission dari `HandleInertiaRequests`

## Catatan Super Admin

- user `super-admin` mendapat role `super-admin`
- backend memperlakukan role `super-admin` sebagai bypass permission yang konsisten untuk `can`, `canAny`, dan middleware Spatie
- seeder juga menyinkronkan permission ke user admin default
- cache permission Spatie harus di-reset saat seeding agar permission baru terbaca konsisten
- role lama `permission-access` dinormalisasi ke `permissions-access` saat seeding agar naming RBAC tidak ambigu

## Integrasi Frontend

Frontend membaca:

- `auth.permissions`
- `auth.super`

Ini dipakai untuk menampilkan atau menyembunyikan menu dan action tertentu.

Helper frontend utama:

- `resources/js/Utils/authorization.js`
- `resources/js/Utils/Permission.jsx`

## Batasan Saat Ini

- backend tetap menjadi sumber kebenaran utama
- frontend hanya untuk gating UI, bukan keamanan final

## File Sentral

- `database/seeders/PermissionSeeder.php`
- `database/seeders/RoleSeeder.php`
- `database/seeders/UserSeeder.php`
- `app/Http/Middleware/HandleInertiaRequests.php`
- `resources/js/Utils/Menu.jsx`
