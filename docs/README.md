# Dokumentasi Point of Sales

Dokumentasi ini ditujukan untuk developer yang ingin setup, memahami alur modul, dan melakukan maintenance aplikasi.

## Daftar Isi

### Onboarding

- `docs/getting-started.md`
- `docs/configuration.md`

### Arsitektur

- `docs/architecture-overview.md`
- `docs/system-map.md`
- `docs/feature-completeness-checklist.md`
- `docs/feature-index.md`
- `planning/laravel-revamp-progress.md`

### Fitur Operasional

- `docs/features/pos-transactions.md`
- `docs/features/dining-tables.md`
- `docs/features/table-order-qr.md`
- `docs/features/outlet-tenant-kitchen-guide.md`
- `docs/features/demo-seed-guide.md`
- `docs/features/printing-architecture-options.md`
- `docs/features/print-bridge-api.md`
- `docs/features/pwa-device-setup.md`
- `docs/features/customers-regions.md`
- `docs/features/member-management.md`
- `docs/features/sales-returns.md`
- `docs/features/cashier-shifts.md`

### Fitur Inventory

- `docs/features/inventory-stock.md`

### Fitur Keuangan

- `docs/features/receivables.md`
- `docs/features/payables-suppliers.md`
- `docs/features/settings-payments.md`
- `docs/features/reports-documents.md`

### Admin & Observability

- `docs/features/rbac-users-roles.md`
- `docs/features/audit-logs.md`

## Cara Membaca Dokumentasi

- Jika baru pertama kali menjalankan repo, mulai dari `docs/getting-started.md`
- Jika ingin memahami struktur aplikasi, baca `docs/architecture-overview.md`
- Jika ingin memahami boundary modul, milestone engineering, dan coding standard repo, baca `docs/system-map.md`
- Jika ingin tahu status fitur yang sudah lengkap, masih parsial, atau belum selesai, baca `docs/feature-completeness-checklist.md`
- Jika ingin melanjutkan revamp Laravel multi outlet + kitchen, baca `planning/laravel-revamp-progress.md`
- Jika ingin bekerja pada modul tertentu, buka `docs/feature-index.md` lalu masuk ke dokumen fitur terkait
- Jika menemui masalah akses, selalu cek `docs/features/rbac-users-roles.md`

## Catatan

- Dokumentasi fokus pada fitur yang sudah ada di repo saat ini
- `docs/system-map.md` sekarang juga mencakup fondasi multi outlet dan kitchen routing pada aplikasi Laravel utama
- Dokumen roadmap tetap terpisah di `planning/improvement-planning.md`
