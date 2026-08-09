export const PROMO_KIND_LABELS = {
    standard_discount: "Harga Spesial",
    qty_break: "Beli Banyak, Lebih Hemat",
    bundle_price: "Paket Hemat",
    buy_x_get_y: "Beli X Gratis Y",
};

export const RECEIPT_PROMO_KIND_LABELS = {
    standard_discount: "Harga Spesial",
    qty_break: "Beli Banyak, Lebih Hemat",
    bundle_price: "Paket Hemat",
    buy_x_get_y: "Beli X Gratis Y",
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
                ? rule.name || fallbackLabel || "Promo Beli X Gratis Y"
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
            qty_break: `Beli ${quantity}+, makin hemat`,
            bundle_price: "Ambil paketnya, makin hemat",
            buy_x_get_y: "Beli beberapa, gratis beberapa",
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
                    headline: "Belum memenuhi syarat promo Beli X Gratis Y.",
                    detail: `Butuh ${triggerQty}x ${currentBuyItem?.product_title || "item pembelian"}. Setelah itu tambahkan ${rewardLabels} ke keranjang agar benefit final terbaca jelas.`,
                    lineTotal: basePrice * qty,
                    savings: 0,
                };
            }

            return {
                status: "info",
                headline: "Syarat pembelian terpenuhi, bonus belum ditambahkan.",
                detail: `Beli ${buyLabels}, lalu tambahkan ${rewardLabels} ke keranjang. Benefit final dihitung otomatis.`,
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

export const buildCartPromoState = ({
    cartItem,
    pricingItem = null,
    fallbackProduct = null,
    formatPrice = defaultFormatPrice,
}) => {
    const resolvedLine = resolveCartPricingLine(cartItem, pricingItem);
    const pricingRule = pricingItem?.pricing_rule || null;
    const fallbackRule = fallbackProduct?.pricing_badge?.pricing_rule || null;
    const previewRule = pricingRule || fallbackRule;
    const promoSummary = promoBadgeSummary(
        previewRule,
        pricingItem?.pricing_group_label || null
    );
    const isCrossProductBuyGet =
        previewRule?.kind === "buy_x_get_y" &&
        Array.isArray(previewRule?.get_items) &&
        previewRule.get_items.some(
            (rewardItem) =>
                Number(rewardItem.product_id || 0) !==
                Number(cartItem?.product_id || 0)
        );
    const latentPromoPreview =
        !pricingRule && previewRule
            ? promoBenefitPreview({
                  rule: previewRule,
                  quantity: Number(cartItem?.qty || 1),
                  baseUnitPrice: resolvedLine.baseUnitPrice,
                  effectiveUnitPrice: resolvedLine.baseUnitPrice,
                  productId: cartItem?.product_id,
                  formatPrice,
              })
            : null;
    const buyGetBreakdown = resolveBuyGetBreakdown({
        rule: previewRule,
        ruleKind: pricingRule?.kind || null,
        quantity: Number(cartItem?.qty || 1),
        baseUnitPrice: resolvedLine.baseUnitPrice,
        discountTotal: resolvedLine.discountTotal,
        productId: cartItem?.product_id,
    });
    const modifierTotal = (cartItem?.modifiers || []).reduce(
        (sum, modifier) =>
            sum + Number(modifier?.total_price ?? modifier?.price ?? 0),
        0
    );

    return {
        resolvedLine,
        pricingRule,
        previewRule,
        promoSummary,
        isCrossProductBuyGet,
        latentPromoPreview,
        buyGetBreakdown,
        modifierTotal,
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
            "Beli X Gratis Y",
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
                ? "Beli X, gratis Y — hemat Rp lebih besar."
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

    if (currentItems.length !== cartItems.length) {
        return true;
    }

    const pricingItemsByCartId = new Map(
        currentItems.map((item) => [String(item?.cart_id || ""), item])
    );

    if (
        cartItems.some((item) => !pricingItemsByCartId.has(String(item?.id || "")))
    ) {
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

    const previewItemsGrandTotal = cartItems.reduce((sum, cartItem) => {
        const pricingItem = pricingItemsByCartId.get(String(cartItem?.id || ""));
        if (!pricingItem) {
            return sum;
        }

        return sum + Number(resolveCartPricingLine(cartItem, pricingItem)?.effectiveLineTotal || 0);
    }, 0);
    const currentGrandTotal = Number(pricingPreview?.summary?.grand_total ?? 0);
    const currentPaymentFeeTotal = Number(
        pricingPreview?.summary?.payment_fee_total ?? 0
    );
    const comparableGrandTotal = Math.max(
        0,
        currentGrandTotal - currentPaymentFeeTotal
    );

    if (Math.abs(previewItemsGrandTotal - comparableGrandTotal) > 1) {
        return true;
    }

    const fallbackGrandTotal = Number(
        buildLocalPricingPreview(cartItems)?.summary?.grand_total ?? 0
    );

    return currentGrandTotal <= 0 && fallbackGrandTotal > 0;
};

export function resolveCartPricingLine(cartItem, pricingItem = null) {
    const qty = Math.max(1, Number(cartItem?.qty || 1));
    const productSellPrice = Math.max(
        0,
        Number(cartItem?.product?.sell_price || cartItem?.sell_price || 0)
    );
    const productBuyPrice = Math.max(
        0,
        Number(cartItem?.product?.buy_price || cartItem?.buy_price || 0)
    );
    const fallbackBadge = cartItem?.product?.pricing_badge || null;
    const fallbackRule = fallbackBadge?.pricing_rule || null;
    const fallbackBaseUnitPrice = Math.max(
        productSellPrice,
        Number(fallbackBadge?.base_price ?? productSellPrice)
    );
    const fallbackEffectiveUnitPrice = (() => {
        if (fallbackRule?.price_context) {
            return Math.max(
                0,
                Number(
                    fallbackBadge?.promo_price ??
                        cartItem?.product?.effective_price ??
                        productSellPrice
                )
            );
        }

        return Math.max(
            0,
            Number(cartItem?.product?.effective_price ?? productSellPrice)
        );
    })();
    const modifierTotal = (cartItem?.modifiers || []).reduce(
        (sum, modifier) => sum + Math.max(0, Number(modifier?.total_price || 0)),
        0
    );
    const isReward =
        Boolean(cartItem?.promo_reward_meta) || Boolean(cartItem?.is_promo_reward);
    const fallbackDirectPricing = (() => {
        if (pricingItem || isReward || !fallbackRule) {
            return null;
        }

        const resolveLineDiscount = (discountType, discountValue, baseUnitPrice) => {
            const lineBaseTotal = baseUnitPrice * qty;

            const discount = {
                percentage: Math.round(lineBaseTotal * (Number(discountValue || 0) / 100)),
                fixed_amount: Math.round(Number(discountValue || 0)) * qty,
                fixed_price: Math.max(
                    0,
                    lineBaseTotal - Math.round(Number(discountValue || 0)) * qty
                ),
            }[discountType] ?? 0;

            return Math.min(lineBaseTotal, Math.max(0, discount));
        };

        const priceBasis =
            fallbackRule?.price_basis === "buy_price"
                ? productBuyPrice
                : fallbackBaseUnitPrice;

        if (fallbackRule?.kind === "standard_discount") {
            const lineDiscount = resolveLineDiscount(
                fallbackRule?.discount_type,
                fallbackRule?.discount_value,
                priceBasis
            );

            return {
                lineDiscount,
                pricingGroupLabel:
                    fallbackRule?.name || fallbackRule?.label || null,
            };
        }

        if (fallbackRule?.kind === "qty_break") {
            const activeBreak = [...(fallbackRule?.qty_breaks || [])]
                .filter((entry) => qty >= Number(entry?.min_qty || 0))
                .sort((left, right) => Number(right?.min_qty || 0) - Number(left?.min_qty || 0))[0];

            if (!activeBreak) {
                return null;
            }

            const lineDiscount = resolveLineDiscount(
                activeBreak?.discount_type,
                activeBreak?.discount_value,
                priceBasis
            );

            return {
                lineDiscount,
                pricingGroupLabel: fallbackRule?.name || null,
            };
        }

        return null;
    })();
    const baseUnitPrice = Math.max(
        0,
        Number(pricingItem?.base_unit_price ?? fallbackBaseUnitPrice)
    );
    const fallbackUnitPrice = isReward ? 0 : fallbackEffectiveUnitPrice;
    const previewEffectiveUnitPrice = Math.max(
        0,
        Number(pricingItem?.effective_unit_price ?? fallbackUnitPrice)
    );
    const baseLineTotal = Math.max(
        0,
        Number(pricingItem?.line_base_total ?? baseUnitPrice * qty + modifierTotal)
    );
    const effectiveLineTotal = Math.max(
        0,
        Number(
            pricingItem?.line_total ??
                (fallbackDirectPricing
                    ? Math.max(
                          0,
                          baseUnitPrice * qty + modifierTotal - fallbackDirectPricing.lineDiscount
                      )
                    : previewEffectiveUnitPrice * qty + modifierTotal)
        )
    );
    const effectiveUnitPrice = Math.max(
        0,
        Number(
            pricingItem?.effective_unit_price ??
                Math.round(
                    Math.max(0, effectiveLineTotal - modifierTotal) / Math.max(1, qty)
                )
        )
    );
    const discountTotal = Math.max(
        0,
        Number(
            pricingItem?.line_discount_total ??
                fallbackDirectPricing?.lineDiscount ??
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
        pricingGroupLabel:
            pricingItem?.pricing_group_label ||
            fallbackDirectPricing?.pricingGroupLabel ||
            null,
    };
}

const localRuleMatchesCartItem = (rule, cartItem) => {
    const targetType = rule?.target_type || "all";

    if (targetType === "all") {
        return true;
    }

    if (targetType === "product") {
        return Number(rule?.product_id || 0) === Number(cartItem?.product_id || 0);
    }

    if (targetType === "category") {
        return Number(rule?.category_id || 0) === Number(cartItem?.product?.category_id || 0);
    }

    return false;
};

const localRuleBasisUnitPrice = (rule, cartItem) =>
    rule?.price_basis === "buy_price"
        ? Math.max(0, Number(cartItem?.product?.buy_price || cartItem?.buy_price || 0))
        : Math.max(0, Number(cartItem?.product?.sell_price || cartItem?.sell_price || 0));

const localResolveLineDiscount = (
    discountType,
    discountValue,
    baseUnitPrice,
    quantity
) => {
    const qty = Math.max(1, Number(quantity || 1));
    const lineBaseTotal = Math.max(0, Number(baseUnitPrice || 0)) * qty;

    const discount =
        {
            percentage: Math.round(lineBaseTotal * (Number(discountValue || 0) / 100)),
            fixed_amount: Math.round(Number(discountValue || 0)) * qty,
            fixed_price: Math.max(
                0,
                lineBaseTotal - Math.round(Number(discountValue || 0)) * qty
            ),
        }[discountType] ?? 0;

    return Math.min(lineBaseTotal, Math.max(0, discount));
};

const buildLocalRuleCollection = (cartItems = []) => {
    const rulesById = new Map();

    for (const cartItem of cartItems) {
        const rule = cartItem?.product?.pricing_badge?.pricing_rule;
        if (rule?.id && !rulesById.has(Number(rule.id))) {
            rulesById.set(Number(rule.id), rule);
        }
    }

    return [...rulesById.values()].sort((left, right) => {
        const leftPriority = Number(left?.priority || 0);
        const rightPriority = Number(right?.priority || 0);

        if (leftPriority !== rightPriority) {
            return rightPriority - leftPriority;
        }

        return Number(left?.id || 0) - Number(right?.id || 0);
    });
};

export const buildLocalPricingPreview = (cartItems = []) => {
    const nextCartItems = Array.isArray(cartItems) ? [...cartItems] : [];
    const productsById = nextCartItems.reduce((accumulator, item) => {
        accumulator[Number(item?.product_id || 0)] = item?.product || null;
        return accumulator;
    }, {});
    const normalizedCartItems = normalizeBuyGetRewardCarts(
        nextCartItems,
        productsById
    );
    const rules = buildLocalRuleCollection(normalizedCartItems);
    const itemsMap = new Map(
        normalizedCartItems.map((cartItem) => {
            const qty = Math.max(1, Number(cartItem?.qty || 1));
            const baseUnitPrice = Math.max(
                0,
                Number(cartItem?.product?.sell_price || cartItem?.sell_price || 0)
            );
            const tenantBaseUnitPrice = Math.max(
                0,
                Number(cartItem?.product?.buy_price || cartItem?.buy_price || 0)
            );
            const ownerMarkupUnitPrice = Math.max(
                0,
                baseUnitPrice - tenantBaseUnitPrice
            );
            const modifierTotal = (cartItem?.modifiers || []).reduce(
                (sum, modifier) =>
                    sum + Math.max(0, Number(modifier?.total_price || 0)),
                0
            );

            return [
                String(cartItem?.id),
                {
                    cart_id: cartItem?.id,
                    product_id: cartItem?.product_id,
                    product_title: cartItem?.product?.title || "Produk",
                    qty,
                    base_unit_price: baseUnitPrice,
                    customer_base_unit_price: baseUnitPrice,
                    tenant_base_unit_price: tenantBaseUnitPrice,
                    owner_markup_unit_price: ownerMarkupUnitPrice,
                    effective_unit_price: baseUnitPrice,
                    line_base_total: baseUnitPrice * qty + modifierTotal,
                    line_total: baseUnitPrice * qty,
                    line_discount_total: 0,
                    modifier_total: modifierTotal,
                    tenant_base_total: tenantBaseUnitPrice * qty,
                    owner_base_total: ownerMarkupUnitPrice * qty,
                    tenant_discount_total: 0,
                    owner_discount_total: 0,
                    tenant_net_total: tenantBaseUnitPrice * qty,
                    owner_net_total: ownerMarkupUnitPrice * qty,
                    pricing_rule: null,
                    pricing_group_key: null,
                    pricing_group_label: null,
                    applied_rules: [],
                    is_promo_reward:
                        Boolean(cartItem?.promo_reward_meta) ||
                        Boolean(cartItem?.is_promo_reward),
                },
            ];
        })
    );
    const remainingQuantities = Object.fromEntries(
        normalizedCartItems.map((cartItem) => [
            String(cartItem?.id),
            Math.max(1, Number(cartItem?.qty || 1)),
        ])
    );
    const sortedItems = normalizedCartItems.map((cartItem) => ({
        cartId: String(cartItem?.id),
        cartItem,
    }));

    const consumeMatchingItems = (remainingState, matcher, requiredQuantity) => {
        let required = Math.max(1, Number(requiredQuantity || 1));
        const matches = [];

        for (const { cartId, cartItem } of sortedItems) {
            if (required <= 0) {
                break;
            }

            const previewItem = itemsMap.get(cartId);
            if (!previewItem || !matcher(previewItem, cartItem)) {
                continue;
            }

            const availableQty = Number(remainingState[cartId] || 0);
            if (availableQty <= 0) {
                continue;
            }

            const take = Math.min(availableQty, required);
            matches.push({
                cart_id: cartId,
                quantity: take,
                base_total: Number(previewItem.base_unit_price || 0) * take,
                tenant_base_total:
                    Number(previewItem.tenant_base_unit_price || 0) * take,
                owner_base_total:
                    Number(previewItem.owner_markup_unit_price || 0) * take,
            });
            remainingState[cartId] = Math.max(0, availableQty - take);
            required -= take;
        }

        return required === 0 ? matches : null;
    };

    const participantBasisTotal = (rule, participant) =>
        rule?.price_basis === "buy_price"
            ? Number(participant?.tenant_base_total || 0)
            : Number(participant?.base_total || 0);

    const allocateDiscount = (participants, discountTotal, weightKey = "base_total") => {
        const baseTotal = Math.max(
            1,
            participants.reduce(
                (sum, participant) => sum + Number(participant?.[weightKey] || 0),
                0
            )
        );

        return participants.map((participant, index) => {
            const remainingDiscount = Math.max(
                0,
                Number(discountTotal || 0) -
                    participants
                        .slice(0, index)
                        .reduce(
                            (sum, entry) => sum + Number(entry?.discount_total || 0),
                            0
                        )
            );
            const share =
                index === participants.length - 1
                    ? remainingDiscount
                    : Math.min(
                          Number(participant?.[weightKey] || 0),
                          Math.max(
                              0,
                              Math.floor(
                                  Number(discountTotal || 0) *
                                      (Number(participant?.[weightKey] || 0) / baseTotal)
                              )
                          )
                      );

            return {
                ...participant,
                discount_total: share,
            };
        });
    };

    const applyCandidate = (rule, groupKey, participants, groupLabel, activeBreak = null) => {
        for (const participant of participants) {
            const cartId = String(participant.cart_id);
            const previewItem = itemsMap.get(String(participant.cart_id));
            if (!previewItem) {
                continue;
            }

            remainingQuantities[cartId] = Math.max(
                0,
                Number(remainingQuantities[cartId] || 0) -
                    Number(participant.quantity || 0)
            );

            previewItem.line_total = Math.max(
                0,
                Number(previewItem.line_total || 0) -
                    Number(participant.discount_total || 0)
            );
            previewItem.line_discount_total += Number(
                participant.discount_total || 0
            );
            previewItem.pricing_group_key = groupKey;
            previewItem.pricing_group_label = groupLabel;
            previewItem.pricing_rule = {
                ...rule,
                active_break: activeBreak,
            };
            previewItem.applied_rules = [
                ...(previewItem.applied_rules || []),
                {
                    ...rule,
                    active_break: activeBreak,
                },
            ];
            itemsMap.set(String(participant.cart_id), previewItem);
        }
    };

    const appliedGroups = [];

    while (true) {
        const bundleCandidates = rules
            .filter((rule) => rule?.kind === "bundle_price")
            .map((rule) => {
                const bundleItems = Array.isArray(rule?.bundle_items)
                    ? rule.bundle_items
                    : [];
                if (bundleItems.length === 0) {
                    return null;
                }

                const tempRemaining = { ...remainingQuantities };
                let participants = [];

                for (const bundleItem of bundleItems) {
                    const matched = consumeMatchingItems(
                        tempRemaining,
                        (previewItem) =>
                            Number(previewItem?.product_id || 0) ===
                            Number(bundleItem?.product_id || 0),
                        Number(bundleItem?.quantity || 1)
                    );

                    if (!matched) {
                        return null;
                    }

                    participants = participants.concat(
                        matched.map((participant) => ({
                            ...participant,
                            basis_total: participantBasisTotal(rule, participant),
                        }))
                    );
                }

                const baseTotal = participants.reduce(
                    (sum, participant) => sum + Number(participant?.basis_total || 0),
                    0
                );
                const bundlePrice = Math.round(Number(rule?.discount_value || 0));
                if (bundlePrice >= baseTotal) {
                    return null;
                }

                const discountTotal = Math.max(0, baseTotal - bundlePrice);
                const allocated = allocateDiscount(
                    participants,
                    discountTotal,
                    "basis_total"
                );

                return {
                    rule,
                    participants: allocated,
                    discountTotal,
                    label: rule?.name || rule?.label || "Bundle",
                };
            })
            .filter(Boolean)
            .sort((left, right) => {
                if (Number(left?.rule?.priority || 0) !== Number(right?.rule?.priority || 0)) {
                    return Number(right?.rule?.priority || 0) - Number(left?.rule?.priority || 0);
                }

                if (Number(left?.discountTotal || 0) !== Number(right?.discountTotal || 0)) {
                    return Number(right?.discountTotal || 0) - Number(left?.discountTotal || 0);
                }

                return Number(left?.rule?.id || 0) - Number(right?.rule?.id || 0);
            });

        const candidate = bundleCandidates[0];
        if (!candidate) {
            break;
        }

        const groupKey = `bundle-${candidate.rule.id}-${appliedGroups.length + 1}`;
        applyCandidate(
            candidate.rule,
            groupKey,
            candidate.participants,
            candidate.label
        );
        appliedGroups.push({
            key: groupKey,
            label: candidate.label,
            rule: candidate.rule,
            discount_total: candidate.discountTotal,
            participants: candidate.participants,
        });
    }

    while (true) {
        const buyGetCandidates = rules
            .filter((rule) => rule?.kind === "buy_x_get_y")
            .map((rule) => {
                const buyItems = Array.isArray(rule?.buy_items) ? rule.buy_items : [];
                const getItems = Array.isArray(rule?.get_items) ? rule.get_items : [];
                if (buyItems.length === 0 || getItems.length === 0) {
                    return null;
                }

                const tempRemaining = { ...remainingQuantities };
                let participants = [];

                for (const buyItem of buyItems) {
                    const matched = consumeMatchingItems(
                        tempRemaining,
                        (previewItem) =>
                            Number(previewItem?.product_id || 0) ===
                                Number(buyItem?.product_id || 0) &&
                            !Boolean(previewItem?.is_promo_reward),
                        Number(buyItem?.quantity || 1)
                    );

                    if (!matched) {
                        return null;
                    }

                    participants = participants.concat(
                        matched.map((participant) => ({
                            ...participant,
                            discount_total: 0,
                        }))
                    );
                }

                const rewardParticipants = [];
                for (const rewardItem of getItems) {
                    const matched = consumeMatchingItems(
                        tempRemaining,
                        (previewItem) =>
                            Number(previewItem?.product_id || 0) ===
                                Number(rewardItem?.product_id || 0) &&
                            Boolean(previewItem?.is_promo_reward),
                        Number(rewardItem?.quantity || 1)
                    );

                    if (!matched) {
                        return null;
                    }

                    for (const participant of matched) {
                        const discountTotal = Number(participant?.base_total || 0);
                        const discounted = {
                            ...participant,
                            discount_total: discountTotal,
                        };
                        rewardParticipants.push(discounted);
                        participants.push(discounted);
                    }
                }

                const discountTotal = rewardParticipants.reduce(
                    (sum, participant) => sum + Number(participant?.discount_total || 0),
                    0
                );

                if (discountTotal <= 0) {
                    return null;
                }

                return {
                    rule,
                    participants,
                    discountTotal,
                    label: rule?.name || rule?.label || "Beli X Gratis Y",
                };
            })
            .filter(Boolean)
            .sort((left, right) => {
                if (Number(left?.rule?.priority || 0) !== Number(right?.rule?.priority || 0)) {
                    return Number(right?.rule?.priority || 0) - Number(left?.rule?.priority || 0);
                }

                if (Number(left?.discountTotal || 0) !== Number(right?.discountTotal || 0)) {
                    return Number(right?.discountTotal || 0) - Number(left?.discountTotal || 0);
                }

                return Number(left?.rule?.id || 0) - Number(right?.rule?.id || 0);
            });

        const candidate = buyGetCandidates[0];
        if (!candidate) {
            break;
        }

        const groupKey = `bxgy-${candidate.rule.id}-${appliedGroups.length + 1}`;
        applyCandidate(
            candidate.rule,
            groupKey,
            candidate.participants,
            candidate.label
        );
        appliedGroups.push({
            key: groupKey,
            label: candidate.label,
            rule: candidate.rule,
            discount_total: candidate.discountTotal,
            participants: candidate.participants,
        });
    }

    for (const { cartId, cartItem } of sortedItems) {
        const previewItem = itemsMap.get(cartId);
        const remainingQty = Math.max(0, Number(remainingQuantities[cartId] || 0));
        if (!previewItem || remainingQty <= 0) {
            continue;
        }

        const candidateRules = rules
            .filter(
                (rule) =>
                    localRuleMatchesCartItem(rule, cartItem) &&
                    ["standard_discount", "qty_break"].includes(rule?.kind)
            )
            .map((rule) => {
                if (rule?.kind === "qty_break") {
                    const activeBreak = [...(rule?.qty_breaks || [])]
                        .filter(
                            (entry) => remainingQty >= Number(entry?.min_qty || 0)
                        )
                        .sort(
                            (left, right) =>
                                Number(right?.min_qty || 0) -
                                Number(left?.min_qty || 0)
                        )[0];

                    if (!activeBreak) {
                        return null;
                    }

                    const lineDiscount = localResolveLineDiscount(
                        activeBreak?.discount_type,
                        activeBreak?.discount_value,
                        localRuleBasisUnitPrice(rule, cartItem),
                        remainingQty
                    );

                    return {
                        rule,
                        lineDiscount,
                        activeBreak,
                    };
                }

                const lineDiscount = localResolveLineDiscount(
                    rule?.discount_type,
                    rule?.discount_value,
                    localRuleBasisUnitPrice(rule, cartItem),
                    remainingQty
                );

                return {
                    rule,
                    lineDiscount,
                    activeBreak: null,
                };
            })
            .filter((candidate) => Number(candidate?.lineDiscount || 0) > 0)
            .sort((left, right) => {
                if (Number(left?.rule?.priority || 0) !== Number(right?.rule?.priority || 0)) {
                    return Number(right?.rule?.priority || 0) - Number(left?.rule?.priority || 0);
                }

                if (Number(left?.lineDiscount || 0) !== Number(right?.lineDiscount || 0)) {
                    return Number(right?.lineDiscount || 0) - Number(left?.lineDiscount || 0);
                }

                return Number(left?.rule?.id || 0) - Number(right?.rule?.id || 0);
            })[0];

        if (!candidateRules) {
            continue;
        }

        previewItem.line_total = Math.max(
            0,
            Number(previewItem.line_total || 0) - Number(candidateRules.lineDiscount || 0)
        );
        previewItem.line_discount_total += Number(candidateRules.lineDiscount || 0);
        previewItem.pricing_group_key =
            previewItem.pricing_group_key || `rule-${candidateRules.rule.id}`;
        previewItem.pricing_group_label =
            previewItem.pricing_group_label ||
            candidateRules.rule?.name ||
            candidateRules.rule?.label ||
            null;
        previewItem.pricing_rule = {
            ...candidateRules.rule,
            active_break: candidateRules.activeBreak,
        };
        previewItem.applied_rules = [
            ...(previewItem.applied_rules || []),
            {
                ...candidateRules.rule,
                active_break: candidateRules.activeBreak,
            },
        ];
        itemsMap.set(cartId, previewItem);
    }

    const items = [...itemsMap.values()].map((item) => {
        const modifierTotal = Math.max(0, Number(item.modifier_total || 0));
        const lineTotal = Math.max(0, Number(item.line_total || 0)) + modifierTotal;

        return {
            ...item,
            line_total: lineTotal,
            effective_unit_price: Math.round(
                Math.max(0, lineTotal - modifierTotal) / Math.max(1, Number(item.qty || 1))
            ),
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
        applied_groups: appliedGroups,
        consumed_quantities: Object.fromEntries(
            sortedItems.map(({ cartId, cartItem }) => [
                cartId,
                Math.max(
                    0,
                    Math.max(1, Number(cartItem?.qty || 1)) -
                        Math.max(0, Number(remainingQuantities[cartId] || 0))
                ),
            ])
        ),
        unmatched_items: Object.fromEntries(
            Object.entries(remainingQuantities).filter(
                ([, qty]) => Number(qty || 0) > 0
            )
        ),
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
