const permissionLabels = {
    "dashboard-access": "Akses Dashboard",
    "users-access": "Lihat Pengguna",
    "users-create": "Tambah Pengguna",
    "users-update": "Ubah Pengguna",
    "users-delete": "Hapus Pengguna",
    "roles-access": "Lihat Group Akses",
    "roles-create": "Tambah Group Akses",
    "roles-update": "Ubah Group Akses",
    "roles-delete": "Hapus Group Akses",
    "permissions-access": "Lihat Daftar Izin",
    "permissions-create": "Tambah Izin",
    "permissions-update": "Ubah Izin",
    "permissions-delete": "Hapus Izin",
    "categories-access": "Lihat Kategori",
    "categories-create": "Tambah Kategori",
    "categories-edit": "Ubah Kategori",
    "categories-delete": "Hapus Kategori",
    "products-access": "Lihat Produk",
    "products-create": "Kelola Katalog Produk",
    "products-edit": "Ubah Produk Operasional",
    "products-pricing-update": "Ubah Harga Produk",
    "products-delete": "Hapus Produk",
    "pricing-rules-access": "Lihat Aturan Harga",
    "pricing-rules-create": "Tambah Aturan Harga",
    "pricing-rules-update": "Ubah Aturan Harga",
    "pricing-rules-delete": "Hapus Aturan Harga",
    "outlets-access": "Lihat Outlet dan Tenant",
    "outlets-create": "Tambah Outlet dan Tenant",
    "outlets-update": "Ubah Outlet dan Tenant",
    "outlets-toggle": "Tutup atau Buka Toko",
    "customers-access": "Lihat Pelanggan",
    "customers-create": "Tambah Pelanggan",
    "customers-edit": "Ubah Pelanggan",
    "customers-delete": "Hapus Pelanggan",
    "customer-vouchers-access": "Lihat Voucher Pelanggan",
    "customer-vouchers-create": "Tambah Voucher Pelanggan",
    "customer-vouchers-update": "Ubah Voucher Pelanggan",
    "customer-vouchers-delete": "Hapus Voucher Pelanggan",
    "customer-segments-access": "Lihat Segmen Pelanggan",
    "customer-segments-create": "Tambah Segmen Pelanggan",
    "customer-segments-update": "Ubah Segmen Pelanggan",
    "customer-segments-delete": "Hapus Segmen Pelanggan",
    "crm-campaigns-access": "Lihat Kampanye CRM",
    "crm-campaigns-create": "Tambah Kampanye CRM",
    "crm-campaigns-update": "Ubah Kampanye CRM",
    "crm-campaigns-delete": "Hapus Kampanye CRM",
    "crm-reminders-access": "Lihat Pengingat CRM",
    "transactions-access": "Akses POS dan Transaksi",
    "transactions-confirm-payment": "Konfirmasi Pembayaran",
    "waiter-board-access": "Akses Papan Petugas Antar",
    "receivables-access": "Lihat Piutang",
    "receivables-pay": "Bayar atau Catat Piutang",
    "payables-access": "Lihat Hutang",
    "payables-pay": "Bayar atau Catat Hutang",
    "suppliers-access": "Lihat Pemasok",
    "reports-access": "Lihat Laporan",
    "profits-access": "Lihat Laba",
    "payment-settings-access": "Lihat Pengaturan Pembayaran",
    "payment-settings-update": "Ubah Pengaturan Pembayaran",
    "stock-opnames-access": "Lihat Stock Opname",
    "stock-opnames-create": "Buat atau Ubah Stock Opname",
    "stock-opnames-finalize": "Selesaikan Stock Opname",
    "stock-mutations-access": "Lihat Mutasi Stok",
    "sales-returns-access": "Lihat Retur Penjualan",
    "sales-returns-create": "Buat Retur Penjualan",
    "sales-returns-complete": "Selesaikan Retur Penjualan",
    "cashier-shifts-access": "Lihat Shift Kasir",
    "cashier-shifts-open": "Buka Shift Kasir",
    "cashier-shifts-close": "Tutup Shift Kasir",
    "cashier-shifts-force-close": "Paksa Tutup Shift Kasir",
    "audit-logs-access": "Lihat Audit Log",
    "purchase-orders-access": "Lihat Purchase Order",
    "purchase-orders-create": "Tambah Purchase Order",
    "purchase-orders-update": "Ubah Purchase Order",
    "purchase-orders-delete": "Hapus Purchase Order",
    "goods-receivings-access": "Lihat Penerimaan Barang",
    "goods-receivings-create": "Tambah Penerimaan Barang",
    "supplier-returns-access": "Lihat Retur Pemasok",
    "supplier-returns-create": "Tambah Retur Pemasok",
    "supplier-returns-update": "Ubah Retur Pemasok",
};

const groupLabels = {
    dashboard: "Dashboard",
    users: "Pengguna",
    roles: "Group Akses",
    permissions: "Daftar Izin",
    categories: "Kategori",
    products: "Produk",
    pricing: "Harga dan Promo",
    outlets: "Outlet dan Tenant",
    customers: "Pelanggan dan CRM",
    transactions: "POS dan Operasional",
    finance: "Piutang dan Hutang",
    reports: "Laporan",
    settings: "Pengaturan",
    inventory: "Stok dan Gudang",
    returns: "Retur",
    shifts: "Shift Kasir",
    audit: "Audit",
    purchasing: "Pembelian",
    kitchen: "Dapur dan Antar",
    other: "Lainnya",
};

export function permissionLabel(name = "") {
    return permissionLabels[name] || name;
}

export function permissionGroup(name = "") {
    if (name.startsWith("users-")) return "users";
    if (name.startsWith("roles-")) return "roles";
    if (name.startsWith("permissions-")) return "permissions";
    if (name.startsWith("categories-")) return "categories";
    if (name.startsWith("products-")) return "products";
    if (name.startsWith("pricing-rules-")) return "pricing";
    if (name.startsWith("outlets-")) return "outlets";
    if (
        name.startsWith("customers-") ||
        name.startsWith("customer-vouchers-") ||
        name.startsWith("customer-segments-") ||
        name.startsWith("crm-")
    ) return "customers";
    if (name.startsWith("transactions-")) return "transactions";
    if (name === "waiter-board-access") return "kitchen";
    if (name.startsWith("receivables-") || name.startsWith("payables-") || name.startsWith("suppliers-")) return "finance";
    if (name.startsWith("reports-") || name.startsWith("profits-")) return "reports";
    if (name.startsWith("payment-settings-")) return "settings";
    if (name.startsWith("stock-opnames-") || name.startsWith("stock-mutations-")) return "inventory";
    if (name.startsWith("sales-returns-")) return "returns";
    if (name.startsWith("cashier-shifts-")) return "shifts";
    if (name.startsWith("audit-logs-")) return "audit";
    if (name.startsWith("purchase-orders-") || name.startsWith("goods-receivings-") || name.startsWith("supplier-returns-")) return "purchasing";
    if (name === "dashboard-access") return "dashboard";

    return "other";
}

export function permissionGroupLabel(name = "") {
    return groupLabels[permissionGroup(name)] || groupLabels.other;
}

export function permissionDescription(name = "") {
    switch (name) {
        case "products-create":
            return "Untuk admin katalog: buat produk baru, ubah identitas produk, tenant mapping, dan topping.";
        case "products-edit":
            return "Untuk operasional: ubah data produk terbatas dan sesuaikan stok outlet.";
        case "products-pricing-update":
            return "Izin khusus untuk mengganti harga beli dan harga jual.";
        case "outlets-toggle":
            return "Dipakai untuk menutup atau membuka toko tanpa harus mengubah data outlet lain.";
        case "outlets-update":
            return "Mengubah data outlet seperti nama, komisi, PIC, dan profil outlet.";
        default:
            return "";
    }
}

export function decoratePermission(permission = {}) {
    const name = permission.name || "";

    return {
        ...permission,
        label: permissionLabel(name),
        group: permissionGroup(name),
        group_label: permissionGroupLabel(name),
        description: permissionDescription(name),
    };
}
