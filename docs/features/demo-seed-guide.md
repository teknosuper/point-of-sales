# Demo Seed Guide

Dokumen ini menjelaskan data demo yang dihasilkan oleh `DemoInitialSetupSeeder` agar aplikasi siap dipresentasikan tanpa setup manual panjang.

## Jalankan Seed Demo

Urutan paling aman:

```bash
php artisan migrate
php artisan db:seed --class=DemoInitialSetupSeeder
```

Jika ingin ulang seluruh data bawaan + demo:

```bash
php artisan migrate --seed
```

## Kredensial Demo

Semua akun demo menggunakan password:

```text
password
```

Daftar akun:

- `admin.demo@gmail.com` — admin demo program
- `supervisor.demo@gmail.com` — supervisor outlet
- `cashier.foodcourt@gmail.com` — kasir foodcourt
- `cashier.retail@gmail.com` — kasir retail
- `kitchen.minuman@gmail.com` — user dapur minuman
- `kitchen.ayam@gmail.com` — user dapur ayam
- `kitchen.sate@gmail.com` — user dapur sate
- `kitchen.salad@gmail.com` — user dapur salad/snack

## Data yang Dibuat

### Outlet & Tenant

- 1 outlet utama/default
- 4 tenant foodcourt demo:
  - Tenant Minuman Demo
  - Tenant Ayam Demo
  - Tenant Sate Demo
  - Tenant Snack Demo

### Station Dapur

- Minuman
- Ayam
- Sate
- Salad

### Device Dapur

Contoh profile yang dibuat:

- browser/tablet queue
- Android RawBT
- QZ Tray
- Local Print Bridge
- fallback printer contoh pada jalur ayam

### Produk Demo

Produk demo foodcourt yang dipetakan ke tenant dan station, misalnya:

- Es Teh Manis Foodcourt
- Kopi Susu Arena Demo
- Ayam Bakar Sambal Matah
- Nasi Ayam Bakar Komplit
- Sate Ayam 10 Tusuk
- Salad Buah Mini

### Customer Demo

- member loyalti aktif
- customer terdaftar biasa
- customer corporate untuk simulasi piutang

### Transaksi Demo

- `DEMO-FOODCOURT-001`
  - multi-tenant
  - membentuk allocation tenant
  - membentuk kitchen ticket
- `DEMO-RETAIL-MEMBER-001`
  - transaksi member retail
- `DEMO-INVOICE-AR-001`
  - transaksi invoice / piutang
- `DEMO-WALKIN-001`
  - transaksi walk-in

### Keuangan Demo

- receivable demo untuk customer corporate
- payable demo untuk supplier
- settlement tenant demo:
  - ada yang settled
  - ada yang outstanding

### Printer / Kitchen Demo

- print job dengan status campuran:
  - `success`
  - `queued`
  - `failed`

## Halaman yang Disarankan untuk Demo

### Admin

- `/dashboard`
- `/dashboard/outlets`
- `/dashboard/settings/kitchen-devices`
- `/dashboard/reports/outlet-analytics`
- `/dashboard/reports/sales`
- `/dashboard/reports/insights`
- `/dashboard/reports/setup-audit`
- `/dashboard/guides/pwa-setup`

### Cashier

- `/dashboard/transactions`
- `/dashboard/transactions/history`
- `/dashboard/cashier-shifts`

### Kitchen

- `/kitchen-login`
- `/dashboard/kitchen`

## Skenario Demo Cepat

1. Login sebagai `admin.demo@gmail.com`
2. Tunjukkan outlet, tenant, kitchen station, dan printer/device
3. Buka laporan tenant settlement dan analytics
4. Login sebagai `cashier.foodcourt@gmail.com`
5. Buka POS dan checkout produk tenant berbeda
6. Login sebagai salah satu user dapur melalui `/kitchen-login`
7. Tunjukkan queue dapur / mode kiosk / riwayat print job

## Catatan Kompatibilitas

Seeder ini dirancang agar tetap berjalan walau migration `preferred_workspace` pada tabel `users` belum diterapkan. Jika migration workspace dapur sudah dijalankan, akun dapur akan otomatis memiliki station default.
