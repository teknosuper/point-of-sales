# Panduan Outlet, Tenant, dan Kitchen

Dokumen ini ditujukan untuk admin dan developer yang ingin memahami perbedaan antara:

- `Outlet & Tenant`
- `Kitchen Ops & Printer`
- `Statistik Outlet & Tenant`

## Ringkasan Cepat

- `Outlet & Tenant`
  dipakai untuk struktur bisnis: outlet utama, tenant foodcourt, warehouse, komisi, dan assignment user.
- `Kitchen Ops & Printer`
  dipakai untuk operasional dapur: station, layar kitchen, printer thermal, driver, endpoint, template, dan health check device.
- `Statistik Outlet & Tenant`
  dipakai untuk membaca angka: transaksi, revenue, payout tenant, settlement, dan performa outlet.

## Kapan Masuk ke Menu yang Mana

### Gunakan `Outlet & Tenant` jika ingin:

- membuat outlet baru
- membuat tenant foodcourt
- membuat warehouse atau lokasi support
- mengatur outlet default
- mengatur user yang terhubung ke outlet
- mengatur komisi tenant
- melihat detail ownership dan performa satu outlet

### Gunakan `Kitchen Ops & Printer` jika ingin:

- membuat station dapur seperti `minuman`, `ayam`, `salad`, `grill`
- menentukan station berada di outlet mana
- menambah layar kitchen, printer thermal, atau tablet
- mengatur `driver`, `endpoint`, `paper width`, `template print`, `copy`
- melakukan `health check` atau `test device`

### Gunakan `Statistik Outlet & Tenant` jika ingin:

- melihat omzet outlet
- melihat performa tenant
- melihat payout tenant
- melihat angka settlement
- fokus ke satu outlet atau tenant tertentu lewat filter

## Arti Tipe Outlet

### `main`

Outlet utama yang biasanya menjadi pusat transaksi kasir dan bisa menaungi tenant foodcourt.

### `tenant`

Tenant penjualan di foodcourt. Pendapatannya bisa dipisah melalui `transaction_tenant_allocations`.

### `warehouse`

Lokasi stok atau support yang tidak difokuskan untuk penjualan tenant langsung.

## Alur Setup yang Disarankan

1. Buat `main outlet` lebih dulu.
2. Jika model bisnis foodcourt, buat tenant-tenant sebagai outlet bertipe `tenant`.
3. Assign user ke outlet yang relevan.
4. Atur `commission_rate_percent` bila tenant memakai pola bagi hasil.
5. Masuk ke `Kitchen Ops & Printer`.
6. Buat station dapur untuk outlet yang dipakai operasional.
7. Tambahkan device untuk tiap station.
8. Atur produk agar tenant outlet dan kitchen station-nya sesuai.
9. Uji transaksi di POS.
10. Verifikasi ticket masuk ke `Kitchen Queue`.
11. Verifikasi pendapatan tenant muncul di settlement dan statistik.

## Contoh Skenario

### 1. Satu toko, banyak dapur

- cukup pakai satu `main outlet`
- buat banyak station dapur di outlet itu
- contoh: `minuman`, `ayam`, `salad`

### 2. Foodcourt, satu kasir, banyak tenant

- buat satu `main outlet` untuk kasir utama
- buat tenant-tenant sebagai outlet tipe `tenant`
- produk diarahkan ke tenant yang sesuai
- satu nota bisa menghasilkan alokasi pendapatan per tenant

### 3. Gudang support

- buat outlet tipe `warehouse`
- gunakan untuk konteks stok atau support
- jangan pakai sebagai tenant penjualan jika bukan fungsinya

## Navigasi yang Disarankan

- mulai dari `Dashboard`, lalu cek `Checklist Setup Outlet, Tenant & Kitchen`
- dari `Outlet & Tenant`, gunakan tombol:
  - `Detail`
  - `Kitchen Ops`
  - `Statistik`
- dari detail outlet, gunakan shortcut:
  - `Kitchen Ops & Printer Outlet Ini`
  - `Statistik Outlet Ini`
- dari `Kitchen Ops & Printer`, pilih outlet dulu agar konteks device jelas
- dari `Statistik Outlet & Tenant`, pakai filter outlet jika ingin fokus ke satu entitas

## Catatan Operasional

- `Outlet & Tenant` tidak dipakai untuk membuat printer
- `Kitchen Ops & Printer` tidak dipakai untuk membuat tenant
- `Statistik Outlet & Tenant` tidak dipakai untuk mengatur station dapur
- `Kitchen Queue` adalah layar operasional ticket, bukan halaman setup outlet

## Referensi Terkait

- `docs/system-map.md`
- `planning/laravel-revamp-progress.md`
