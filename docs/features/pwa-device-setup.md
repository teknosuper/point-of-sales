# PWA & Device Setup

Dokumen ini menjelaskan setup Progressive Web App untuk aplikasi Point of Sales agar bisa di-install ke perangkat kasir, tablet dapur, atau desktop.

## Yang Sudah Ada

- `manifest.webmanifest`
- service worker ringan untuk asset statis
- fallback offline page
- prompt install PWA
- tombol install langsung dari UI
- indikator `online / offline`
- support layout admin, POS, dan kitchen

## Halaman Admin

- `Dashboard -> Setup PWA & Device`
- route: `/dashboard/guides/pwa-setup`

Halaman ini menampilkan:

- status secure context
- status service worker
- status koneksi
- status standalone / installed
- checklist install per platform
- rekomendasi start URL

## Rekomendasi Perangkat

### Admin

- install dari `/dashboard`

### Kasir

- install dari `/dashboard/transactions`

### Kitchen umum

- install dari `/dashboard/kitchen`

### Kitchen station tertentu

- gunakan `Link Tablet / Kiosk` dari `Kitchen Ops & Printer`

## Catatan

- Untuk install prompt penuh, gunakan HTTPS atau `localhost`
- Untuk iPhone/iPad, gunakan `Safari -> Share -> Add to Home Screen`
- Untuk Android/Chrome, gunakan prompt `Install App`
- Untuk mode dapur, tetap gabungkan PWA dengan flow `kitchen-login` dan `kitchen-entry`
