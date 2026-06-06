const roleLabels = {
    "super-admin": "Super Admin",
    cashier: "Kasir",
    waiter: "Petugas Antar",
    "kitchen-operator": "Operator Dapur Tenant",
    "kasir-operasional": "Kasir Operasional",
    "petugas-antar": "Petugas Antar",
    "operator-dapur": "Operator Dapur",
    "tenant-operasional": "Tenant Operasional",
    "tenant-petugas-antar": "Tenant Delivery",
    "tenant-promo": "Tenant Promo",
    "tenant-owner": "Tenant Owner",
    "owner-pricing": "Admin Harga Owner",
    "admin-stok": "Admin Stok",
    "admin-laporan": "Admin Laporan",
    "admin-owner-outlet": "Admin Owner Outlet",
    "admin-sistem": "Admin Sistem",
};

const roleDescriptions = {
    "super-admin": "Akses penuh ke seluruh sistem.",
    cashier: "Fokus pada transaksi kasir dan operasional checkout.",
    waiter: "Fokus pada pengantaran pesanan dari dapur ke pelanggan.",
    "kitchen-operator": "Fokus pada layar dapur dan update stok operasional tenant.",
    "kasir-operasional": "Preset siap pakai untuk kasir harian.",
    "petugas-antar": "Preset siap pakai untuk pengantaran pesanan.",
    "operator-dapur": "Preset siap pakai untuk layar dapur dan operasional tenant.",
    "tenant-operasional": "Preset siap pakai untuk PIC tenant harian yang mengelola produk dan stok tanpa pricing.",
    "tenant-petugas-antar": "Preset siap pakai untuk petugas antar pesanan tenant.",
    "tenant-promo": "Preset siap pakai untuk pengelola promo tenant.",
    "tenant-owner": "Preset siap pakai untuk owner tenant yang mengelola seluruh aktivitas tenant.",
    "owner-pricing": "Preset siap pakai untuk admin owner yang mengelola harga utama dan promo owner.",
    "admin-stok": "Preset siap pakai untuk pembelian, stok, dan supplier.",
    "admin-laporan": "Preset siap pakai untuk pemantauan laporan dan analitik.",
    "admin-owner-outlet": "Preset siap pakai untuk admin owner outlet yang fokus pada operasional, laporan, dan settlement tanpa akses RBAC sistem.",
    "admin-sistem": "Preset siap pakai untuk admin internal yang mengelola user, role, permission, audit, dan pengaturan penting tanpa akses POS operasional.",
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
