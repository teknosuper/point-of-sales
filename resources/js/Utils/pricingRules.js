export const PROMO_KIND_LABELS = {
    standard_discount: "Harga Spesial",
    qty_break: "Belanja Lebih Untung",
    bundle_price: "Paket Hemat",
    buy_x_get_y: "Promo Buy Get",
};

export const RECEIPT_PROMO_KIND_LABELS = {
    standard_discount: "Harga Spesial",
    qty_break: "Belanja Lebih Untung",
    bundle_price: "Paket Hemat",
    buy_x_get_y: "Promo Buy Get",
};

export const REWARD_ITEM_LABEL = "Item Bonus Promo";
export const PROMO_TOTAL_LABEL = "Promo Otomatis";

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

export const promoKindLabel = (kind, { receipt = false } = {}) => {
    const labels = receipt ? RECEIPT_PROMO_KIND_LABELS : PROMO_KIND_LABELS;

    return labels[kind] || "Promo";
};

export const promoHeadline = (kind, qty = 1) => {
    const quantity = Math.max(1, Number(qty || 1));

    return (
        {
            qty_break: `Beli ${quantity}+ lebih hemat`,
            bundle_price: "Ambil paket, harga lebih hemat",
            buy_x_get_y: "Benefit buy-get diterapkan",
        }[kind] || null
    );
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
        const completedCycles = Math.floor(qty / buyQty);
        const bonusItems = completedCycles * freeQty;
        const payableItems = qty;
        const lineTotal = payableItems * basePrice;
        const savings = bonusItems * basePrice;

        if (bonusItems <= 0) {
            const needed = Math.max(1, buyQty - qty);

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
            headline: `${bonusItems} item bonus akan otomatis ditambahkan.`,
            detail: `Pelanggan bayar ${payableItems} item, dapat bonus ${bonusItems} item dengan hemat ${formatPrice(
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
        const rewardQty = Math.max(1, Number(item?.qty || 1));
        return [
            compact ? `Bonus Gratis ${rewardQty}x` : REWARD_ITEM_LABEL,
            item?.promo_reward_rule_name || "Promo aktif",
        ]
            .filter(Boolean)
            .join(" • ");
    }

    if (Number(item?.discount_total || 0) <= 0) {
        return null;
    }

    if (compact && item?.pricing_rule_kind === "buy_x_get_y") {
        return [
            "Promo Buy Get",
            item?.pricing_group_label || item?.pricing_rule_name || null,
        ]
            .filter(Boolean)
            .join(" • ");
    }

    const kindLabel = promoKindLabel(item?.pricing_rule_kind, {
        receipt: compact,
    });
    const title = item?.pricing_group_label || item?.pricing_rule_name || null;
    const headline = promoHeadline(item?.pricing_rule_kind, item?.qty);
    const baseUnitPrice = Number(item?.base_unit_price || 0);
    const unitPrice = Number(item?.unit_price || 0);
    const parts = [kindLabel, headline, title].filter(Boolean);

    if (baseUnitPrice > unitPrice && unitPrice > 0) {
        parts.push(
            `${formatPrice(baseUnitPrice)} -> ${formatPrice(unitPrice)}`
        );
    }

    return parts.join(" • ") || PROMO_TOTAL_LABEL;
};

export const promoDetailText = (item) => {
    if (item?.is_promo_reward) {
        return `Bonus Gratis • ${
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
              ? "Paket promo diterapkan."
              : kind === "buy_x_get_y"
                ? "Promo buy-get aktif."
                : "Harga promo diterapkan.";

    return `${title} • ${detail}`;
};

export const promoTitleText = (item) => {
    if (item?.is_promo_reward) {
        return item?.promo_reward_rule_name || REWARD_ITEM_LABEL;
    }

    return item?.pricing_group_label || item?.pricing_rule_name || null;
};

export const hasPromoApplied = (item) =>
    Boolean(item?.is_promo_reward) ||
    Number(item?.discount_total || 0) > 0 ||
    Boolean(promoTitleText(item));

export const buildPricingItemsByCartId = (pricingPreview) => {
    const items = pricingPreview?.items || [];

    return items.reduce((accumulator, item) => {
        accumulator[item.cart_id] = item;

        return accumulator;
    }, {});
};

const buildCartFingerprint = (item) => {
    const modifierSignature = Array.isArray(item?.modifiers)
        ? item.modifiers
              .map(
                  (modifier) =>
                      `${modifier?.name || ""}:${Number(
                          modifier?.qty || 0
                      )}:${Number(modifier?.unit_price || 0)}`
              )
              .sort()
              .join("|")
        : "";

    return [
        Number(item?.product_id || 0),
        Number(item?.qty || 0),
        String(item?.notes || "").trim(),
        modifierSignature,
    ].join("::");
};

export const mergeRewardMetadataIntoCarts = (
    serverCarts = [],
    cachedCarts = []
) => {
    if (!Array.isArray(serverCarts) || serverCarts.length === 0) {
        return [];
    }

    const cachedRewardCarts = Array.isArray(cachedCarts)
        ? cachedCarts.filter((item) => item?.promo_reward_meta)
        : [];

    if (cachedRewardCarts.length === 0) {
        return serverCarts;
    }

    const cachedById = new Map(
        cachedRewardCarts.map((item) => [String(item.id), item])
    );
    const usedCacheIds = new Set();

    return serverCarts.map((cart) => {
        if (cart?.promo_reward_meta) {
            return cart;
        }

        const exactCachedCart = cachedById.get(String(cart.id));
        if (exactCachedCart?.promo_reward_meta) {
            usedCacheIds.add(String(exactCachedCart.id));

            return {
                ...cart,
                is_promo_reward: true,
                promo_reward_rule_name:
                    exactCachedCart.promo_reward_meta?.rule_name ||
                    exactCachedCart.promo_reward_rule_name ||
                    null,
                promo_reward_label:
                    exactCachedCart.promo_reward_meta?.reward_label ||
                    exactCachedCart.promo_reward_label ||
                    null,
                promo_reward_meta: exactCachedCart.promo_reward_meta,
            };
        }

        const cartFingerprint = buildCartFingerprint(cart);
        const fallbackCachedCart = cachedRewardCarts.find((item) => {
            if (usedCacheIds.has(String(item.id))) {
                return false;
            }

            return buildCartFingerprint(item) === cartFingerprint;
        });

        if (!fallbackCachedCart?.promo_reward_meta) {
            return cart;
        }

        usedCacheIds.add(String(fallbackCachedCart.id));

        return {
            ...cart,
            is_promo_reward: true,
            promo_reward_rule_name:
                fallbackCachedCart.promo_reward_meta?.rule_name ||
                fallbackCachedCart.promo_reward_rule_name ||
                null,
            promo_reward_label:
                fallbackCachedCart.promo_reward_meta?.reward_label ||
                fallbackCachedCart.promo_reward_label ||
                null,
            promo_reward_meta: fallbackCachedCart.promo_reward_meta,
        };
    });
};

export const normalizeBuyGetRewardCarts = (
    cartItems = [],
    productsById = {}
) => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return [];
    }

    let nextCarts = [...cartItems];
    const processedRules = new Set();

    const resolveProductRule = (cartItem) => {
        const productId = Number(cartItem?.product_id || 0);
        const product = productsById[productId] || cartItem?.product || null;

        return product?.pricing_badge?.pricing_rule || null;
    };

    for (const cartItem of nextCarts) {
        const rule = resolveProductRule(cartItem);

        if (
            !rule ||
            rule.kind !== "buy_x_get_y" ||
            !Array.isArray(rule?.buy_items) ||
            !Array.isArray(rule?.get_items)
        ) {
            continue;
        }

        const buyItems = rule.buy_items;
        const rewardItems = rule.get_items;
        if (buyItems.length !== 1 || rewardItems.length !== 1) {
            continue;
        }

        const buyItem = buyItems[0];
        const rewardItem = rewardItems[0];
        const buyProductId = Number(buyItem?.product_id || 0);
        const rewardProductId = Number(rewardItem?.product_id || 0);

        if (
            buyProductId <= 0 ||
            rewardProductId <= 0 ||
            buyProductId !== rewardProductId
        ) {
            continue;
        }

        const ruleName = rule?.name || promoBadgeSummary(rule).title || "Promo";
        const processedKey = `${ruleName}:${buyProductId}`;

        if (processedRules.has(processedKey)) {
            continue;
        }

        processedRules.add(processedKey);

        const targetRows = nextCarts
            .map((item, index) => ({
                item,
                index,
            }))
            .filter(
                ({ item }) => Number(item?.product_id || 0) === buyProductId
            );

        if (targetRows.length === 0) {
            continue;
        }

        const totalQty = targetRows.reduce(
            (sum, entry) => sum + Number(entry.item?.qty || 0),
            0
        );
        const buyQty = Math.max(1, Number(buyItem?.quantity || 1));
        const rewardQty = Math.max(1, Number(rewardItem?.quantity || 1));
        const cycleSize = buyQty + rewardQty;
        const desiredRewardQty =
            Math.floor(totalQty / cycleSize) * rewardQty;
        let remainingRewardQty = desiredRewardQty;

        const orderedRows = [...targetRows].sort((left, right) => {
            const leftIsReward = Boolean(
                left.item?.promo_reward_meta?.rule_name === ruleName ||
                    left.item?.is_promo_reward
            );
            const rightIsReward = Boolean(
                right.item?.promo_reward_meta?.rule_name === ruleName ||
                    right.item?.is_promo_reward
            );

            if (leftIsReward !== rightIsReward) {
                return leftIsReward ? -1 : 1;
            }

            return Number(left.item?.qty || 0) - Number(right.item?.qty || 0);
        });

        for (const { item, index } of orderedRows) {
            const rowQty = Math.max(1, Number(item?.qty || 1));
            const rewardLabel =
                rewardItem?.product_title ||
                item?.product?.title ||
                item?.product_title ||
                "Item bonus";

            if (rowQty <= remainingRewardQty) {
                nextCarts[index] = {
                    ...item,
                    is_promo_reward: true,
                    promo_reward_rule_name: ruleName,
                    promo_reward_label: rewardLabel,
                    promo_reward_meta: {
                        rule_name: ruleName,
                        reward_label: rewardLabel,
                    },
                };
                remainingRewardQty -= rowQty;
                continue;
            }

            nextCarts[index] = {
                ...item,
                is_promo_reward: false,
                promo_reward_rule_name: null,
                promo_reward_label: null,
                promo_reward_meta: null,
            };
        }
    }

    return nextCarts;
};

export const shouldUseLocalPricingPreview = (
    cartItems = [],
    pricingPreview = null
) => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return false;
    }

    const currentItems = pricingPreview?.items || [];
    if (currentItems.length === 0) {
        return true;
    }

    const rewardCartIds = cartItems
        .filter(
            (item) =>
                Boolean(item?.promo_reward_meta) ||
                Boolean(item?.is_promo_reward)
        )
        .map((item) => String(item.id));

    if (
        rewardCartIds.length > 0 &&
        rewardCartIds.some((cartId) => {
            const pricingItem = currentItems.find(
                (item) => String(item?.cart_id) === cartId
            );

            if (!pricingItem) {
                return true;
            }

            return Number(pricingItem?.effective_unit_price ?? 0) > 0;
        })
    ) {
        return true;
    }

    const currentGrandTotal = Number(pricingPreview?.summary?.grand_total ?? 0);
    const fallbackGrandTotal = Number(
        buildLocalPricingPreview(cartItems)?.summary?.grand_total ?? 0
    );

    return currentGrandTotal <= 0 && fallbackGrandTotal > 0;
};

export const resolveCartPricingLine = (cartItem, pricingItem = null) => {
    const qty = Math.max(1, Number(cartItem?.qty || 1));
    const productSellPrice = Math.max(
        0,
        Number(cartItem?.product?.sell_price || cartItem?.sell_price || 0)
    );
    const modifierTotal = (cartItem?.modifiers || []).reduce(
        (sum, modifier) => sum + Math.max(0, Number(modifier?.total_price || 0)),
        0
    );
    const isReward =
        Boolean(cartItem?.promo_reward_meta) || Boolean(cartItem?.is_promo_reward);
    const baseUnitPrice = Math.max(
        0,
        Number(pricingItem?.base_unit_price ?? productSellPrice)
    );
    const fallbackUnitPrice = isReward ? 0 : productSellPrice;
    const effectiveUnitPrice = Math.max(
        0,
        Number(pricingItem?.effective_unit_price ?? fallbackUnitPrice)
    );
    const baseLineTotal = Math.max(
        0,
        Number(pricingItem?.line_base_total ?? baseUnitPrice * qty + modifierTotal)
    );
    const effectiveLineTotal = Math.max(
        0,
        Number(pricingItem?.line_total ?? effectiveUnitPrice * qty + modifierTotal)
    );
    const discountTotal = Math.max(
        0,
        Number(
            pricingItem?.line_discount_total ??
                Math.max(0, baseLineTotal - effectiveLineTotal)
        )
    );

    return {
        qty,
        modifierTotal,
        isReward,
        baseUnitPrice,
        effectiveUnitPrice,
        baseLineTotal,
        effectiveLineTotal,
        discountTotal,
        pricingRule: pricingItem?.pricing_rule || null,
        pricingGroupKey: pricingItem?.pricing_group_key || null,
        pricingGroupLabel: pricingItem?.pricing_group_label || null,
    };
};

export const buildLocalPricingPreview = (cartItems = []) => {
    const items = (cartItems || []).map((cartItem) => {
        const resolved = resolveCartPricingLine(cartItem, null);

        return {
            cart_id: cartItem?.id,
            product_id: cartItem?.product_id,
            product_title: cartItem?.product?.title || "Produk",
            qty: resolved.qty,
            base_unit_price: resolved.baseUnitPrice,
            customer_base_unit_price: resolved.baseUnitPrice,
            tenant_base_unit_price: Number(
                cartItem?.product?.buy_price || 0
            ),
            owner_markup_unit_price: Math.max(
                0,
                resolved.baseUnitPrice - Number(cartItem?.product?.buy_price || 0)
            ),
            effective_unit_price: resolved.effectiveUnitPrice,
            line_base_total: resolved.baseLineTotal,
            line_total: resolved.effectiveLineTotal,
            line_discount_total: resolved.discountTotal,
            modifier_total: resolved.modifierTotal,
            pricing_rule: null,
            pricing_group_key: null,
            pricing_group_label: null,
            is_promo_reward: resolved.isReward,
        };
    });

    const baseSubtotal = items.reduce(
        (sum, item) => sum + Number(item.line_base_total || 0),
        0
    );
    const promoDiscountTotal = items.reduce(
        (sum, item) => sum + Number(item.line_discount_total || 0),
        0
    );
    const subtotalAfterPromo = Math.max(0, baseSubtotal - promoDiscountTotal);

    return {
        items,
        applied_groups: [],
        consumed_quantities: {},
        unmatched_items: {},
        summary: {
            base_subtotal: baseSubtotal,
            promo_discount_total: promoDiscountTotal,
            tenant_discount_total: 0,
            owner_discount_total: 0,
            subtotal_after_promo: subtotalAfterPromo,
            voucher_discount_total: 0,
            loyalty_discount_total: 0,
            manual_discount_total: 0,
            shipping_cost: 0,
            grand_total: subtotalAfterPromo,
        },
    };
};
