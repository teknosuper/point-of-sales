const roleLabels = {
    "super-admin": "Super Admin",
    cashier: "Kasir",
    waiter: "Petugas Antar",
    "kitchen-operator": "Operator Dapur Tenant",
    "kasir-operasional": "Kasir Operasional",
    "petugas-antar": "Petugas Antar",
    "operator-dapur": "Operator Dapur",
    "tenant-operasional": "Tenant Operasional",
    "tenant-promo": "Tenant Promo",
    "owner-pricing": "Admin Harga Owner",
    "admin-stok": "Admin Stok",
    "admin-laporan": "Admin Laporan",
    "admin-owner-outlet": "Admin Owner Outlet",
    "admin-sistem": "Admin Sistem",
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
    "payment-settings-update": "Editor Pengaturan Pembayaran",
    "stock-opnames-access": "Admin Stock Opname",
    "stock-opnames-create": "Petugas Stock Opname",
    "stock-opnames-finalize": "Supervisor Stock Opname",
    "stock-mutations-access": "Admin Mutasi Stok",
    "sales-returns-access": "Admin Retur Penjualan",
    "sales-returns-create": "Petugas Retur Penjualan",
    "sales-returns-finalize": "Supervisor Retur Penjualan",
    "cashier-shifts-access": "Admin Shift Kasir",
    "cashier-shifts-open": "Petugas Buka Shift",
    "cashier-shifts-close": "Petugas Tutup Shift",
    "audit-logs-access": "Admin Audit Log",
    "purchase-orders-access": "Admin Purchase Order",
    "purchase-orders-create": "Petugas Purchase Order",
    "purchase-orders-update": "Editor Purchase Order",
    "purchase-orders-delete": "Supervisor Purchase Order",
    "goods-receivings-access": "Admin Penerimaan Barang",
    "goods-receivings-create": "Petugas Penerimaan Barang",
    "supplier-returns-access": "Admin Retur Pemasok",
    "supplier-returns-create": "Petugas Retur Pemasok",
    "supplier-returns-update": "Editor Retur Pemasok",
};

const roleDescriptions = {
    "super-admin": "Akses penuh ke seluruh sistem.",
    cashier: "Fokus pada transaksi kasir dan operasional checkout.",
    waiter: "Fokus pada pengantaran pesanan dari dapur ke pelanggan.",
    "kitchen-operator": "Fokus pada layar dapur, stok, dan buka/tutup toko tenant.",
    "kasir-operasional": "Preset siap pakai untuk kasir harian.",
    "petugas-antar": "Preset siap pakai untuk pengantaran pesanan.",
    "operator-dapur": "Preset siap pakai untuk layar dapur dan operasional tenant.",
    "tenant-operasional": "Preset siap pakai untuk PIC tenant harian.",
    "tenant-promo": "Preset siap pakai untuk pengelola promo tenant.",
    "owner-pricing": "Preset siap pakai untuk admin owner yang mengelola harga utama dan promo owner.",
    "admin-stok": "Preset siap pakai untuk pembelian, stok, dan supplier.",
    "admin-laporan": "Preset siap pakai untuk pemantauan laporan dan analitik.",
    "admin-owner-outlet": "Preset siap pakai untuk admin harian owner outlet.",
    "admin-sistem": "Preset siap pakai untuk admin internal yang mengelola akses dan pengaturan penting.",
    "users-access": "Boleh melihat dan mengelola daftar pengguna.",
    "roles-access": "Boleh melihat dan mengelola role akses.",
    "permissions-access": "Boleh melihat daftar izin sistem.",
    "categories-access": "Boleh mengelola kategori produk.",
    "products-access": "Boleh mengelola katalog produk dan operasional produk.",
    "dining-tables-access": "Boleh mengelola meja dine in dan QR meja.",
    "outlets-access": "Boleh mengelola outlet owner dan tenant.",
    "customers-access": "Boleh mengelola data pelanggan.",
    "customer-vouchers-access": "Boleh mengelola voucher pelanggan.",
    "customer-segments-access": "Boleh mengelola segmen pelanggan.",
    "crm-campaigns-access": "Boleh mengelola kampanye CRM.",
    "crm-reminders-access": "Boleh mengelola pengingat CRM.",
    "transactions-access": "Boleh mengakses POS dan transaksi.",
    "waiter-board-access": "Boleh mengakses papan antar dan status serah pesanan.",
    "table-orders-access": "Boleh melihat dan mengelola pesanan QR meja.",
    "table-orders-approve": "Boleh menyetujui pembayaran QR meja.",
    "receivables-access": "Boleh mengelola piutang pelanggan.",
    "payables-access": "Boleh mengelola hutang supplier.",
    "suppliers-access": "Boleh mengelola pemasok.",
    "reports-access": "Boleh melihat laporan utama.",
    "profits-access": "Boleh melihat laporan laba dan margin.",
    "payment-settings-access": "Boleh melihat pengaturan pembayaran.",
    "stock-opnames-access": "Boleh melihat dan memantau stock opname.",
    "stock-mutations-access": "Boleh melihat mutasi stok.",
    "sales-returns-access": "Boleh melihat dan memantau retur penjualan.",
    "cashier-shifts-access": "Boleh melihat dan memantau shift kasir.",
    "audit-logs-access": "Boleh melihat jejak audit sistem.",
    "purchase-orders-access": "Boleh melihat dan memantau purchase order.",
    "goods-receivings-access": "Boleh melihat dan memantau penerimaan barang.",
    "supplier-returns-access": "Boleh melihat dan memantau retur pemasok.",
    "payment-settings-update": "Boleh mengubah metode bayar, rekening, dan pengaturan pembayaran.",
    "stock-opnames-create": "Boleh membuat sesi stock opname baru.",
    "stock-opnames-finalize": "Boleh menutup dan menyelesaikan hasil stock opname.",
    "sales-returns-create": "Boleh membuat retur penjualan dari transaksi yang ada.",
    "sales-returns-finalize": "Boleh menyelesaikan retur penjualan.",
    "cashier-shifts-open": "Boleh membuka shift kasir.",
    "cashier-shifts-close": "Boleh menutup shift kasir.",
    "purchase-orders-create": "Boleh membuat draft purchase order.",
    "purchase-orders-update": "Boleh mengubah draft purchase order.",
    "purchase-orders-delete": "Boleh menghapus purchase order.",
    "goods-receivings-create": "Boleh mencatat barang yang diterima dari supplier.",
    "supplier-returns-create": "Boleh membuat retur ke supplier.",
    "supplier-returns-update": "Boleh mengubah retur supplier yang masih berjalan.",
};

function humanizeRoleName(name = "") {
    if (!name) return "";

    return name
        .replace(/-/g, " ")
        .replace(/\baccess\b/gi, "akses")
        .replace(/\bcreate\b/gi, "tambah")
        .replace(/\bupdate\b/gi, "ubah")
        .replace(/\bdelete\b/gi, "hapus")
        .replace(/\bfinalize\b/gi, "selesaikan")
        .replace(/\bopen\b/gi, "buka")
        .replace(/\bclose\b/gi, "tutup")
        .replace(/\bpayment settings\b/gi, "pengaturan pembayaran")
        .replace(/\bstock opnames\b/gi, "stock opname")
        .replace(/\bstock mutations\b/gi, "mutasi stok")
        .replace(/\bsales returns\b/gi, "retur penjualan")
        .replace(/\bpurchase orders\b/gi, "purchase order")
        .replace(/\bgoods receivings\b/gi, "penerimaan barang")
        .replace(/\bsupplier returns\b/gi, "retur pemasok")
        .replace(/\bcashier shifts\b/gi, "shift kasir")
        .replace(/\bpricing rules\b/gi, "aturan harga")
        .replace(/\bdining tables\b/gi, "meja dine in")
        .replace(/\bcrm\b/gi, "CRM")
        .replace(/\bqr\b/gi, "QR")
        .replace(/\bpos\b/gi, "POS")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function roleLabel(name = "") {
    return roleLabels[name] || humanizeRoleName(name);
}

export function roleDescription(name = "") {
    return roleDescriptions[name] || "";
}
