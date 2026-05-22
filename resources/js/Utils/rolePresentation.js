const roleLabels = {
    "super-admin": "Super Admin",
    cashier: "Kasir",
    waiter: "Petugas Antar",
    "kitchen-operator": "Operator Dapur Tenant",
    "users-access": "Admin Pengguna",
    "roles-access": "Admin Group Akses",
    "permissions-access": "Admin Daftar Izin",
    "categories-access": "Admin Kategori",
    "products-access": "Admin Produk",
    "dining-tables-access": "Admin Meja Dine In",
    "pricing-rules-access": "Admin Aturan Harga",
    "outlets-access": "Admin Outlet dan Tenant",
    "customers-access": "Admin Pelanggan",
    "customer-vouchers-access": "Admin Voucher Pelanggan",
    "customer-segments-access": "Admin Segmen Pelanggan",
    "crm-campaigns-access": "Admin Kampanye CRM",
    "crm-reminders-access": "Admin Pengingat CRM",
    "transactions-access": "Operator Transaksi",
    "transactions-confirm-payment": "Petugas Konfirmasi Pembayaran",
    "waiter-board-access": "Admin Papan Antar",
    "table-orders-access": "Admin Pesanan QR Meja",
    "table-orders-approve": "Petugas Approve QR Meja",
    "receivables-access": "Admin Piutang",
    "payables-access": "Admin Hutang",
    "suppliers-access": "Admin Pemasok",
    "reports-access": "Admin Laporan",
    "profits-access": "Admin Laba",
    "payment-settings-access": "Admin Pengaturan Pembayaran",
    "stock-opnames-access": "Admin Stock Opname",
    "stock-mutations-access": "Admin Mutasi Stok",
    "sales-returns-access": "Admin Retur Penjualan",
    "cashier-shifts-access": "Admin Shift Kasir",
    "audit-logs-access": "Admin Audit Log",
    "purchase-orders-access": "Admin Purchase Order",
    "goods-receivings-access": "Admin Penerimaan Barang",
    "supplier-returns-access": "Admin Retur Pemasok",
};

const roleDescriptions = {
    "super-admin": "Akses penuh ke seluruh sistem.",
    cashier: "Fokus pada transaksi kasir dan operasional checkout.",
    waiter: "Fokus pada pengantaran pesanan dari dapur ke pelanggan.",
    "kitchen-operator": "Fokus pada layar dapur, stok, dan buka/tutup toko tenant.",
    "pricing-rules-access": "Role khusus untuk admin promo tenant atau owner outlet yang mengelola diskon, happy hour, dan bundling.",
    "products-access": "Role admin katalog dan operasional produk. Cocok untuk kontrol data produk lintas outlet.",
};

export function roleLabel(name = "") {
    return roleLabels[name] || name;
}

export function roleDescription(name = "") {
    return roleDescriptions[name] || "";
}
