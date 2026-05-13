# Manajemen Meja

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Modul ini dipakai untuk mengelola daftar meja dine in per outlet aktif agar POS bisa memilih meja saat transaksi makan di tempat.

## Route / Halaman

- `/dashboard/dining-tables`

## Permission

- `dining-tables-access`
- `dining-tables-create`
- `dining-tables-update`
- `dining-tables-delete`

## Boundary Implementasi

- setiap meja terikat ke `outlet_id`
- nama meja unik per outlet
- kode meja boleh kosong, tetapi jika diisi harus unik per outlet
- hanya meja dengan status `active` yang muncul di POS
- transaksi `dine_in` mewajibkan pemilihan meja aktif pada outlet yang sama

## Relasi Penting

- model: `App\Models\DiningTable`
- transaksi: `transactions.table_id`
- POS: `TransactionController@index` mengirim `diningTables` ke halaman transaksi

## Catatan Operasional

- menghapus meja akan ditolak jika meja tersebut sudah pernah dipakai transaksi
- status `inactive` menyembunyikan meja dari POS tanpa menghapus histori transaksi lama
