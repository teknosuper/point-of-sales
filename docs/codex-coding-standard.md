# Codex Coding Standard

Kembali ke indeks dokumentasi: `docs/README.md`

Dokumen ini menetapkan standar kerja saat Codex mengerjakan repo Point of Sales agar:

- hemat token,
- cepat menemukan sumber masalah,
- menghasilkan patch kecil dan konsisten,
- menjaga kualitas implementasi Laravel + Inertia + React.

Dokumen ini bukan coding style umum PHP atau React. Fokusnya adalah standar operasional Codex saat membaca kode, mengambil konteks, mengubah file, dan menutup task.

## Tujuan Utama

Codex harus mengoptimalkan empat hal sekaligus:

1. akurasi perubahan,
2. efisiensi token,
3. konsistensi pola repo,
4. risiko regresi serendah mungkin.

Jika harus memilih, prioritaskan:

1. kebenaran domain,
2. patch kecil yang aman,
3. konsumsi konteks minimum,
4. kecepatan eksekusi.

## Prinsip Kerja Inti

### 1. Baca sesedikit mungkin, tetapi cukup untuk benar

- jangan scan seluruh repo
- jangan buka file besar penuh jika cukup baca cuplikan relevan
- jangan baca semua markdown jika task hanya menyentuh satu modul
- gunakan urutan baca tetap agar token tidak boros

Urutan baca default:

1. `routes/web.php` atau `routes/api.php`
2. controller terkait
3. request validation bila ada
4. service terkait
5. model/query yang benar-benar dipakai flow
6. page Inertia atau komponen React terkait
7. test paling dekat
8. dokumentasi fitur hanya jika perlu klarifikasi

### 2. Prioritaskan kode aktif di atas dokumentasi

- jika dokumentasi, planning, dan kode berbeda, percaya kode aktif
- dokumentasi dipakai untuk orientasi, bukan sumber kebenaran final
- jika ada area transisi, verifikasi implementasi aktual sebelum membuat asumsi

### 3. Patch sekecil mungkin

- ubah titik akar masalah terdekat
- hindari refactor luas jika bug bisa selesai dengan perubahan lokal
- jangan pindahkan pola existing ke abstraction baru tanpa kebutuhan nyata
- jangan menyentuh file yang tidak relevan hanya demi kerapian

### 4. Kualitas lebih penting daripada banyak perubahan

- satu patch kecil yang tepat lebih baik daripada beberapa perubahan spekulatif
- perubahan harus menjaga boundary modul yang sudah ada
- setiap edit harus punya alasan yang dapat dijelaskan singkat

## Standar Pengambilan Konteks

### Wajib cek pada hampir semua task

- middleware route
- permission Spatie
- `active_shift` untuk flow transaksi
- `outlet_id` atau konteks outlet aktif
- shared props di `HandleInertiaRequests`
- side effect ke stok, receivable, payable, loyalty, kitchen, atau audit log bila relevan

### Wajib cek untuk task transaksi dan stok

- `Transaction` sebagai pusat relasi
- `product_outlet_stocks` sebagai arah source of truth stok
- `products.stock` sebagai fallback transisi
- mutasi stok atau trail audit setelah perubahan data

### Wajib cek untuk task report

- isolasi outlet
- filter periode
- sumber agregasi
- join atau relasi yang berpotensi bocor lintas outlet

### Wajib cek untuk task frontend

- page entry di `resources/js/Pages/Dashboard`
- komponen pendukung terdekat
- Ziggy `route()`
- shared props Inertia sebelum menyimpulkan bug UI
- jangan memindahkan business rule backend ke frontend

## Aturan Efisiensi Token

### Lakukan

- gunakan `rg` untuk mencari file atau string
- baca cuplikan file dengan `sed -n`
- fokus pada satu flow sampai akar masalah jelas
- gunakan istilah domain repo yang konsisten
- ringkas jawaban ke hasil, risiko, dan verifikasi
- jalankan test paling sempit yang membuktikan perubahan

### Hindari

- membuka banyak file sekaligus tanpa hipotesis
- membaca seluruh folder `docs/` atau `planning/`
- memberi banyak opsi jika satu opsi terbaik sudah jelas
- menjelaskan ulang isi repo secara panjang setiap task
- menjalankan full test suite jika satu feature test sudah cukup
- refactor oportunistik di luar scope

## Aturan Perubahan Kode

### Backend Laravel

- mulai dari route surface dan middleware aktif
- business logic lintas model tetap di service bila pola repo sudah begitu
- validasi tetap di request atau controller sesuai pola existing
- jaga compatibilitas transisi multi-outlet dan stok
- pertimbangkan audit log pada aksi sensitif

### Frontend Inertia + React

- pertahankan boundary page utama dan komponen pendukung
- gunakan token Tailwind existing: `primary`, `accent`, `success`, `warning`, `danger`
- gunakan Ziggy `route()` untuk endpoint
- jangan duplikasi validasi domain yang sudah benar di backend
- jangan ubah struktur UI besar jika task hanya bugfix kecil

### Database dan Query

- jangan asumsi query global aman; cek outlet isolation
- jangan tambahkan query baru jika relasi existing sudah cukup
- hati-hati pada fallback lama yang masih dipakai untuk kompatibilitas

## Standar Review Sebelum Menyimpulkan Selesai

Sebelum menutup task, cek cepat:

- apakah permission tetap benar
- apakah `active_shift` ikut terjaga
- apakah outlet isolation aman
- apakah side effect stok benar
- apakah kitchen atau tenant allocation terdampak
- apakah shared props Inertia perlu ikut diperbarui
- apakah test sempit sudah cukup membuktikan perubahan

## Definition of Done Untuk Codex

Task dianggap selesai jika:

1. akar masalah atau kebutuhan fitur sudah ditangani di titik yang tepat,
2. patch mengikuti pola repo yang ada,
3. risiko utama sudah dicek,
4. verifikasi dijalankan pada level yang masuk akal,
5. jawaban akhir ringkas dan fokus ke outcome.

## Template Prompt Standar

Gunakan prompt ini sebagai baseline saat membuka sesi baru:

```md
Kerja di repo Point of Sales berbasis Laravel 12 + Inertia.js 2 + React 18.

Tujuan utama:
- gunakan konteks minimum yang cukup akurat
- prioritaskan kode aktif dibanding dokumentasi
- buat patch sekecil mungkin
- jaga kualitas domain, permission, outlet isolation, dan side effect

Urutan baca:
- route
- controller
- request bila ada
- service
- model/query relevan
- page/component terkait
- test terdekat

Wajib waspada pada:
- `permission`
- `active_shift`
- `outlet_id`
- shared props Inertia
- `product_outlet_stocks` vs `products.stock`
- kitchen dispatch
- receivable/payable/loyalty/audit log side effect

Aturan output:
- jangan scan repo berlebihan
- jangan refactor di luar scope
- jangan baca semua markdown tanpa alasan
- jawab singkat: perubahan, risiko, verifikasi
```

## Template Prompt Per Jenis Task

### Bugfix

```md
Cari route dan flow yang rusak. Verifikasi middleware, permission, `active_shift`, outlet context, service, query, shared props, dan fallback transisi. Perbaiki di akar masalah terdekat dengan patch kecil tanpa refactor luas.
```

### Fitur Baru

```md
Tambahkan fitur di boundary modul existing. Tentukan route, permission, controller, service, validation, page, dan test yang relevan. Cek outlet-awareness, audit log, dan side effect transaksi atau stok sebelum coding.
```

### Frontend

```md
Mulai dari page Inertia, lalu komponen pendukung. Gunakan Ziggy `route()` dan token Tailwind existing. Jangan pindahkan business rule backend ke frontend. Jika data salah, cek shared props dan payload controller lebih dulu.
```

### Backend

```md
Mulai dari route, middleware, controller, request, service, model/query, lalu test. Pertahankan pola service existing. Verifikasi permission, `active_shift`, `outlet_id`, audit log, dan side effect ke transaksi, stok, receivable, payable, kitchen, atau loyalty.
```

### Review

```md
Review dengan fokus pada bug, regression, permission leak, outlet isolation, query salah, side effect finance/inventory/kitchen, dan gap test. Tampilkan temuan paling penting dulu. Hindari ringkasan panjang.
```

## Prompt Satu Baris Paling Hemat

```md
Gunakan konteks minimum, baca route -> controller -> service -> page -> test, prioritaskan kode aktif, cek `permission`/`active_shift`/`outlet_id`/shared props, dan buat patch sekecil mungkin.
```
