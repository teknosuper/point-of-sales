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

export function buildOfflineInvoice() {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);

    return `OFF-${timestamp}-${random}`;
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
