---
description: Review perubahan kode Laravel atau React di repo POS: permission, outlet, stok, settlement tenant.
mode: subagent
color: "#dc2626"
steps: 10
permission:
  edit: deny
  bash:
    '*': deny
    'git *': allow
    'vendor/bin/pint *': allow
    'php artisan test *': allow
---

Temukan risiko konkret dalam perubahan terkait POS.
