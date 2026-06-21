const OFFLINE_CART_STORAGE_KEY = "pos:offline-cart";
const OFFLINE_QUEUE_STORAGE_KEY = "pos:offline-transaction-queue";
const OFFLINE_HISTORY_STORAGE_KEY = "pos:offline-transaction-history";
const OFFLINE_BOOTSTRAP_STORAGE_KEY = "pos:offline-bootstrap";

function safeParse(json, fallback) {
    try {
        return JSON.parse(json) ?? fallback;
    } catch {
        return fallback;
    }
}

function canUseStorage() {
    return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function loadOfflineCart() {
    if (!canUseStorage()) {
        return [];
    }

    return safeParse(
        window.localStorage.getItem(OFFLINE_CART_STORAGE_KEY),
        []
    );
}

export function saveOfflineCart(items) {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.setItem(
        OFFLINE_CART_STORAGE_KEY,
        JSON.stringify(items || [])
    );
}

export function clearOfflineCart() {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.removeItem(OFFLINE_CART_STORAGE_KEY);
}

export function loadOfflineTransactionQueue() {
    if (!canUseStorage()) {
        return [];
    }

    return safeParse(
        window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY),
        []
    );
}

export function saveOfflineTransactionQueue(items) {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.setItem(
        OFFLINE_QUEUE_STORAGE_KEY,
        JSON.stringify(items || [])
    );
}

export function loadOfflineTransactionHistory() {
    if (!canUseStorage()) {
        return [];
    }

    return safeParse(
        window.localStorage.getItem(OFFLINE_HISTORY_STORAGE_KEY),
        []
    );
}

export function saveOfflineTransactionHistory(items) {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.setItem(
        OFFLINE_HISTORY_STORAGE_KEY,
        JSON.stringify((items || []).slice(0, 100))
    );
}

export function loadOfflinePosBootstrap() {
    if (!canUseStorage()) {
        return null;
    }

    return safeParse(
        window.localStorage.getItem(OFFLINE_BOOTSTRAP_STORAGE_KEY),
        null
    );
}

export function saveOfflinePosBootstrap(snapshot) {
    if (!canUseStorage() || !snapshot) {
        return;
    }

    window.localStorage.setItem(
        OFFLINE_BOOTSTRAP_STORAGE_KEY,
        JSON.stringify({
            ...snapshot,
            saved_at: new Date().toISOString(),
        })
    );
}

export function clearOfflinePosBootstrap() {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.removeItem(OFFLINE_BOOTSTRAP_STORAGE_KEY);
}

export function buildOfflineInvoice() {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);

    return `OFF-${timestamp}-${random}`;
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }

    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
            .join(",")}}`;
    }

    return JSON.stringify(value);
}

function hashDjb2(value) {
    let hash = 5381;
    const text = String(value || "");

    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 33) ^ text.charCodeAt(index);
    }

    return `ofs-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildOfflineTransactionSignature(payload) {
    return hashDjb2(
        stableStringify({
            customer_id: payload?.customer_id ?? null,
            order_type: payload?.order_type ?? "take_away",
            table_id: payload?.table_id ?? null,
            cash: Number(payload?.cash || 0),
            change: Number(payload?.change || 0),
            shipping_cost: Number(payload?.shipping_cost || 0),
            grand_total: Number(payload?.grand_total || 0),
            details: (payload?.details || []).map((item) => ({
                product_id: Number(item?.product_id || 0),
                tenant_outlet_id: item?.tenant_outlet_id ?? null,
                qty: Number(item?.qty || 0),
                base_unit_price: Number(item?.base_unit_price || 0),
                unit_price: Number(item?.unit_price || 0),
                price: Number(item?.price || 0),
                notes: item?.notes || null,
                discount_total: Number(item?.discount_total || 0),
                pricing_rule_name: item?.pricing_rule_name || null,
                pricing_rule_kind: item?.pricing_rule_kind || null,
                pricing_group_key: item?.pricing_group_key || null,
                pricing_group_label: item?.pricing_group_label || null,
                is_promo_reward: Boolean(item?.is_promo_reward),
                promo_reward_rule_name: item?.promo_reward_rule_name || null,
                promo_reward_label: item?.promo_reward_label || null,
                modifiers: (item?.modifiers || []).map((modifier) => ({
                    name: modifier?.name || null,
                    qty: Number(modifier?.qty || 0),
                    unit_price: Number(modifier?.unit_price || 0),
                    total_price: Number(modifier?.total_price || 0),
                })),
            })),
        })
    );
}

export function buildOfflinePricing(localCarts = []) {
    const items = (localCarts || []).map((item) => {
        const qty = Math.max(1, Number(item.qty || 1));
        const baseUnitPrice = Number(
            item.product?.pricing_badge?.promo_price ||
                item.product?.sell_price ||
                0
        );
        const modifierTotal = (item.modifiers || []).reduce(
            (sum, modifier) => sum + Number(modifier.total_price || 0),
            0
        );
        const lineTotal = baseUnitPrice * qty + modifierTotal;

        return {
            cart_id: item.id,
            product_id: item.product_id,
            base_unit_price: baseUnitPrice,
            effective_unit_price: baseUnitPrice,
            line_total: lineTotal,
            line_discount_total: 0,
            pricing_rule: item.product?.pricing_badge?.label
                ? {
                      label: item.product.pricing_badge.label,
                      name: item.product.pricing_badge.label,
                      kind: item.product.pricing_badge.kind || "promo",
                  }
                : null,
            pricing_group_label: item.product?.pricing_badge?.label || null,
        };
    });

    const baseSubtotal = items.reduce(
        (sum, item) => sum + Number(item.line_total || 0),
        0
    );

    return {
        items,
        summary: {
            base_subtotal: baseSubtotal,
            promo_discount_total: 0,
            subtotal_after_promo: baseSubtotal,
            voucher_discount_total: 0,
            loyalty_discount_total: 0,
            manual_discount_total: 0,
            shipping_cost: 0,
            grand_total: baseSubtotal,
        },
    };
}
