---
name: pos-tenant-settlement
description: Hitung setor tunai tenant dan outstanding dengan 3 angka terpisah: saldo tenant kumulatif, payout approved kumulatif, outstanding.
---

# Settlement Tenant

- Saldo tenant kumulatif sampai akhir periode: dari `transaction_tenant_allocations`.
- Payout sudah dibayar kumulatif sampai akhir periode: dari `cashier_settlement_requests` tenant approved dengan cutoff `paid_at <= end_date`.
- Outstanding ke tenant = saldo tenant kumulatif - payout sudah dibayar kumulatif.
- Jangan pakai settlement approved sebagai pengganti saldo tenant.
- Jangan pakai allocation payout estimate sebagai pengganti payout aktual.
