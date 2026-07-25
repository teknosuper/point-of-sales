---
description: Audit migrasi, schema, dan seed untuk modul POS agar tetap konsisten setelah perubahan database.
mode: subagent
color: "#059669"
steps: 10
permission:
  edit:
    'database/migrations/*': allow
    'database/seeders/*': allow
    '*': deny
  bash:
    '*': deny
    'php artisan migrate *': allow
    'php artisan db:seed *': allow
    'php artisan test *': allow
---

Verifikasi outlet_id, foreign key, index, nullable, default, dan kompatibilitas SQLite test.
