# Parking Flow Design

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Dokumen ini merancang modul parkir yang:

- tetap menyatu dengan alur pembayaran POS
- bisa ikut dalam 1 nota bersama makanan/minuman
- mendukung 1 transaksi dengan lebih dari 1 kendaraan
- tetap punya laporan parkir terpisah
- fleksibel untuk transaksi kasir biasa dan self order
- tidak membuat bottleneck di pintu masuk karena tidak bergantung pada gate

## Ringkasan Konsep

Konsep utama yang direkomendasikan:

- parkir bukan `product` manual biasa
- parkir disimpan sebagai data operasional tersendiri di `parking_tickets`
- saat perlu ditagihkan, tiket parkir di-attach ke transaksi POS
- saat checkout selesai, tiket parkir ikut dianggap lunas
- detail parkir tetap bisa dicetak di nota dan dilaporkan terpisah

Dengan konsep ini:

- kasir tetap bekerja dari modul transaksi yang sudah ada
- 1 nota bisa berisi menu + banyak parkir
- laporan penjualan dan laporan parkir tidak tercampur mentah
- self order tetap bisa ringan karena parkir bisa di-attach belakangan oleh kasir

## Prinsip Desain

1. Source of truth parkir ada di tiket parkir, bukan di cart produk.
2. Pembayaran parkir tetap lewat transaksi POS agar closing kasir tetap sinkron.
3. Setiap karcis parkir harus bisa ditelusuri status dan transaksi pembayarnya.
4. Nomor operasional untuk petugas dan kasir harus pendek dan cepat diketik.
5. Nomor audit internal harus tetap unik, stabil, dan mudah dilacak di laporan.
6. Self order tidak boleh dipaksa menjadi sumber input parkir utama.

## Kebutuhan Operasional

Asumsi yang dipakai pada desain ini:

- tidak ada gate otomatis
- petugas pintu masuk membagikan karcis
- 1 customer atau 1 meja bisa membawa lebih dari 1 kendaraan
- parkir kadang dibayar bersamaan dengan makanan
- kasir adalah titik validasi paling aman
- outlet utama menjadi pengelola parkir, bukan tenant makanan

## Model Data

### Tabel Utama

Disarankan menambah tabel `parking_tickets`.

Field minimal:

- `id`
- `outlet_id`
- `transaction_id` nullable
- `ticket_code`
- `ticket_number`
- `vehicle_type`
- `plate_number` nullable
- `status`
- `base_fee`
- `additional_fee`
- `grand_total`
- `issued_at`
- `attached_at` nullable
- `paid_at` nullable
- `issued_by` nullable
- `cashier_id` nullable
- `notes` nullable
- `created_at`
- `updated_at`

### Makna Field

- `ticket_code`
  Kode operasional pendek yang dilihat petugas, customer, dan kasir.

- `ticket_number`
  Nomor unik audit internal untuk laporan, rekonsiliasi, dan pencarian backend.

- `status`
  Status hidup tiket parkir dari dibagikan sampai lunas.

- `transaction_id`
  Relasi ke transaksi POS ketika tiket parkir sudah menempel ke transaksi.

- `grand_total`
  Nominal final tiket parkir yang akan ditagihkan.

### Relasi

- `Transaction hasMany ParkingTicket`
- `ParkingTicket belongsTo Transaction`

Untuk integrasi nota, ada dua pendekatan:

### Pendekatan Rekomendasi

Tambahkan field kecil di `transaction_details`:

- `line_type` default `product`
- `parking_ticket_id` nullable

Keuntungan:

- parkir tampil sebagai line item nota
- total transaksi tetap memakai mesin yang sama
- struk dan print cukup menyesuaikan renderer detail yang sudah ada
- report parkir bisa dipisah dengan query `line_type = parking`

### Pendekatan Alternatif

Buat tabel pivot `transaction_parking_items`.

Pendekatan ini lebih rapi secara domain, tetapi patch awal lebih besar dan tidak perlu dipilih bila tujuan awal adalah implementasi bertahap yang cepat.

## Nomor Karcis

Jangan gunakan nomor audit panjang sebagai input utama kasir.

Gunakan dua identitas:

- `ticket_code` untuk operasional
- `ticket_number` untuk audit

Contoh:

- `ticket_code`: `M-0241`, `C-0088`
- `ticket_number`: `PK-20260702-000241`

Rekomendasi format:

- `M` untuk motor
- `C` untuk mobil
- `O` untuk kendaraan lain

Tujuan format pendek:

- mudah dibaca petugas
- cepat diketik kasir
- cocok untuk karcis fisik

Tujuan format audit:

- unik lintas hari
- mudah direkonsiliasi
- enak untuk pencarian di dashboard dan laporan

## Status Tiket

Status yang disarankan:

- `issued`
  Karcis sudah dibuat/dibagikan, belum menempel ke transaksi.

- `attached`
  Karcis sudah dimasukkan ke transaksi aktif, tetapi pembayaran belum final.

- `paid`
  Karcis sudah dibayar melalui checkout transaksi.

- `cancelled`
  Karcis dibatalkan secara operasional.

- `void`
  Opsional untuk tiket salah input atau dihapus dengan alasan khusus.

Aturan status:

- tiket `paid` tidak boleh dipakai lagi
- tiket `attached` tidak boleh dipakai di transaksi lain
- jika cart dibatalkan atau hold dibersihkan, tiket kembali ke `issued`
- perubahan dari `attached` ke `paid` hanya terjadi setelah checkout sukses

## Tarif Parkir

Tahap awal paling aman adalah tarif flat per jenis kendaraan.

Contoh:

- motor: Rp 2.000
- mobil: Rp 5.000
- lain: Rp 3.000 atau mengikuti pengaturan outlet

Disarankan konfigurasi di setting outlet:

- `parking_enabled`
- `parking_fee_motor`
- `parking_fee_car`
- `parking_fee_other`

Tahap lanjut:

- tarif bertingkat per durasi
- tarif event
- tarif member
- grace period
- lost ticket fee

Namun untuk implementasi pertama, flat fee lebih aman dan tidak memperlambat kasir.

## Flow Operasional Tanpa Gate

### Flow A: Kasir POS Biasa

Flow utama yang direkomendasikan:

1. admin atau supervisor generate batch tiket parkir
2. petugas pintu masuk membagikan karcis fisik ke kendaraan
3. customer makan atau bertransaksi seperti biasa
4. saat akan membayar, kasir membuka transaksi POS
5. kasir input satu atau lebih `ticket_code`
6. sistem validasi tiket parkir
7. sistem attach tiket ke transaksi aktif
8. line parkir muncul di cart
9. customer membayar total makanan + parkir
10. checkout sukses mengubah tiket menjadi `paid`
11. struk mencetak item makanan dan item parkir

### Flow B: Self Order

Self order tidak disarankan menjadi titik input utama parkir.

Flow yang direkomendasikan:

1. customer membuat order dari self order seperti biasa
2. order tetap berjalan dengan flow modul self order yang ada
3. saat finalisasi tunai di kasir atau saat order akan dilunasi, kasir attach tiket parkir ke transaksi hasil self order
4. kasir menagihkan total makanan + parkir dalam satu pembayaran
5. tiket parkir menjadi `paid` saat transaksi final selesai

Keuntungan:

- customer tidak dibebani input data parkir
- mengurangi salah input karcis
- lebih aman untuk kondisi 1 order berisi banyak kendaraan

### Flow C: Self Order dengan Input Parkir Opsional

Ini fleksibel, tetapi tidak disarankan untuk fase awal.

Jika diaktifkan, flow-nya:

1. customer pesan menu
2. customer opsional klik `Tambah Parkir`
3. customer input `ticket_code`
4. sistem validasi tiket
5. tiket masuk ke draft order
6. kasir tetap bisa review sebelum final payment

Syarat agar flow ini aman:

- kode karcis pendek
- validasi cepat
- tiket yang sudah terpasang ke draft harus dilepas otomatis jika draft expired/cancelled

## Boundary Self Order

Agar fleksibel tetapi tidak merusak UX customer, gunakan tiga level dukungan:

### Level 1

- self order tidak menampilkan parkir
- kasir attach parkir saat pembayaran

Ini level paling aman untuk implementasi awal.

### Level 2

- self order menampilkan parkir sebagai fitur opsional
- kasir tetap bisa edit dan validasi akhir

Ini cocok bila customer sudah terbiasa dan beban support rendah.

### Level 3

- self order benar-benar mendukung attach parkir penuh
- termasuk handling expired draft, conflict, dan detach otomatis

Ini hanya disarankan setelah flow kasir stabil.

## UX Kasir

Di halaman transaksi, tambahkan blok kecil:

- input `Kode Karcis`
- tombol `Tambah Parkir`
- daftar tiket parkir yang sudah attached

Contoh tampilan daftar:

- `M-0241 | Motor | Rp 2.000`
- `C-0088 | Mobil | Rp 5.000`

Tindakan yang perlu didukung:

- tambah tiket
- hapus tiket dari cart
- lihat status tiket
- lihat kendaraan/plat jika ada

Jangan tampilkan parkir sebagai card produk di grid produk utama karena itu akan membuat parkir tampak seperti item bebas dan rawan salah input.

## UX Petugas Pintu Masuk

Agar tidak jadi bottleneck, petugas tidak wajib berinteraksi dengan layar setiap kendaraan masuk.

Flow paling ringan:

- supervisor generate batch tiket
- petugas ambil karcis fisik
- petugas serahkan karcis ke customer
- pencatatan utama dilakukan saat kasir attach tiket

Tahap lanjut jika dibutuhkan:

- petugas punya halaman kecil untuk menandai tiket yang benar-benar keluar dari pool
- petugas bisa isi `plate_number`
- petugas bisa memilih `vehicle_type`

Namun semua itu opsional pada fase awal.

## Integrasi ke Cart dan Checkout

### Saat Attach

Saat kasir memasukkan `ticket_code`:

1. cari `parking_tickets` berdasarkan outlet aktif dan kode
2. pastikan status masih `issued`
3. pastikan belum punya `transaction_id`
4. isi `transaction_id`
5. set `status = attached`
6. set `attached_at = now()`
7. buat line detail transaksi:
   - `line_type = parking`
   - `parking_ticket_id = ...`
   - `qty = 1`
   - `price = grand_total`
   - label seperti `Parkir Motor [M-0241]`

### Saat Detach

Jika tiket parkir dihapus dari cart:

1. hapus line detail parkir
2. kosongkan `transaction_id`
3. set `status = issued`
4. kosongkan `attached_at`

### Saat Checkout Sukses

Semua tiket parkir yang attached pada transaksi:

- `status = paid`
- `paid_at = now()`
- `cashier_id = cashier transaksi`

### Saat Cart Dibatalkan

Jika transaksi gagal, cart dibersihkan, atau order tidak jadi:

- tiket yang masih `attached` harus dikembalikan ke `issued`

## Integrasi ke Struk

Parkir harus tercetak jelas di nota.

Opsi tampilan:

- tampil sebagai line item biasa
- atau dibuat section kecil khusus parkir

Contoh label:

- `Parkir Motor [M-0241]`
- `Parkir Mobil [C-0088]`

Keuntungan:

- petugas keluar mudah memeriksa kendaraan yang sudah dibayar
- customer paham parkir masuk ke tagihan
- audit nota lebih mudah

## Integrasi ke Laporan

Laporan parkir harus bisa dipisah dari penjualan produk biasa walaupun dibayar pada transaksi yang sama.

### Sumber Data

Jangan mengandalkan `products`.

Gunakan:

- `parking_tickets`
- `transaction_details.line_type = parking`
- `transactions`

### Laporan Minimal

- total karcis dibayar
- total pendapatan parkir
- jumlah kendaraan per jenis
- pendapatan per jenis kendaraan
- pendapatan per kasir
- pendapatan per outlet
- daftar karcis harian

### Laporan Tambahan

- tiket masih `issued` hari ini
- tiket `attached` yang belum dilunasi
- tiket `cancelled`
- tiket conflict/void
- perbandingan parkir vs omzet F&B

### Sales Report Utama

Boleh menampilkan ringkasan kecil:

- `Pendapatan Parkir`
- `Jumlah Karcis Dibayar`

Tetapi detail penuh tetap lebih baik di tab atau halaman report parkir tersendiri.

## Boundary Outlet dan Tenant

Parkir disarankan berada di outlet utama, bukan pada tenant.

Aturannya:

- `parking_tickets.outlet_id` mengikuti outlet aktif utama
- parkir tidak dibagi ke tenant outlet
- jika transaksi berisi item tenant + parkir, parkir tetap dihitung sebagai hak outlet utama

Ini penting agar:

- laporan tenant tidak tercampur pendapatan parkir
- settlement tenant tidak ikut menghitung parkir
- owner markup dan revenue tenant tetap bersih

## Permission dan Keamanan

Permission yang disarankan:

- `parking-access`
- `parking-create`
- `parking-manage`
- `parking-report-access`

Langkah sensitif yang bisa dipertimbangkan memakai `step_up`:

- void tiket parkir
- ubah nominal parkir manual
- regenerate batch tiket
- ubah tiket yang sudah `paid`

Jika attach parkir diletakkan di halaman kasir biasa, tetap hormati middleware `active_shift` seperti transaksi POS lain.

## Risiko Operasional

Risiko utama:

- tiket dipakai dua kali
- tiket attached ke draft yang tidak pernah selesai
- tiket terlanjur paid tetapi transaksi batal
- kasir salah input kode
- parkir ikut masuk ke laporan tenant

Mitigasi:

- status tiket harus ketat
- attach harus atomic
- detach saat cart batal harus otomatis
- checkout success harus menjadi satu-satunya jalan ke `paid`
- laporan parkir dibangun dari line type dan tiket parkir, bukan dari produk

## Tahap Implementasi yang Disarankan

### Tahap 1

- buat `parking_tickets`
- buat batch generator tiket
- attach/detach tiket di kasir POS
- parkir ikut tercetak di struk
- report parkir dasar

### Tahap 2

- tambah summary parkir di sales report
- tambah filter per kendaraan, kasir, outlet
- tambah pencatatan `plate_number`

### Tahap 3

- dukungan self order opsional
- auto-release tiket pada draft expired
- tarif lanjutan

## Struktur Teknis yang Disarankan

### Migration

- `create_parking_tickets_table`
- `add_parking_fields_to_transaction_details_table`

### Model

- `App\Models\ParkingTicket`

### Service

- `App\Services\ParkingTicketService`

Tanggung jawab service:

- generate batch tiket
- validasi attach
- attach tiket ke transaksi/cart
- detach tiket
- finalize paid state
- release tiket saat transaksi batal

### Controller / Route

Pendekatan minimal:

- tambahkan endpoint attach/detach parkir pada boundary transaksi kasir yang sudah ada

Pendekatan lebih bersih:

- buat controller kecil khusus parkir operasional

### Frontend

- tambah panel parkir di halaman transaksi
- tampilkan tiket parkir pada list cart
- tampilkan error validasi yang jelas bila tiket tidak valid

### Reporting

- tab atau halaman baru `Parking Report`
- boleh ditautkan dari halaman sales report

## Keputusan yang Direkomendasikan

Jika ingin implementasi yang lengkap dan fleksibel tetapi tetap aman untuk fase awal, pilih keputusan berikut:

- gunakan `parking_tickets` sebagai source of truth
- attach parkir ke transaksi POS, bukan membuat product parkir manual
- simpan parkir sebagai line item transaksi dengan penanda khusus
- mulai dari flow kasir, bukan self order
- self order hanya support attach parkir oleh kasir pada tahap awal
- pisahkan laporan parkir dari penjualan produk biasa

## Hal yang Sebaiknya Dihindari

- parkir dijadikan product biasa yang bisa dipilih bebas dari grid
- parkir dihitung hanya dari nama produk tanpa tiket
- self order langsung mewajibkan customer input parkir
- tenant report ikut memuat pendapatan parkir
- nomor karcis audit yang panjang dijadikan input wajib kasir

## Penutup

Desain ini sengaja menempatkan parkir sebagai modul operasional yang dekat dengan transaksi POS, tetapi tetap punya boundary data dan laporan sendiri. Dengan pola ini, sistem tetap fleksibel untuk:

- transaksi kasir biasa
- 1 nota dengan banyak kendaraan
- pembayaran parkir bersama makanan
- pengembangan self order di tahap berikutnya
- ekspansi laporan parkir tanpa merusak laporan penjualan yang sudah ada
