import { getProductImageUrl } from "@/Utils/imageUrl";
import {
    formatRuleItems,
    hasPromoApplied,
    promoKindLabel,
    promoDetailText,
    promoTitleText,
    REWARD_ITEM_LABEL,
} from "@/Utils/pricingRules";
import { IconShoppingCart, IconTrash, IconX } from "@/Utils/icons";

export default function CartLineItem({
    item,
    promoState,
    formatPrice,
    onAddRewardProducts,
    onOpenModifierModal,
    onRemoveModifier,
    onNotesChange,
    onNotesBlur,
    onQtyChange,
    onRemoveItem,
    noteSaving = false,
    modifierSaving = false,
    qtyUpdating = false,
    itemRemoving = false,
    highlightRewardProductIds = [],
    notePlaceholder = "Catatan item...",
    modifierActionLabel = "Tambah topping / extra",
}) {
    const {
        resolvedLine,
        pricingRule,
        previewRule,
        promoSummary,
        isCrossProductBuyGet,
        latentPromoPreview,
        buyGetBreakdown,
        modifierTotal,
    } = promoState;
    const baseLineTotal = resolvedLine.baseLineTotal;
    const effectiveLineTotal = resolvedLine.effectiveLineTotal;
    const effectiveUnitPrice = resolvedLine.effectiveUnitPrice;
    const baseUnitPrice = resolvedLine.baseUnitPrice;
    const resolvedPromoItem = {
        ...item,
        qty: item.qty,
        discount_total: resolvedLine.discountTotal,
        base_unit_price: baseUnitPrice,
        unit_price: effectiveUnitPrice,
        pricing_rule_name: pricingRule?.name || item.pricing_rule_name,
        pricing_rule_kind: pricingRule?.kind || item.pricing_rule_kind,
        pricing_group_label:
            resolvedLine.pricingGroupLabel || item.pricing_group_label,
    };

    return (
        <div
            className={`group flex items-start gap-2.5 rounded-xl p-2.5 transition-all ${
                highlightRewardProductIds.includes(Number(item.product_id || 0))
                    ? "bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900/40"
                    : "bg-slate-50 dark:bg-slate-800/50"
            }`}
        >
            <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 self-start overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700">
                {item.product?.image ? (
                    <img
                        src={getProductImageUrl(
                            item.product.image,
                            item.product.title
                        )}
                        alt={item.product.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = getProductImageUrl(
                                null,
                                item.product?.title || "Produk"
                            );
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <IconShoppingCart
                            size={14}
                            className="text-slate-400"
                        />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.product?.title || "Produk"}
                </p>
                {item.promo_reward_meta ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            {REWARD_ITEM_LABEL}
                        </span>
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            {item.promo_reward_meta?.rule_name || "Buy Get"}
                        </span>
                    </div>
                ) : null}
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {pricingRule && effectiveUnitPrice < baseUnitPrice && (
                        <p className="text-slate-400 line-through">
                            {formatPrice(baseUnitPrice)} × {item.qty}
                        </p>
                    )}
                    {buyGetBreakdown ? (
                        <div className="space-y-0.5">
                            {buyGetBreakdown.payableQty > 0 ? (
                                <p>
                                    {formatPrice(
                                        buyGetBreakdown.paidUnitPrice
                                    )}{" "}
                                    × {buyGetBreakdown.payableQty}
                                </p>
                            ) : null}
                            <p className="font-medium text-emerald-600 dark:text-emerald-300">
                                Bonus Rp 0 × {buyGetBreakdown.bonusQty}
                            </p>
                        </div>
                    ) : (
                        <p>
                            {formatPrice(effectiveUnitPrice)} × {item.qty}
                        </p>
                    )}
                    {hasPromoApplied(resolvedPromoItem) ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                {promoTitleText(resolvedPromoItem)}
                            </span>
                            {resolvedPromoItem.pricing_rule_kind ? (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {promoKindLabel(
                                        resolvedPromoItem.pricing_rule_kind
                                    )}
                                </span>
                            ) : null}
                        </div>
                    ) : promoSummary.title ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                {promoSummary.badge || "Promo"}
                            </span>
                            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-300">
                                {promoSummary.title}
                            </span>
                        </div>
                    ) : null}
                    {promoDetailText(resolvedPromoItem) ? (
                        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">
                            {promoDetailText(resolvedPromoItem)}
                        </p>
                    ) : promoSummary.detail ? (
                        <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                            {isCrossProductBuyGet
                                ? `Bonus: ${formatRuleItems(
                                      previewRule?.get_items || []
                                  )}. Tambahkan item bonus ke keranjang agar benefit final dihitung.`
                                : promoSummary.detail}
                        </p>
                    ) : null}
                    {!pricingRule && latentPromoPreview ? (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">
                            {latentPromoPreview.headline}
                        </p>
                    ) : null}
                    {isCrossProductBuyGet && previewRule && onAddRewardProducts ? (
                        <button
                            type="button"
                            onClick={() => onAddRewardProducts(previewRule)}
                            className="mt-2 inline-flex items-center rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-700 hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300 dark:hover:bg-primary-950/50"
                        >
                            Tambah item bonus
                        </button>
                    ) : null}
                </div>
                {item.product?.supports_modifiers && onOpenModifierModal ? (
                    <div className="mt-1.5">
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            Tambahan / topping
                        </label>
                        <div className="space-y-1.5">
                            {(item.product?.modifier_options || []).length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onOpenModifierModal(item)}
                                    disabled={modifierSaving}
                                    className="inline-flex items-center justify-center rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-[11px] font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-100 disabled:opacity-60 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300"
                                >
                                    {modifierActionLabel}
                                </button>
                            )}
                            {(item.modifiers || []).map((modifier) => (
                                <div
                                    key={modifier.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                                            {modifier.name}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            {formatPrice(modifier.total_price)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRemoveModifier?.(item.id, modifier.id)
                                        }
                                        disabled={modifierSaving}
                                        className="rounded-lg p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500 disabled:opacity-60 dark:hover:bg-danger-950/40"
                                    >
                                        <IconX size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (item.modifiers || []).length > 0 ? (
                    <div className="mt-1.5 grid gap-1">
                        {(item.modifiers || []).map((modifier) => (
                            <div
                                key={modifier.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                                        {modifier.name}
                                    </p>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        {formatPrice(modifier.total_price)}
                                    </p>
                                </div>
                                {onRemoveModifier ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRemoveModifier(item.id, modifier.id)
                                        }
                                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                                    >
                                        <IconX size={12} />
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <textarea
                            value={item.notes || ""}
                            onChange={(event) =>
                                onNotesChange?.(item.id, event.target.value)
                            }
                            onBlur={(event) =>
                                onNotesBlur?.(item.id, event.target.value)
                            }
                            rows={2}
                            placeholder={notePlaceholder}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                        {noteSaving ? (
                            <p className="mt-1 text-[10px] text-slate-400">
                                Menyimpan catatan...
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                            <button
                                onClick={() => onQtyChange?.(item.id, item.qty - 1)}
                                disabled={qtyUpdating || item.qty <= 1}
                                className="px-2 py-1.5 text-slate-500 disabled:opacity-40"
                            >
                                -
                            </button>
                            <span className="min-w-[32px] px-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {item.qty}
                            </span>
                            <button
                                onClick={() => onQtyChange?.(item.id, item.qty + 1)}
                                disabled={qtyUpdating}
                                className="px-2 py-1.5 text-slate-500 disabled:opacity-40"
                            >
                                +
                            </button>
                        </div>
                        {modifierTotal > 0 ? (
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                Topping {formatPrice(modifierTotal)}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex min-w-[88px] items-start justify-end gap-1.5">
                        <div className="text-right">
                            {baseLineTotal > effectiveLineTotal && (
                                <p className="text-[11px] text-slate-400 line-through">
                                    {formatPrice(baseLineTotal)}
                                </p>
                            )}
                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                                {formatPrice(effectiveLineTotal)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemoveItem?.(item.id)}
                            disabled={itemRemoving}
                            className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-500 dark:hover:bg-danger-950/50"
                        >
                            <IconTrash size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
