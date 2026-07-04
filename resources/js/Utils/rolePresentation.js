function roleNameOf(roleOrName = "") {
    if (typeof roleOrName === "string") {
        return roleOrName;
    }

    return roleOrName?.name || "";
}

function roleDisplayNameOf(roleOrName = "") {
    if (typeof roleOrName === "string") {
        return "";
    }

    return roleOrName?.display_name || "";
}

function roleDescriptionOf(roleOrName = "") {
    if (typeof roleOrName === "string") {
        return "";
    }

    return roleOrName?.description || "";
}

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

export function roleLabel(roleOrName = "") {
    return roleDisplayNameOf(roleOrName) || humanizeRoleName(roleNameOf(roleOrName));
}

export function roleDescription(roleOrName = "") {
    return roleDescriptionOf(roleOrName) || "";
}
