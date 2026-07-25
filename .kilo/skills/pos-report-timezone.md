---
name: pos-report-timezone
description: Gunakan helper ReportTimezone untuk filter tanggal laporan agar grouping harian dan label konsisten menghindari bug timezone.
---

# Laporan Harian Source-Aware

- Semua filter `start_date`/`end_date` harus dilewatkan helper `App\Support\ReportTimezone`.
- Jangan pakai `whereDate(...)`, `applyUtcDateRange(...)`, atau `CONVERT_TZ(...)` secara ad hoc.
- Buat daily key lewat helper source-aware, bukan `localDateKey()` umum atau parsing mentah.
- Samakan grouping harian, filter, dan label tanggal dengan helper yang sama.
