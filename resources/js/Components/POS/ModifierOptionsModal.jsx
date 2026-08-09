import React, { useRef, useState } from "react";
import LazyImage from "@/Components/Dashboard/LazyImage";
import { getProductImageUrl, getProductThumbUrl } from "@/Utils/imageUrl";
import {
    IconChevronDown,
    IconPhoto,
    IconChevronUp,
    IconX,
    IconToolsKitchen2,
    IconShoppingBag,
} from "@/Utils/icons";
import { PROMO_TOTAL_LABEL, formatRuleItems } from "@/Utils/pricingRules";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const normalizeModifierGroupName = (value) => {
    const normalized = String(value || "").trim();

    return normalized !== "" ? normalized : "Topping";
};

const resolveSelectionSummary = (group) => {
    const selectionMode =
        String(group?.selection_mode || "optional").trim() || "optional";
    const minSelect = Math.max(
        selectionMode === "optional" ? 0 : 1,
        Number(group?.min_select ?? 0)
    );
    const maxSelectRaw = Number(group?.max_select ?? 0);
    const maxSelect =
        selectionMode === "single" ? 1 : maxSelectRaw > 0 ? maxSelectRaw : null;

    if (selectionMode === "single") {
        return "Pilih 1 opsi";
    }

    if (minSelect > 0 && maxSelect !== null) {
        return `Wajib ${minSelect}-${maxSelect} opsi`;
    }

    if (minSelect > 0) {
        return `Wajib minimal ${minSelect} opsi`;
    }

    if (maxSelect !== null) {
        return `Opsional maksimal ${maxSelect} opsi`;
    }

    return "Opsional bebas pilih";
};

export default function ModifierOptionsModal({
    product = null,
    orderType = null,
    onOrderTypeChange = null,
    cartTargetId = null,
    quantity = 1,
    notesValue = "",
    onNotesChange,
    onQuantityChange,
    selectedModifierOptionIds = [],
    onToggleModifierOption,
    selectedModifierTotal = 0,
    promo = null,
    promoBenefit = null,
    isPromoDetailOpen = false,
    onTogglePromoDetail,
    onAddRewardProducts,
    onClose,
    onSubmit,
    isSubmitting = false,
}) {
    const applicableModifierOptions = (product?.modifier_options || []).filter(
        (option) => {
            const scope = String(option?.order_type_scope || "").trim();

            if (!scope || scope === "both") {
                return true;
            }

            if (!orderType) {
                return true;
            }

            return scope === orderType;
        }
    );
    const hasModifierOptions = applicableModifierOptions.length > 0;
    const selectedOptionIdSet = new Set(
        (selectedModifierOptionIds || []).map((id) => Number(id || 0))
    );
    const groupedModifierOptions = applicableModifierOptions.reduce(
        (groups, option) => {
            const groupName = normalizeModifierGroupName(option?.group_name);
            const currentGroup = groups[groupName] || {
                group_name: groupName,
                order_type_scope:
                    String(option?.order_type_scope || "").trim() || "",
                selection_mode:
                    String(option?.selection_mode || "optional").trim() ||
                    "optional",
                min_select: Number(option?.min_select ?? 0),
                max_select: Number(option?.max_select ?? 0),
                options: [],
            };

            currentGroup.options.push(option);
            groups[groupName] = currentGroup;

            return groups;
        },
        {}
    );
    const modifierGroups = Object.values(groupedModifierOptions);
    const requiresSelection = Boolean(product?.requires_modifier_selection);
    const groupValidation = modifierGroups.map((group) => {
        const selectionMode =
            String(group.selection_mode || "optional").trim() || "optional";
        const minSelect = Math.max(
            selectionMode === "optional" ? 0 : 1,
            Number(group.min_select ?? 0)
        );
        const maxSelectRaw = Number(group.max_select ?? 0);
        const maxSelect =
            selectionMode === "single"
                ? 1
                : maxSelectRaw > 0
                  ? maxSelectRaw
                  : null;
        const selectedCount = group.options.filter((option) =>
            selectedOptionIdSet.has(Number(option.id || 0))
        ).length;

        return {
            ...group,
            selectedCount,
            minSelect,
            maxSelect,
            isValid:
                selectedCount >= minSelect &&
                (maxSelect === null || selectedCount <= maxSelect),
        };
    });
    const selectionIsRequired =
        hasModifierOptions &&
        (requiresSelection || groupValidation.some((group) => group.minSelect > 0));
    const hasSatisfiedRequiredSelection =
        groupValidation.length > 0
            ? groupValidation.every((group) => group.isValid)
            : selectedOptionIdSet.size > 0;
    const modifierStatus = hasModifierOptions
        ? selectionIsRequired
            ? {
                  label: "Topping wajib dipilih",
                  description:
                      "Menu ini memiliki topping, dan ada pilihan yang wajib diisi sebelum bisa ditambahkan ke keranjang.",
                  className:
                      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200",
              }
            : {
                  label: "Topping tersedia",
                  description:
                      "Menu ini memiliki topping opsional. Anda boleh memilih topping atau langsung lanjut tanpa topping.",
                  className:
                      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200",
              }
        : {
              label: "Tanpa topping",
              description:
                  "Menu ini tidak memiliki topping atau extra. Cukup atur jumlah lalu tambahkan ke keranjang.",
              className:
                  "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
          };
    const heroClass = hasModifierOptions
        ? selectionIsRequired
            ? "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/20"
            : "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:border-sky-900/40 dark:from-sky-950/20 dark:via-slate-900 dark:to-cyan-950/20"
        : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800";
    const priceClass = hasModifierOptions
        ? selectionIsRequired
            ? "bg-amber-950 text-amber-50 shadow-amber-950/15 dark:bg-amber-500/20 dark:text-amber-100"
            : "bg-sky-950 text-sky-50 shadow-sky-950/15 dark:bg-sky-500/20 dark:text-sky-100"
        : "bg-slate-950 text-white shadow-slate-900/10 dark:bg-primary-500/20 dark:text-primary-100";

    // ----- UX: panduan topping & wizard (3 langkah) -----
    const modalScrollRef = useRef(null);
    const toppingSectionRef = useRef(null);
    const notesFieldRef = useRef(null);
    const notesSectionRef = useRef(null);
    const jenisSectionRef = useRef(null);
    const [toppingAlert, setToppingAlert] = useState(false);
    // Step 1 = Jenis Penyajian, step 2 = Topping/Menu, step 3 = Keterangan
    const [step, setStep] = useState("jenis");

    const scrollToSection = (target) => {
        const container = modalScrollRef.current;
        if (!container || !target) {
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        container.scrollTop += targetRect.top - containerRect.top - 16;
    };

    React.useEffect(() => {
        // Reset wizard setiap kali produk atau jenis penyajian berubah
        // (perubahan order type bisa mengubah set topping yang berlaku)
        setStep("jenis");
        setToppingAlert(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id, hasModifierOptions]);

    React.useEffect(() => {
        // Setiap modal dibuka atau langkah berubah, langsung arahkan scroll ke
        // section yang relevan agar user tidak perlu mencari-cari secara manual.
        const timer = window.setTimeout(() => {
            if (step === "jenis") {
                // Penyajian adalah langkah 1 dan disusun paling atas; pastikan
                // scroll kembali ke paling atas begitu modal untuk produk baru dibuka.
                modalScrollRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
                return;
            }

            scrollToSection(
                step === "notes"
                    ? notesSectionRef.current
                    : toppingSectionRef.current
            );
        }, 80);
        return () => window.clearTimeout(timer);
    }, [step, product?.id]);

    if (!product) {
        return null;
    }

    const handleNextToNotes = () => {
        // Validasi topping wajib sebelum lanjut ke keterangan
        if (selectionIsRequired && !hasSatisfiedRequiredSelection) {
            setToppingAlert(true);
            scrollToSection(toppingSectionRef.current);
            return;
        }

        setToppingAlert(false);
        setStep("notes");
    };

    const handleNextToToping = () => {
        setToppingAlert(false);
        setStep(hasModifierOptions ? "topping" : "notes");
    };

    const handleBackToJenis = () => {
        setToppingAlert(false);
        setStep("jenis");
    };

    const handleSubmit = () => {
        setToppingAlert(false);
        onSubmit?.(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                            Detail Menu
                        </p>
                        <h3 className="mt-1 break-words text-lg font-bold text-slate-900 dark:text-white">
                            {product.title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div ref={modalScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    {/* ===== Pilihan Take Away / Dine In per menu (langkah 1, paling atas) ===== */}
                    {step === "jenis" ? (
                        <div ref={jenisSectionRef} className="mx-5 mt-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                        Jenis Penyajian
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                                        {orderType === "take_away"
                                            ? "Akan dicatat [TAKE AWAY] di keterangan agar dapur tahu & bungkus wajib dipilih."
                                            : "Akan dicatat [DINE IN] di keterangan agar dapur tahu."}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOrderTypeChange?.("dine_in")}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                                        orderType === "dine_in"
                                            ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                    }`}
                                >
                                    <IconToolsKitchen2 size={16} />
                                    Dine In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOrderTypeChange?.("take_away")}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                                        orderType === "take_away"
                                            ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                    }`}
                                >
                                    <IconShoppingBag size={16} />
                                    Take Away
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div className={`mx-5 mt-4 overflow-hidden rounded-[28px] border shadow-sm ${heroClass}`}>
                        <div className="grid gap-0 sm:grid-cols-[160px,minmax(0,1fr)]">
                            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800 sm:aspect-auto sm:h-full">
                                {product.image ? (
                                    <LazyImage
                                        src={getProductThumbUrl(product.image, product.title)}
                                        fallbackSrc={getProductImageUrl(product.image, product.title)}
                                        alt={product.title}
                                        className="h-full w-full"
                                        imgClassName="h-full w-full object-cover"
                                        fallback={
                                            <div className="flex h-full w-full items-center justify-center">
                                                <IconPhoto size={34} className="text-slate-400" />
                                            </div>
                                        }
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <IconPhoto size={34} className="text-slate-400" />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    {product.category?.name ? (
                                        <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
                                            {product.category.name}
                                        </span>
                                    ) : null}
                                    {product.tenant_outlet?.name ? (
                                        <span className="rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                            {product.tenant_outlet.name}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto] sm:items-start">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                            Detail Menu
                                        </p>
                                        <p className="mt-1 break-words text-xl font-black leading-tight text-slate-950 dark:text-white">
                                            {product.title}
                                        </p>
                                    </div>
                                    <div className={`rounded-2xl px-3 py-2 text-left shadow-lg ${priceClass}`}>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
                                            Harga
                                        </p>
                                        <p className="break-words text-base font-bold">
                                            {formatPrice(product.sell_price)}
                                        </p>
                                    </div>
                                </div>
                                <p className="break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {product.description
                                        ? product.description
                                        : "Menu ini siap dipesan dari meja. Tambahkan topping atau catatan bila diperlukan sebelum masuk ke keranjang."}
                                </p>
                                <div className={`rounded-2xl border px-4 py-3 ${modifierStatus.className}`}>
                                    <p className="text-xs font-bold uppercase tracking-[0.16em]">
                                        {modifierStatus.label}
                                    </p>
                                    <p className="mt-1 text-sm leading-6">
                                        {modifierStatus.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== Indikator langkah (simpel) ===== */}
                    <div className="mx-5 mt-4 flex items-center gap-2">
                        {[
                            { key: "jenis", label: "1. Penyajian" },
                            hasModifierOptions
                                ? { key: "topping", label: "2. Topping" }
                                : { key: "menu", label: "2. Menu" },
                            { key: "notes", label: "3. Keterangan" },
                        ].map((item, index) => {
                            const stepOrder = ["jenis", "topping", "menu", "notes"];
                            const currentIndex = stepOrder.indexOf(step);
                            const isDone = index < currentIndex;

                            return (
                                <React.Fragment key={item.key}>
                                    {index > 0 ? (
                                        <span className="h-px w-5 shrink-0 bg-slate-200 dark:bg-slate-700" />
                                    ) : null}
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                                            step === item.key
                                                ? "bg-primary-600 text-white shadow-sm"
                                                : isDone
                                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        }`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                step === item.key
                                                    ? "bg-white"
                                                    : isDone
                                                      ? "bg-emerald-500"
                                                      : "bg-current"
                                            }`}
                                        />
                                        {item.label}
                                    </span>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {product.pricing_badge && promo && promoBenefit ? (
                        <div
                            className={`mx-5 mt-4 rounded-2xl border px-4 py-3 ${
                                promoBenefit.status === "active"
                                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                    : promoBenefit.status === "pending"
                                      ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                                      : "border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/20"
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${
                                        promoBenefit.status === "active"
                                            ? "bg-emerald-500"
                                            : promoBenefit.status === "pending"
                                              ? "bg-amber-500"
                                              : "bg-sky-500"
                                    }`}
                                >
                                    {promo.badge || "Promo"}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                                        {promo.title || PROMO_TOTAL_LABEL}
                                    </p>
                                    {promo.detail ? (
                                        <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-300">
                                            {promo.detail}
                                        </p>
                                    ) : null}
                                    {!cartTargetId &&
                                    promo.minimumQuantity > 1 &&
                                    promo.quantity < promo.minimumQuantity ? (
                                        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                            Promo aktif mulai qty {promo.minimumQuantity}.
                                        </p>
                                    ) : null}
                                    {promo.baseUnitPrice > 0 ? (
                                        <div className="mt-1 flex items-center gap-2 text-xs">
                                            {promo.promoEligible &&
                                            promo.effectiveUnitPrice < promo.baseUnitPrice ? (
                                                <>
                                                    <span className="text-rose-500 line-through">
                                                        {formatPrice(promo.baseUnitPrice)}
                                                    </span>
                                                    <span className="font-bold text-rose-700 dark:text-rose-200">
                                                        {formatPrice(promo.effectiveUnitPrice)}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="font-bold text-rose-700 dark:text-rose-200">
                                                    {formatPrice(promo.baseUnitPrice)}
                                                </span>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div
                                className={`mt-3 rounded-2xl px-3 py-3 text-sm ${
                                    promoBenefit.status === "active"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        : promoBenefit.status === "pending"
                                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                          : "bg-white/70 text-rose-700 dark:bg-slate-900/50 dark:text-rose-200"
                                }`}
                            >
                                <p className="font-semibold">{promoBenefit.headline}</p>
                                {promoBenefit.detail ? (
                                    <p className="mt-1 text-xs opacity-90">
                                        {promoBenefit.detail}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={onTogglePromoDetail}
                                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-slate-800"
                            >
                                {isPromoDetailOpen
                                    ? "Sembunyikan benefit"
                                    : "Lihat benefit promo"}
                                {isPromoDetailOpen ? (
                                    <IconChevronUp size={14} />
                                ) : (
                                    <IconChevronDown size={14} />
                                )}
                            </button>
                            {isPromoDetailOpen ? (
                                <div className="mt-3 rounded-2xl border border-rose-200/70 bg-white/80 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/30 dark:bg-slate-900/60 dark:text-rose-200">
                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Rule</span>
                                            <strong className="text-right">
                                                {promo.title || "Promo"}
                                            </strong>
                                        </div>
                                        {product?.pricing_badge?.pricing_rule?.kind ===
                                        "buy_x_get_y" ? (
                                            <>
                                                <div className="flex items-start justify-between gap-3">
                                                    <span>Syarat beli</span>
                                                    <strong className="text-right">
                                                        {formatRuleItems(
                                                            product?.pricing_badge?.pricing_rule
                                                                ?.buy_items || []
                                                        ) || "-"}
                                                    </strong>
                                                </div>
                                                <div className="flex items-start justify-between gap-3">
                                                    <span>Bonus</span>
                                                    <strong className="text-right">
                                                        {formatRuleItems(
                                                            product?.pricing_badge?.pricing_rule
                                                                ?.get_items || []
                                                        ) || "-"}
                                                    </strong>
                                                </div>
                                                {product?.pricing_badge?.pricing_rule?.get_items?.some(
                                                    (rewardItem) =>
                                                        Number(rewardItem.product_id || 0) !==
                                                        Number(product?.id || 0)
                                                ) && onAddRewardProducts ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onAddRewardProducts(
                                                                product?.pricing_badge?.pricing_rule
                                                            )
                                                        }
                                                        className="mt-2 inline-flex items-center justify-center rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300 dark:hover:bg-primary-950/50"
                                                    >
                                                        Tambah item bonus ke keranjang
                                                    </button>
                                                ) : null}
                                            </>
                                        ) : null}
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Qty dipilih</span>
                                            <strong>{quantity}</strong>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Estimasi subtotal</span>
                                            <strong>{formatPrice(promoBenefit.lineTotal)}</strong>
                                        </div>
                                        {promoBenefit.savings > 0 ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <span>Estimasi hemat</span>
                                                <strong>{formatPrice(promoBenefit.savings)}</strong>
                                            </div>
                                        ) : null}
                                        {promo.detail ? (
                                            <p className="pt-1 leading-5 text-rose-600 dark:text-rose-300">
                                                {promo.detail}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {hasModifierOptions && step === "topping" ? (
                        <div ref={toppingSectionRef} className="space-y-3 px-5 py-4">
                            {groupValidation.map((group) => (
                                <div
                                    key={group.group_name}
                                    className={`overflow-hidden rounded-2xl border ${
                                        group.isValid
                                            ? "border-sky-200 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/10"
                                            : "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10"
                                    }`}
                                >
                                    <div className="border-b border-current/10 px-4 py-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                                                    Kategori Topping
                                                </p>
                                                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                                                    {group.group_name}
                                                    {group.order_type_scope ? (
                                                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                            {group.order_type_scope === "take_away"
                                                                ? "Take-away"
                                                                : "Dine-in"}
                                                        </span>
                                                    ) : null}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                    {resolveSelectionSummary(group)}
                                                </p>
                                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                    Dipilih {group.selectedCount}
                                                    {group.maxSelect
                                                        ? ` / ${group.maxSelect}`
                                                        : ""}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 p-3">
                                        {group.options.map((option) => {
                                            const active =
                                                selectedOptionIdSet.has(
                                                    Number(option.id || 0)
                                                );
                                            const isOutOfStock =
                                                option.stock !== null &&
                                                option.stock !== undefined &&
                                                Number(option.stock) <= 0;

                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isOutOfStock) {
                                                            return;
                                                        }

                                                        onToggleModifierOption?.(
                                                            option.id
                                                        );
                                                    }}
                                                    disabled={isOutOfStock}
                                                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                                        isOutOfStock
                                                            ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60 dark:border-slate-800 dark:bg-slate-800/60"
                                                        : active
                                                          ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30"
                                                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                                    }`}
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                            {option.name}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Tambahan{" "}
                                                            {formatPrice(
                                                                option.price
                                                            )}
                                                        </p>
                                                        {isOutOfStock ? (
                                                            <p className="mt-1 text-xs font-semibold text-rose-500">
                                                                Topping habis
                                                            </p>
                                                        ) : option.stock !== null &&
                                                          option.stock !== undefined ? (
                                                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                                Sisa {Number(option.stock)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div
                                                        className={`h-5 w-5 rounded-md border ${
                                                            active
                                                                ? "border-primary-500 bg-primary-500"
                                                                : "border-slate-300 dark:border-slate-600"
                                                        }`}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {step === "notes" ? (
                        <div ref={notesSectionRef} className="px-5 pb-4 pt-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Catatan Item
                                </p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                    Tambahkan keterangan khusus untuk item ini sebelum masuk ke keranjang.
                                </p>
                                <textarea
                                    ref={notesFieldRef}
                                    rows={3}
                                    value={notesValue || ""}
                                    onChange={(event) =>
                                        onNotesChange?.(event.target.value)
                                    }
                                    placeholder="Contoh: jangan pedas, kuah dipisah, tanpa bawang"
                                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                />
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                    {!cartTargetId && step === "notes" ? (
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Jumlah
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onQuantityChange?.(
                                                Math.max(1, Number(quantity || 1) - 1)
                                            )
                                        }
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        -
                                    </button>
                                    <div className="min-w-[56px] rounded-xl bg-white px-3 py-2 text-center text-sm font-bold text-slate-900 dark:bg-slate-900 dark:text-white">
                                        {quantity}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onQuantityChange?.(Number(quantity || 1) + 1)
                                        }
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Estimasi subtotal
                                </p>
                                <div className="mt-1.5 text-right">
                                    {promoBenefit &&
                                    promo?.promoEligible &&
                                    promoBenefit.lineTotal < promo.baseLineTotal ? (
                                        <p className="text-xs text-slate-400 line-through">
                                            {formatPrice(promo.baseLineTotal)}
                                        </p>
                                    ) : null}
                                    <p className="text-base font-bold text-slate-900 dark:text-white">
                                        {promoBenefit
                                            ? formatPrice(promoBenefit.lineTotal)
                                            : formatPrice(
                                                  (Number(product.sell_price) +
                                                      selectedModifierTotal) *
                                                      Math.max(1, Number(quantity || 1))
                                              )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="mb-3 flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                            Total tambahan
                        </span>
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                            {formatPrice(
                                selectedModifierTotal *
                                    Math.max(1, cartTargetId ? 1 : quantity)
                            )}
                        </span>
                    </div>
                    {step === "topping" &&
                    selectionIsRequired &&
                    !hasSatisfiedRequiredSelection ? (
                        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
                            Pilih topping yang wajib terlebih dahulu untuk lanjut.
                        </div>
                    ) : null}
                    {step === "jenis" ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleNextToToping}
                                disabled={isSubmitting}
                                className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                            >
                                {hasModifierOptions
                                    ? "Lanjut ke Topping"
                                    : "Lanjut ke Keterangan"}
                            </button>
                        </div>
                    ) : step === "topping" || step === "menu" ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={handleBackToJenis}
                                disabled={isSubmitting}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={handleNextToNotes}
                                disabled={isSubmitting}
                                className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${
                                    selectionIsRequired &&
                                    !hasSatisfiedRequiredSelection
                                        ? "animate-pulse bg-amber-500 hover:bg-amber-600 ring-2 ring-amber-300"
                                        : "bg-primary-500 hover:bg-primary-600"
                                }`}
                            >
                                {selectionIsRequired &&
                                !hasSatisfiedRequiredSelection
                                    ? "Pilih topping dulu"
                                    : "Lanjut ke Keterangan"}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={handleBackToJenis}
                                disabled={isSubmitting}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                            >
                                {isSubmitting
                                    ? "Menyimpan..."
                                    : cartTargetId
                                      ? "Simpan topping"
                                      : "Tambah ke keranjang"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
