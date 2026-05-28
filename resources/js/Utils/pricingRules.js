export const PROMO_KIND_LABELS = {
    standard_discount: "Harga Spesial",
    qty_break: "Promo Qty",
    bundle_price: "Bundle",
    buy_x_get_y: "Buy X Get Y",
};

export const RECEIPT_PROMO_KIND_LABELS = {
    standard_discount: "Harga Spesial",
    qty_break: "Belanja Lebih Untung",
    bundle_price: "Paket Hemat",
    buy_x_get_y: "Promo Buy Get",
};

const defaultFormatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export const formatRuleItems = (items = []) =>
    items
        .map(
            (item) =>
                `${Number(item.quantity || 1) > 1 ? `${item.quantity}x ` : ""}${item.product_title || "item"}`
        )
        .join(", ");

export const promoBadgeSummary = (rule, fallbackLabel = null) => {
    if (!rule) {
        return {
            badge: fallbackLabel || null,
            title: null,
            detail: null,
        };
    }

    return {
        badge: PROMO_KIND_LABELS[rule.kind] || "Promo",
        title:
            rule.kind === "buy_x_get_y"
                ? rule.name || fallbackLabel || "Promo buy-get"
                : rule.label || rule.name || fallbackLabel || "Promo aktif",
        detail: rule.detail || null,
    };
};

export const promoBenefitPreview = ({
    rule,
    quantity,
    baseUnitPrice,
    effectiveUnitPrice,
    productId,
    formatPrice = defaultFormatPrice,
}) => {
    if (!rule) {
        return {
            status: "normal",
            headline: "Belum ada benefit promo yang bisa dipreview.",
            detail: null,
            lineTotal: baseUnitPrice * quantity,
            savings: 0,
        };
    }

    const qty = Math.max(1, Number(quantity || 1));
    const basePrice = Math.max(0, Number(baseUnitPrice || 0));
    const directLineTotal = Math.max(0, Number(effectiveUnitPrice || 0)) * qty;
    const minimumQuantity = Math.max(
        1,
        Number(rule.minimum_quantity || rule.preview_quantity || 1)
    );

    if (rule.kind === "buy_x_get_y") {
        const buyItems = Array.isArray(rule.buy_items) ? rule.buy_items : [];
        const getItems = Array.isArray(rule.get_items) ? rule.get_items : [];
        const currentProductId = Number(productId || 0);
        const currentBuyItem = buyItems.find(
            (item) => Number(item.product_id || 0) === currentProductId
        );
        const rewardIsDifferentProduct = getItems.some(
            (item) => Number(item.product_id || 0) !== currentProductId
        );
        const buyLabels = formatRuleItems(buyItems);
        const rewardLabels = formatRuleItems(getItems);

        if (rewardIsDifferentProduct) {
            const triggerQty = Math.max(
                1,
                Number(currentBuyItem?.quantity || rule.buy_qty || 1)
            );

            if (qty < triggerQty) {
                return {
                    status: "pending",
                    headline: "Belum memenuhi syarat promo buy-get.",
                    detail: `Butuh ${triggerQty}x ${currentBuyItem?.product_title || "item pembelian"}. Setelah itu tambahkan ${rewardLabels} ke keranjang agar benefit final terbaca jelas.`,
                    lineTotal: basePrice * qty,
                    savings: 0,
                };
            }

            return {
                status: "info",
                headline: "Syarat pembelian sudah terpenuhi, bonus beda produk belum ada di keranjang.",
                detail: `Beli ${buyLabels}, lalu tambahkan ${rewardLabels} ke keranjang. Benefit final akan dihitung otomatis di keranjang.`,
                lineTotal: basePrice * qty,
                savings: 0,
            };
        }

        const buyQty = Math.max(1, Number(rule.buy_qty || 1));
        const freeQty = Math.max(1, Number(rule.free_qty || 1));
        const cycle = buyQty + freeQty;
        const completedCycles = Math.floor(qty / cycle);
        const bonusItems = completedCycles * freeQty;
        const payableItems = Math.max(0, qty - bonusItems);
        const lineTotal = payableItems * basePrice;
        const savings = bonusItems * basePrice;

        if (bonusItems <= 0) {
            const needed = Math.max(1, cycle - qty);

            return {
                status: "pending",
                headline: `Tambah ${needed} item lagi untuk mengaktifkan bonus ${freeQty} item.`,
                detail: rule.detail,
                lineTotal: basePrice * qty,
                savings: 0,
            };
        }

        return {
            status: "active",
            headline: `${bonusItems} item bonus aktif untuk qty ${qty}.`,
            detail: `Pelanggan bayar ${payableItems} item, hemat ${formatPrice(
                savings
            )}.`,
            lineTotal,
            savings,
        };
    }

    if (rule.kind === "qty_break") {
        if (qty < minimumQuantity) {
            return {
                status: "pending",
                headline: `Tambah ${minimumQuantity - qty} item lagi untuk harga promo.`,
                detail: rule.detail,
                lineTotal: basePrice * qty,
                savings: 0,
            };
        }

        return {
            status: "active",
            headline: `Promo quantity aktif untuk qty ${qty}.`,
            detail: `Estimasi hemat ${formatPrice(
                Math.max(0, basePrice * qty - directLineTotal)
            )}.`,
            lineTotal: directLineTotal,
            savings: Math.max(0, basePrice * qty - directLineTotal),
        };
    }

    if (rule.price_context && effectiveUnitPrice < basePrice) {
        return {
            status: "active",
            headline: "Harga promo langsung aktif.",
            detail: `Estimasi hemat ${formatPrice(
                Math.max(0, basePrice * qty - directLineTotal)
            )}.`,
            lineTotal: directLineTotal,
            savings: Math.max(0, basePrice * qty - directLineTotal),
        };
    }

    if (rule.kind === "bundle_price") {
        return {
            status: "info",
            headline: "Benefit bundle akan dihitung otomatis saat kombinasi item terpenuhi.",
            detail: rule.detail,
            lineTotal: basePrice * qty,
            savings: 0,
        };
    }

    return {
        status: "info",
        headline: rule.label || rule.name || "Promo tersedia",
        detail: rule.detail,
        lineTotal: directLineTotal || basePrice * qty,
        savings: Math.max(0, basePrice * qty - directLineTotal),
    };
};

export const resolveBuyGetBreakdown = ({
    rule = null,
    ruleKind = null,
    quantity,
    baseUnitPrice,
    discountTotal,
    productId = null,
    allowAllFree = false,
}) => {
    const resolvedKind = rule?.kind || ruleKind;
    const qty = Math.max(1, Number(quantity || 1));
    const basePrice = Math.max(0, Number(baseUnitPrice || 0));
    const discount = Math.max(0, Number(discountTotal || 0));

    if (
        resolvedKind !== "buy_x_get_y" ||
        qty <= 0 ||
        basePrice <= 0 ||
        discount <= 0
    ) {
        return null;
    }

    const hasCrossProductReward =
        Array.isArray(rule?.get_items) &&
        rule.get_items.some(
            (rewardItem) =>
                Number(rewardItem.product_id || 0) !== Number(productId || 0)
        );

    if (hasCrossProductReward) {
        return null;
    }

    const inferredBonusQty = Math.min(
        qty,
        Math.max(0, Math.round(discount / basePrice))
    );

    if (inferredBonusQty <= 0) {
        return null;
    }

    const payableQty = Math.max(0, qty - inferredBonusQty);

    if (!allowAllFree && payableQty >= qty) {
        return null;
    }

    return {
        payableQty,
        bonusQty: inferredBonusQty,
        paidUnitPrice: basePrice,
        paidLineTotal: payableQty * basePrice,
    };
};

export const promoMetaText = (
    item,
    { compact = false, formatPrice = defaultFormatPrice } = {}
) => {
    if (item?.is_promo_reward) {
        return ["Item Bonus Promo", item?.promo_reward_rule_name || "Promo aktif"]
            .filter(Boolean)
            .join(" • ");
    }

    if (Number(item?.discount_total || 0) <= 0) {
        return null;
    }

    const kindLabel =
        (compact ? RECEIPT_PROMO_KIND_LABELS : RECEIPT_PROMO_KIND_LABELS)[
            item?.pricing_rule_kind
        ] || null;
    const title = item?.pricing_group_label || item?.pricing_rule_name || null;
    const qty = Math.max(1, Number(item?.qty || 1));
    const headline =
        item?.pricing_rule_kind === "qty_break"
            ? `Beli ${qty}+ lebih hemat`
            : item?.pricing_rule_kind === "bundle_price"
              ? "Ambil paket, harga lebih hemat"
              : item?.pricing_rule_kind === "buy_x_get_y"
                ? "Benefit buy-get diterapkan"
                : null;
    const baseUnitPrice = Number(item?.base_unit_price || 0);
    const unitPrice = Number(item?.unit_price || 0);
    const parts = [kindLabel, headline, title].filter(Boolean);

    if (baseUnitPrice > unitPrice && unitPrice > 0) {
        parts.push(
            `${formatPrice(baseUnitPrice)} -> ${formatPrice(unitPrice)}`
        );
    }

    return parts.join(" • ") || "Promo Spesial";
};

export const promoDetailText = (item) => {
    if (item?.is_promo_reward) {
        return `Item bonus promo • ${
            item?.promo_reward_rule_name || "Promo aktif"
        }`;
    }

    if (Number(item?.discount_total || 0) <= 0) {
        return null;
    }

    const title =
        item?.pricing_group_label ||
        item?.pricing_rule_name ||
        "Promo aktif";
    const kind = item?.pricing_rule_kind;
    const qty = Math.max(1, Number(item?.qty || 1));
    const detail =
        kind === "qty_break"
            ? `Qty ${qty} memenuhi promo jumlah.`
            : kind === "bundle_price"
              ? "Promo bundle diterapkan."
              : kind === "buy_x_get_y"
                ? "Benefit buy-get diterapkan."
                : "Harga promo diterapkan.";

    return `${title} • ${detail}`;
};

export const promoTitleText = (item) => {
    if (item?.is_promo_reward) {
        return item?.promo_reward_rule_name || "Item Bonus Promo";
    }

    return item?.pricing_group_label || item?.pricing_rule_name || null;
};

export const hasPromoApplied = (item) =>
    Boolean(item?.is_promo_reward) ||
    Number(item?.discount_total || 0) > 0 ||
    Boolean(promoTitleText(item));
