# Codex Prompts

Prompt ringkas untuk membantu Codex cepat memahami repo ini, tetap akurat, dan hemat token.

## Master Prompt

```md
Kerja di repo Point of Sales berbasis Laravel 12 + Inertia.js 2 + React 18.

Pahami ini sebagai sistem POS operasional multi-modul, bukan POS sederhana. Area utama: transaksi, shift, inventory, sales return, receivable, payable, supplier, loyalty, CRM, RBAC, audit log, multi-outlet, kitchen dispatch, dan fondasi foodcourt multi-tenant.

Aturan kerja:
- jangan scan seluruh repo
- mulai dari `routes/web.php`, lalu controller, service, page, dan test yang paling relevan
- prioritaskan kode aktif jika berbeda dengan dokumentasi
- anggap `Transaction` sebagai pusat flow bisnis
- anggap `product_outlet_stocks` sebagai arah source of truth stok; `products.stock` masih fallback
- selalu cek `permission`, `active_shift`, `outlet_id`, dan shared props Inertia
- buat patch sekecil mungkin, ikuti pola existing, jangan refactor di luar scope
- jawab singkat: hasil, risiko, verifikasi
```

## Session Starter

```md
Gunakan konteks minimum. Mulai dari route, controller, service, page, dan test yang paling relevan. Prioritaskan kode aktif. Waspadai isolasi outlet, `active_shift`, shared props Inertia, dan transisi `product_outlet_stocks` vs `products.stock`.
```

## Prompt Sistem Penuh

```md
Bentuk peta mental repo ini secara ringkas:
- stack: Laravel, Inertia, React, Tailwind, Spatie Permission
- route surface: `routes/web.php`, `routes/api.php`, `routes/auth.php`
- backend utama: `app/Http/Controllers/Apps`, `app/Http/Controllers/Reports`, `app/Services`
- frontend utama: `resources/js/Pages/Dashboard`
- shared app context: `HandleInertiaRequests`

Anggap sistem ini sedang transisi ke multi-outlet, outlet-aware stock, kitchen dispatch per station, dan tenant allocation. Jika ada konflik antara dokumen dan kode, prioritaskan kode aktif.
```

## Bugfix Prompt

```md
Fokus bugfix. Temukan route, controller, service, page, dan test terkait. Cari akar masalah paling dekat. Cek lebih dulu: `permission`, `active_shift`, `outlet_id`, shared props, query outlet-aware, dan fallback lama. Perbaiki dengan patch kecil tanpa refactor luas.
```

## Fitur Baru Prompt

```md
Fokus fitur baru. Tempatkan fitur dalam boundary modul yang sudah ada. Tentukan route, controller, service, validation, page, dan permission yang sesuai. Cek apakah fitur perlu `step_up`, `active_shift`, audit log, atau `outlet_id`. Jika menyentuh transaksi atau stok, cek dampak lintas modul sebelum implementasi.
```

## Frontend Prompt

```md
Fokus frontend Inertia + React. Mulai dari `resources/js/Pages/Dashboard`, lalu komponen pendukungnya. Gunakan Ziggy `route()`. Ikuti token Tailwind existing. Jangan pindahkan business rule backend ke frontend. Jika data tampak salah, cek shared props Inertia sebelum mengubah UI.
```

## Backend Prompt

```md
Fokus backend Laravel. Urutan baca: route, middleware, controller, request, service, model/query, test. Letakkan business logic lintas model di service bila sesuai pola repo. Verifikasi permission, `active_shift`, `outlet_id`, audit log, dan side effect ke transaksi, stok, receivable, payable, loyalty, atau report.
```

## Report Prompt

```md
Fokus report atau query agregasi. Asumsi risiko utama adalah kebocoran data lintas outlet. Cek filter `outlet_id`, period filter, join, relasi agregasi, dan fallback global lama. Jika menyangkut tenant, loyalty, receivable, payable, atau profit, verifikasi sumber datanya benar.
```

## Review Prompt

```md
Lakukan review dengan fokus bug, regression, permission leak, outlet isolation, query salah, side effect finance/inventory, dan gap test. Tampilkan temuan paling penting dulu. Jangan habiskan token untuk pujian atau ringkasan panjang.
```

## Token Saving Prompt

```md
Gunakan konteks minimum yang cukup akurat.
- jangan scan seluruh repo
- baca hanya file paling relevan
- gunakan urutan route -> controller -> service -> page -> test
- jangan baca semua markdown
- jangan ulangi pertanyaan user
- jangan beri banyak opsi jika satu solusi terbaik sudah cukup
- jangan refactor di luar scope
- jangan jalankan test penuh jika cukup test sempit
- ringkas jawaban ke hasil, risiko, verifikasi
```

## Prompt Area Transisi

```md
Anggap area ini rawan salah asumsi: multi-outlet, `product_outlet_stocks` vs `products.stock`, loyalty tier outlet vs global, kitchen dispatch, tenant allocation, report outlet-aware, dan route model binding sensitif. Verifikasi implementasi aktual sebelum mengubah kode. Jaga backward compatibility jika tidak ada alasan kuat untuk memutusnya.
```

## Fast Start Packs

### Fast Start Umum

```md
Pahami repo ini sebagai sistem POS multi-modul yang sedang transisi ke multi-outlet, kitchen dispatch, dan tenant allocation. Mulai dari route, controller, service, page, dan test yang paling relevan. Cek `permission`, `active_shift`, `outlet_id`, shared props, dan fallback lama. Buat patch sekecil mungkin.
```

### Fast Start Bugfix

```md
Cari route dan flow yang rusak. Verifikasi middleware, service, query, dan props yang terlibat. Prioritaskan akar masalah paling dekat. Patch kecil, tanpa refactor luas.
```

### Fast Start Fitur

```md
Tambahkan fitur mengikuti boundary modul existing. Pastikan route, permission, service, dan page konsisten. Cek kebutuhan outlet-awareness, audit log, dan side effect domain sebelum coding.
```

### Fast Start Review

```md
Review perubahan dengan fokus pada bug fungsional, isolasi outlet, permission, side effect transaksi/stok/finance, dan test gap. Temuan dulu, ringkasan belakangan.
```

## Prompt Satu Baris

```md
Gunakan konteks minimum, prioritaskan kode aktif, baca route -> controller -> service -> page -> test, cek `permission`/`active_shift`/`outlet_id`/shared props, dan buat patch sekecil mungkin.
```

## Cara Pakai

- Pakai `Master Prompt` untuk sesi baru.
- Pakai `Session Starter` jika ingin versi paling hemat token.
- Tambahkan satu prompt spesifik task: `Bugfix`, `Fitur Baru`, `Frontend`, `Backend`, `Report`, atau `Review`.
- Jika task menyentuh outlet, stok, loyalty, kitchen, atau tenant, tambahkan `Prompt Area Transisi`.
