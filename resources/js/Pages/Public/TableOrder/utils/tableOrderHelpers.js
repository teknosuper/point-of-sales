// Shared helpers untuk TableOrder — Menu.jsx dan Status.jsx

export const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export const flattenErrorMessages = (errors = {}) =>
    Object.values(errors)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
        .map((value) => String(value));

export const paymentMethodSummary = (value = "", paymentStatus = "") => {
    const normalizedMethod = String(value || "").toLowerCase();
    const normalizedStatus = String(paymentStatus || "").toLowerCase();

    if (["pakasir", "xendit", "midtrans"].includes(normalizedMethod)) {
        return normalizedStatus === "paid"
            ? "Dibayar online"
            : "Menunggu pembayaran online";
    }

    if (normalizedMethod === "bank_transfer") {
        return normalizedStatus === "paid"
            ? "Transfer sudah terverifikasi"
            : "Transfer menunggu verifikasi";
    }

    return normalizedStatus === "paid" ? "Dibayar di kasir" : "Bayar di kasir";
};

export const paymentMethodLabel = (value) => {
    const normalized = String(value || "").toLowerCase();
    return (
        {
            cash: "Bayar di kasir",
            bank_transfer: "Transfer bank",
            midtrans: "Midtrans",
            xendit: "Xendit",
            pakasir: "QRIS Otomatis (Online)",
        }[normalized] ||
        value ||
        "Pembayaran di kasir"
    );
};

export const normalizeModifierGroupName = (value) => {
    const normalized = String(value || "").trim();
    return normalized !== "" ? normalized : "Topping";
};

export const ORDER_TYPE_LABEL = {
    take_away: "Take Away",
    dine_in: "Dine In",
};

const ORDER_TYPE_NOTES_TAG = {
    take_away: "[TAKE AWAY]",
    dine_in: "[DINE IN]",
};

export const buildOrderTypeNotes = (orderType, rawNotes) => {
    const tag = ORDER_TYPE_NOTES_TAG[orderType] || "";
    const trimmed = String(rawNotes || "").trim();
    return tag ? [tag, trimmed].filter(Boolean).join(" ") : trimmed;
};

export const stripOrderTypeNotes = (notes) =>
    String(notes || "")
        .replace(/^\s*\[(TAKE AWAY|DINE IN)\]\s*/i, "")
        .trim();

export const appliesToOrderType = (option, orderType) => {
    const scope = String(option?.order_type_scope || "").trim();
    if (!scope || scope === "both") return true;
    return scope === orderType;
};

export const sanitizePhoneNumber = (value = "") =>
    String(value)
        .replace(/[^\d+]/g, "")
        .replace(/(?!^)\+/g, "")
        .slice(0, 16);

export const isValidPhoneNumber = (value = "") =>
    /^(?:\+62|62|0)[0-9]{8,13}$/.test(String(value).trim());

export const normalizePhoneNumber = (value = "") => {
    let digits = String(value).replace(/\D/g, "");
    if (digits.startsWith("62")) {
        digits = digits.slice(2);
    }
    if (!digits.startsWith("0")) {
        digits = "0" + digits;
    }
    return digits.slice(0, 15);
};

export const ORDER_STATUS_LABEL = {
    pending_cashier_payment: "Menunggu approval kasir",
    paid: "Sudah dibayar",
    rejected: "Ditolak kasir",
    cancelled: "Dibatalkan",
};

export const STATUS_LABEL = {
    pending_cashier_payment: "Menunggu pembayaran",
    paid: "Pembayaran selesai",
    rejected: "Belum bisa diproses",
    cancelled: "Pesanan dibatalkan",
};

export const EMPTY_PRICING_PREVIEW = {
    items: [],
    summary: {
        base_subtotal: 0,
        promo_discount_total: 0,
        subtotal_after_promo: 0,
        voucher_discount_total: 0,
        loyalty_discount_total: 0,
        manual_discount_total: 0,
        shipping_cost: 0,
        grand_total: 0,
    },
};
