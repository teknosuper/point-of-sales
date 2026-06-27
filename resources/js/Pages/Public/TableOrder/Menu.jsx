import ModifierOptionsModal from "@/Components/POS/ModifierOptionsModal";
import CartLineItem from "@/Components/POS/CartLineItem";
import ProductGrid from "@/Components/POS/ProductGrid";
import {
    buildCartPromoState,
    buildLocalPricingPreview,
    buildPricingItemsByCartId,
    hasPromoApplied,
    normalizeBuyGetRewardCarts,
    promoBadgeSummary,
    promoBenefitPreview,
    promoDetailText,
    promoKindLabel,
    promoTitleText,
    resolveCartPricingLine,
    shouldUseLocalPricingPreview,
    PROMO_TOTAL_LABEL,
} from "@/Utils/pricingRules";
import { IconCash, IconReceipt, IconShoppingCart, IconX } from "@/Utils/icons";
import axios from "axios";
import { Head, Link, useForm, usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

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

const sanitizePhoneNumber = (value = "") =>
    String(value)
        .replace(/[^\d+]/g, "")
        .replace(/(?!^)\+/g, "")
        .slice(0, 16);

const isValidPhoneNumber = (value = "") =>
    /^(?:\+62|62|0)[0-9]{8,13}$/.test(String(value).trim());

const orderStatusLabel = {
    pending_cashier_payment: "Menunggu approval kasir",
    paid: "Sudah dibayar",
    rejected: "Ditolak kasir",
    cancelled: "Dibatalkan",
};

const emptyPricingPreview = {
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

function IdentityGate({
    customer,
    pendingPhone,
    table,
    identifyForm,
    registerForm,
    submitIdentify,
    submitRegister,
    identifyPhoneInputRef,
    registerNameInputRef,
}) {
    if (customer) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                {!pendingPhone ? (
                    <>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                            Self Order
                        </p>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                            Masukkan nomor HP
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Nomor ini wajib agar promo customer, histori order,
                            dan status pembayaran kasir bisa terhubung.
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                            Meja {table.code || table.name}
                        </p>

                        <form onSubmit={submitIdentify} className="mt-5 space-y-4">
                            <div>
                                <input
                                    ref={identifyPhoneInputRef}
                                    type="text"
                                    value={identifyForm.data.no_telp}
                                    onChange={(event) =>
                                        identifyForm.setData(
                                            "no_telp",
                                            sanitizePhoneNumber(event.target.value)
                                        )
                                    }
                                    placeholder="08xxxxxxxxxx"
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                                />
                                {identifyForm.errors.no_telp ? (
                                    <p className="mt-2 text-sm text-rose-600">
                                        {identifyForm.errors.no_telp}
                                    </p>
                                ) : null}
                            </div>

                            <button
                                type="submit"
                                disabled={identifyForm.processing}
                                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 disabled:opacity-50"
                            >
                                {identifyForm.processing
                                    ? "Memeriksa nomor..."
                                    : "Masuk ke POS Self Order"}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                            Lengkapi Profil
                        </p>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                            Nomor belum terdaftar
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Cukup isi nama pelanggan agar order meja ini bisa lanjut.
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                            Nomor: {pendingPhone}
                        </p>

                        <form onSubmit={submitRegister} className="mt-5 space-y-4">
                            <div>
                                <input
                                    ref={registerNameInputRef}
                                    type="text"
                                    value={registerForm.data.name}
                                    onChange={(event) =>
                                        registerForm.setData("name", event.target.value)
                                    }
                                    placeholder="Nama pelanggan"
                                    autoComplete="name"
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                                />
                                {registerForm.errors.name ? (
                                    <p className="mt-2 text-sm text-rose-600">
                                        {registerForm.errors.name}
                                    </p>
                                ) : null}
                            </div>

                            <button
                                type="submit"
                                disabled={registerForm.processing}
                                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 disabled:opacity-50"
                            >
                                {registerForm.processing
                                    ? "Menyimpan profil..."
                                    : "Masuk dan mulai order"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default function Menu({
    table,
    outlet,
    products = [],
    identity,
    editableOrder = null,
}) {
    const { flash, storeProfile } = usePage().props;
    const customer = identity?.customer || null;
    const pendingPhone = identity?.pending_phone || "";
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];

    const identifyPhoneInputRef = useRef(null);
    const registerNameInputRef = useRef(null);
    const searchInputRef = useRef(null);
    const pricingRequestAbortRef = useRef(null);
    const pricingRequestTimerRef = useRef(null);
    const modifierModalPricingAbortRef = useRef(null);
    const modifierModalPricingTimerRef = useRef(null);
    const editableOrderHydratedTokenRef = useRef(null);
    const editableOrderOpenedRef = useRef(false);
    const cartStorageHydratedKeyRef = useRef(null);
    const orderNotesFocusedRef = useRef(false);
    const floatingCartDragRef = useRef({
        dragging: false,
        moved: false,
        startX: 0,
        startY: 0,
        originX: 16,
        originY: 96,
    });

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileView, setMobileView] = useState("products");
    const [floatingCartPosition, setFloatingCartPosition] = useState({
        x: 16,
        y: 96,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [addingProductId, setAddingProductId] = useState(null);
    const [cartLines, setCartLines] = useState([]);
    const [pricingPreview, setPricingPreview] = useState(emptyPricingPreview);
    const [isLoadingPricing, setIsLoadingPricing] = useState(false);
    const [modifierModalProduct, setModifierModalProduct] = useState(null);
    const [modifierModalQuantity, setModifierModalQuantity] = useState(1);
    const [modifierModalNotes, setModifierModalNotes] = useState("");
    const [orderNotesDraft, setOrderNotesDraft] = useState("");
    const [selectedModifierOptionIds, setSelectedModifierOptionIds] = useState(
        []
    );
    const [isModifierPromoDetailOpen, setIsModifierPromoDetailOpen] =
        useState(false);
    const [isModifierModalSubmitting, setIsModifierModalSubmitting] =
        useState(false);
    const [modifierModalPricingPreview, setModifierModalPricingPreview] =
        useState(null);
    const [recentRewardProductIds, setRecentRewardProductIds] = useState([]);

    const orderForm = useForm({
        notes: "",
        items: [],
    });
    const identifyForm = useForm({
        no_telp: pendingPhone,
    });
    const registerForm = useForm({
        name: "",
        email: "",
        address: "",
    });
    const logoutForm = useForm({});

    useEffect(() => {
        if (orderNotesFocusedRef.current) {
            return;
        }

        setOrderNotesDraft(orderForm.data.notes || "");
    }, [orderForm.data.notes]);

    const productsById = useMemo(
        () =>
            products.reduce((accumulator, product) => {
                accumulator[Number(product.id)] = product;
                return accumulator;
            }, {}),
        [products]
    );
    const cartStorageKey = editableOrder?.access_token
        ? `table-order-edit:${editableOrder.access_token}`
        : customer?.id
          ? `table-order-cart:${table.qr_token}:${customer.id}`
        : null;

    const normalizedCarts = useMemo(
        () =>
            normalizeBuyGetRewardCarts(
                cartLines.map((item) => ({
                    ...item,
                    product:
                        productsById[Number(item.product_id)] ||
                        item.product ||
                        null,
                    modifiers: (item.modifiers || []).map((modifier) => ({
                        ...modifier,
                        total_price:
                            Number(modifier.unit_price || modifier.price || 0) *
                            Number(item.qty || 0),
                    })),
                })),
                productsById
            ),
        [cartLines, productsById]
    );
    const pricingDependency = useMemo(
        () =>
            normalizedCarts
                .map(
                    (item) =>
                        [
                            String(item.id),
                            Number(item.qty || 0),
                            String(item.notes || ""),
                            (item.modifiers || [])
                                .map((modifier) => modifier.id)
                                .join(","),
                            item.promo_reward_meta?.rule_name || "",
                        ].join("::")
                )
                .join("|"),
        [normalizedCarts]
    );

    const resolvedPricingPreview = useMemo(() => {
        if (shouldUseLocalPricingPreview(normalizedCarts, pricingPreview)) {
            return buildLocalPricingPreview(normalizedCarts);
        }

        return pricingPreview;
    }, [normalizedCarts, pricingPreview]);
    const pricingItemsByCartId = useMemo(
        () => buildPricingItemsByCartId(resolvedPricingPreview),
        [resolvedPricingPreview]
    );

    const baseSubtotal = Number(
        resolvedPricingPreview?.summary?.base_subtotal ?? 0
    );
    const promoDiscount = Number(
        resolvedPricingPreview?.summary?.promo_discount_total ?? 0
    );
    const subtotal = Number(
        resolvedPricingPreview?.summary?.subtotal_after_promo ?? 0
    );
    const payable = Number(
        resolvedPricingPreview?.summary?.grand_total ?? subtotal ?? 0
    );
    const appliedPromoGroups = useMemo(() => {
        const groups = resolvedPricingPreview?.applied_groups || [];

        return Object.values(
            groups.reduce((accumulator, group, index) => {
                const label =
                    group?.label || group?.rule?.name || `Promo ${index + 1}`;
                const key = `${group?.rule?.id || "rule"}:${label}`;

                if (!accumulator[key]) {
                    accumulator[key] = {
                        key,
                        label,
                        count: 0,
                        discount_total: 0,
                    };
                }

                accumulator[key].count += 1;
                accumulator[key].discount_total += Number(
                    group?.discount_total || 0
                );

                return accumulator;
            }, {})
        );
    }, [resolvedPricingPreview]);
    const paymentPreviewItems = useMemo(
        () =>
            normalizedCarts.map((item) => {
                const fallbackProduct =
                    productsById[Number(item.product_id || 0)] || item.product;
                const pricingItem = pricingItemsByCartId[item.id];
                const promoState = buildCartPromoState({
                    cartItem: item,
                    pricingItem,
                    fallbackProduct,
                    formatPrice,
                });
                const { resolvedLine, pricingRule } = promoState;

                return {
                    item,
                    promoState,
                    resolvedPromoItem: {
                        ...item,
                        qty: item.qty,
                        discount_total: resolvedLine.discountTotal,
                        base_unit_price: resolvedLine.baseUnitPrice,
                        unit_price: resolvedLine.effectiveUnitPrice,
                        pricing_rule_name:
                            pricingRule?.name || item.pricing_rule_name,
                        pricing_rule_kind:
                            pricingRule?.kind || item.pricing_rule_kind,
                        pricing_group_label:
                            resolvedLine.pricingGroupLabel ||
                            item.pricing_group_label,
                    },
                };
            }),
        [
            buildCartPromoState,
            formatPrice,
            normalizedCarts,
            pricingItemsByCartId,
            productsById,
        ]
    );
    const cartCount = normalizedCarts.reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0
    );

    const modifierModalSelectedModifierTotal = useMemo(
        () =>
            (modifierModalProduct?.modifier_options || [])
                .filter((option) =>
                    new Set(
                        selectedModifierOptionIds.map((id) => Number(id || 0))
                    ).has(Number(option.id || 0))
                )
                .reduce((sum, option) => sum + Number(option.price || 0), 0),
        [modifierModalProduct, selectedModifierOptionIds]
    );
    const modifierModalDraftCart = useMemo(() => {
        if (!modifierModalProduct?.id) {
            return null;
        }

        return {
            id: `draft-${modifierModalProduct.id}`,
            product_id: Number(modifierModalProduct.id),
            qty: Math.max(1, Number(modifierModalQuantity || 1)),
            notes: modifierModalNotes,
            product: modifierModalProduct,
            modifiers: (modifierModalProduct.modifier_options || [])
                .filter((option) =>
                    new Set(
                        selectedModifierOptionIds.map((id) => Number(id || 0))
                    ).has(Number(option.id || 0))
                )
                .map((option) => ({
                    id: Number(option.id),
                    group_name: option.group_name || null,
                    selection_mode: option.selection_mode || null,
                    name: option.name,
                    price: Number(option.price || 0),
                    unit_price: Number(option.price || 0),
                    total_price:
                        Number(option.price || 0) *
                        Math.max(1, Number(modifierModalQuantity || 1)),
                })),
            promo_reward_meta: null,
            is_promo_reward: false,
        };
    }, [
        modifierModalNotes,
        modifierModalProduct,
        modifierModalQuantity,
        selectedModifierOptionIds,
    ]);
    const modifierModalDraftPricingItem = useMemo(() => {
        if (!modifierModalDraftCart?.id) {
            return null;
        }

        return (
            (modifierModalPricingPreview?.items || []).find(
                (item) =>
                    String(item?.cart_id) === String(modifierModalDraftCart.id)
            ) || null
        );
    }, [modifierModalDraftCart, modifierModalPricingPreview]);
    const modifierModalPromo = useMemo(() => {
        const badge = modifierModalProduct?.pricing_badge;
        const fallbackRule = badge?.pricing_rule || null;
        const resolvedLine = modifierModalDraftCart
            ? resolveCartPricingLine(
                  modifierModalDraftCart,
                  modifierModalDraftPricingItem
              )
            : null;
        const rule =
            modifierModalDraftPricingItem?.pricing_rule || fallbackRule || null;
        const quantity = Math.max(
            1,
            Number(modifierModalDraftCart?.qty || modifierModalQuantity || 1)
        );
        const baseUnitPrice = Number(
            resolvedLine?.baseUnitPrice ??
                badge?.base_price ??
                modifierModalProduct?.sell_price ??
                0
        );
        const effectiveUnitPrice = Number(
            resolvedLine?.effectiveUnitPrice ??
                badge?.promo_price ??
                baseUnitPrice
        );
        const minimumQuantity = Math.max(
            1,
            Number(rule?.minimum_quantity || rule?.preview_quantity || 1)
        );
        const promoEligible =
            Boolean(rule) &&
            (Number(modifierModalDraftPricingItem?.line_discount_total || 0) > 0 ||
                effectiveUnitPrice < baseUnitPrice ||
                rule.kind !== "qty_break" ||
                quantity >= minimumQuantity);
        const summary = promoBadgeSummary(
            rule,
            badge?.label || badge?.rule_name || null
        );

        return {
            ...summary,
            quantity,
            minimumQuantity,
            promoEligible,
            baseUnitPrice,
            effectiveUnitPrice,
            baseLineTotal: Number(
                resolvedLine?.baseLineTotal ?? baseUnitPrice * quantity
            ),
            effectiveLineTotal: Number(
                resolvedLine?.effectiveLineTotal ?? effectiveUnitPrice * quantity
            ),
        };
    }, [
        modifierModalDraftCart,
        modifierModalDraftPricingItem,
        modifierModalProduct,
        modifierModalQuantity,
    ]);
    const modifierModalPromoBenefit = useMemo(
        () =>
            promoBenefitPreview({
                rule:
                    modifierModalDraftPricingItem?.pricing_rule ||
                    modifierModalProduct?.pricing_badge?.pricing_rule ||
                    null,
                quantity: modifierModalQuantity,
                baseUnitPrice: modifierModalPromo.baseUnitPrice,
                effectiveUnitPrice: modifierModalPromo.effectiveUnitPrice,
                productId: modifierModalProduct?.id,
                formatPrice,
            }),
        [
            modifierModalDraftPricingItem,
            modifierModalProduct,
            modifierModalPromo,
            modifierModalQuantity,
        ]
    );

    const createCartLine = useCallback(
        (
            product,
            modifiers = [],
            quantity = 1,
            rewardPromoMeta = null,
            notes = ""
        ) => ({
            id: `line-${product.id}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            product_id: Number(product.id),
            qty: Math.max(1, Number(quantity || 1)),
            notes,
            product,
            modifiers: modifiers.map((modifier) => ({
                id: Number(modifier.id),
                name: modifier.name,
                price: Number(modifier.price || 0),
                unit_price: Number(modifier.price || 0),
            })),
            promo_reward_meta: rewardPromoMeta,
            is_promo_reward: Boolean(rewardPromoMeta),
        }),
        []
    );
    const buildEditableOrderCartLines = useCallback(
        (sourceOrder) =>
            (sourceOrder?.items || [])
                .map((line) => {
                    const product = productsById[Number(line.product_id || 0)];
                    if (!product) {
                        return null;
                    }

                    return {
                        id: `edit-${sourceOrder.access_token}-${line.id}`,
                        product_id: Number(line.product_id),
                        qty: Math.max(1, Number(line.qty || 1)),
                        notes: line.notes || "",
                        product,
                        modifiers: (line.modifiers || []).map((modifier) => ({
                            id: Number(modifier.id),
                            name: modifier.name,
                            group_name: modifier.group_name || null,
                            price: Number(modifier.unit_price || 0),
                            unit_price: Number(modifier.unit_price || 0),
                        })),
                        promo_reward_meta: null,
                        is_promo_reward: false,
                    };
                })
                .filter(Boolean),
        [productsById]
    );
    const buildPreviewRequestItems = useCallback(
        (items = []) =>
            items.map((item) => ({
                client_key: String(item.id),
                product_id: item.product_id,
                qty: item.qty,
                notes: item.notes || null,
                is_promo_reward: Boolean(item.promo_reward_meta),
                promo_reward_rule_name:
                    item.promo_reward_meta?.rule_name || null,
                promo_reward_label:
                    item.promo_reward_meta?.reward_label || null,
                modifiers: (item.modifiers || []).map((modifier) => ({
                    id: modifier.id,
                })),
            })),
        []
    );

    const plainProductQty = useCallback(
        (productId) =>
            cartLines
                .filter(
                    (line) =>
                        Number(line.product_id) === Number(productId) &&
                        (!line.modifiers || line.modifiers.length === 0) &&
                        !line.promo_reward_meta
                )
                .reduce((sum, line) => sum + Number(line.qty || 0), 0),
        [cartLines]
    );

    const addProductToCart = useCallback(
        async (product, options = {}) => {
            const quantity = Math.max(1, Number(options?.qty || 1));
            const rewardPromoMeta = options?.rewardPromoMeta || null;
            const notes = String(options?.notes || "");
            const selectedModifiers = Array.isArray(options?.modifiers)
                ? options.modifiers
                : [];

            setAddingProductId(product.id);

            try {
                setCartLines((current) => {
                    if (
                        selectedModifiers.length > 0 ||
                        rewardPromoMeta ||
                        product.supports_modifiers
                    ) {
                        return [
                            ...current,
                            createCartLine(
                                product,
                                selectedModifiers,
                                quantity,
                                rewardPromoMeta,
                                notes
                            ),
                        ];
                    }

                    const existingIndex = current.findIndex(
                        (line) =>
                            Number(line.product_id) === Number(product.id) &&
                            (!line.modifiers || line.modifiers.length === 0) &&
                            !line.promo_reward_meta
                    );

                    if (existingIndex < 0) {
                        return [
                            ...current,
                            createCartLine(product, [], quantity, null, notes),
                        ];
                    }

                    return current.map((line, index) =>
                        index === existingIndex
                            ? {
                                  ...line,
                                  qty: Math.min(
                                      Number(product.stock || quantity),
                                      Number(line.qty || 0) + quantity
                                  ),
                              }
                            : line
                    );
                });

                return true;
            } finally {
                setAddingProductId(null);
            }
        },
        [createCartLine]
    );

    const handleAddRewardProducts = useCallback(
        async (rule, options = {}) => {
            if (
                !rule ||
                rule.kind !== "buy_x_get_y" ||
                !Array.isArray(rule?.buy_items) ||
                !Array.isArray(rule?.get_items)
            ) {
                return;
            }

            const buyItems = rule.buy_items;
            const rewardItems = rule.get_items;
            const ruleName =
                rule?.name || rule?.label || promoBadgeSummary(rule).title || "Promo";
            const buyAdjustments = Array.isArray(options?.buyAdjustments)
                ? options.buyAdjustments
                : [];
            const buyCartQuantities = normalizedCarts.reduce(
                (accumulator, item) => {
                    if (item.promo_reward_meta) {
                        return accumulator;
                    }

                    const productId = Number(item.product_id || 0);
                    accumulator[productId] =
                        (accumulator[productId] || 0) + Number(item.qty || 0);
                    return accumulator;
                },
                {}
            );

            for (const adjustment of buyAdjustments) {
                const productId = Number(adjustment?.product_id || 0);
                const qty = Number(adjustment?.qty || 0);
                if (productId > 0 && qty > 0) {
                    buyCartQuantities[productId] =
                        Number(buyCartQuantities[productId] || 0) + qty;
                }
            }

            const existingRewardQuantities = normalizedCarts.reduce(
                (accumulator, item) => {
                    if (item.promo_reward_meta?.rule_name !== ruleName) {
                        return accumulator;
                    }

                    const productId = Number(item.product_id || 0);
                    accumulator[productId] =
                        (accumulator[productId] || 0) + Number(item.qty || 0);
                    return accumulator;
                },
                {}
            );

            const completedCycles = buyItems.reduce((currentMin, buyItem) => {
                const productId = Number(buyItem.product_id || 0);
                const requiredQty = Math.max(1, Number(buyItem.quantity || 1));
                const currentQty = Number(buyCartQuantities[productId] || 0);
                const nextCycles = Math.floor(currentQty / requiredQty);

                return currentMin === null
                    ? nextCycles
                    : Math.min(currentMin, nextCycles);
            }, null);

            if (!completedCycles || completedCycles <= 0) {
                toast.error("Syarat promo buy-get belum terpenuhi.");
                return;
            }

            const addedRewardProductIds = [];
            const missingRewards = [];

            for (const rewardItem of rewardItems) {
                const rewardProductId = Number(rewardItem.product_id || 0);
                const requiredQty =
                    Math.max(1, Number(rewardItem.quantity || 1)) *
                    completedCycles;
                const currentQty = Number(
                    existingRewardQuantities[rewardProductId] || 0
                );
                const qtyToAdd = Math.max(0, requiredQty - currentQty);

                if (qtyToAdd <= 0) {
                    continue;
                }

                const rewardProduct = productsById[rewardProductId] || null;
                if (!rewardProduct) {
                    missingRewards.push(
                        rewardItem.product_title || `Produk #${rewardProductId}`
                    );
                    continue;
                }

                await addProductToCart(rewardProduct, {
                    qty: qtyToAdd,
                    rewardPromoMeta: {
                        rule_name: ruleName,
                        reward_label:
                            rewardItem.product_title || rewardProduct.title,
                    },
                });

                addedRewardProductIds.push(rewardProductId);
            }

            if (addedRewardProductIds.length > 0) {
                setRecentRewardProductIds((current) => [
                    ...new Set([...addedRewardProductIds, ...current]),
                ]);
                toast.success("Item bonus berhasil ditambahkan ke keranjang.");
            }

            if (missingRewards.length > 0) {
                toast.error(
                    `Bonus belum bisa ditambahkan: ${missingRewards.join(", ")}`
                );
            }
        },
        [addProductToCart, normalizedCarts, productsById]
    );

    const handleAddProduct = useCallback(
        (product) => {
            setModifierModalProduct(product);
            setModifierModalQuantity(1);
            setModifierModalNotes("");
            setSelectedModifierOptionIds([]);
            setIsModifierPromoDetailOpen(false);
        },
        []
    );

    const handleUpdateQty = useCallback((lineId, nextQty) => {
        const safeQty = Math.max(0, Number(nextQty || 0));

        setCartLines((current) => {
            if (safeQty === 0) {
                return current.filter((item) => String(item.id) !== String(lineId));
            }

            return current.map((item) => {
                if (String(item.id) !== String(lineId)) {
                    return item;
                }

                const maxStock = Number(
                    productsById[Number(item.product_id)]?.stock || safeQty
                );

                return {
                    ...item,
                    qty: Math.min(maxStock, safeQty),
                };
            });
        });
    }, [productsById]);

    const handleRemoveFromCart = useCallback((lineId) => {
        setCartLines((current) =>
            current.filter((item) => String(item.id) !== String(lineId))
        );
    }, []);

    const handleLocalCartNotesChange = useCallback((lineId, notes) => {
        setCartLines((current) =>
            current.map((item) =>
                String(item.id) === String(lineId) ? { ...item, notes } : item
            )
        );
    }, []);

    const handleRemoveModifier = useCallback(() => {}, []);

    const closeModifierModal = useCallback(() => {
        if (isModifierModalSubmitting) {
            return;
        }

        setModifierModalProduct(null);
        setModifierModalQuantity(1);
        setModifierModalNotes("");
        setSelectedModifierOptionIds([]);
        setIsModifierPromoDetailOpen(false);
    }, [isModifierModalSubmitting]);

    const handleToggleModifierOption = useCallback(
        (optionId) => {
            const normalizedOptionId = Number(optionId || 0);
            const options = modifierModalProduct?.modifier_options || [];
            const selectedOption = options.find(
                (option) => Number(option?.id || 0) === normalizedOptionId
            );

            if (!selectedOption) {
                return;
            }

            const selectedGroupName = normalizeModifierGroupName(
                selectedOption.group_name
            );
            const selectionMode =
                String(selectedOption.selection_mode || "optional").trim() ||
                "optional";

            setSelectedModifierOptionIds((current) => {
                const isActive = current.some(
                    (id) => Number(id || 0) === normalizedOptionId
                );

                if (isActive) {
                    return current.filter(
                        (id) => Number(id || 0) !== normalizedOptionId
                    );
                }

                if (selectionMode === "single") {
                    const nextWithoutGroup = current.filter((id) => {
                        const option = options.find(
                            (candidate) =>
                                Number(candidate?.id || 0) === Number(id || 0)
                        );

                        return (
                            normalizeModifierGroupName(option?.group_name) !==
                            selectedGroupName
                        );
                    });

                    return [...nextWithoutGroup, normalizedOptionId];
                }

                return [...current, normalizedOptionId];
            });
        },
        [modifierModalProduct]
    );

    const submitModifierModal = useCallback(
        (includeModifiers) => {
            if (!modifierModalProduct?.id) {
                return;
            }

            const modifierOptions = modifierModalProduct.modifier_options || [];
            const selectedOptionIdSet = new Set(
                selectedModifierOptionIds.map((id) => Number(id || 0))
            );
            const groupedOptions = modifierOptions.reduce((groups, option) => {
                const groupName = normalizeModifierGroupName(option?.group_name);

                if (!groups.has(groupName)) {
                    groups.set(groupName, []);
                }

                groups.get(groupName).push(option);

                return groups;
            }, new Map());

            if (includeModifiers) {
                for (const [groupName, options] of groupedOptions.entries()) {
                    const firstOption = options[0] || {};
                    const selectionMode =
                        String(firstOption.selection_mode || "optional").trim() ||
                        "optional";
                    const minSelect = Math.max(
                        selectionMode === "optional" ? 0 : 1,
                        Number(firstOption.min_select ?? 0)
                    );
                    const maxSelectRaw = Number(firstOption.max_select ?? 0);
                    const maxSelect =
                        selectionMode === "single"
                            ? 1
                            : maxSelectRaw > 0
                              ? maxSelectRaw
                              : null;
                    const selectedCount = options.filter((option) =>
                        selectedOptionIdSet.has(Number(option?.id || 0))
                    ).length;

                    if (selectedCount < minSelect) {
                        toast.error(
                            minSelect <= 1
                                ? `Kategori ${groupName} wajib dipilih.`
                                : `Kategori ${groupName} wajib memilih minimal ${minSelect} opsi.`
                        );
                        return;
                    }

                    if (maxSelect !== null && selectedCount > maxSelect) {
                        toast.error(
                            maxSelect <= 1
                                ? `Kategori ${groupName} hanya boleh memilih 1 opsi.`
                                : `Kategori ${groupName} maksimal ${maxSelect} opsi.`
                        );
                        return;
                    }
                }

                if (
                    groupedOptions.size === 0 &&
                    Boolean(modifierModalProduct?.requires_modifier_selection) &&
                    selectedOptionIdSet.size === 0
                ) {
                    toast.error("Produk ini wajib memilih minimal satu topping.");
                    return;
                }
            }

            setIsModifierModalSubmitting(true);

            const selectedModifiers = includeModifiers
                ? modifierOptions.filter((option) =>
                      selectedOptionIdSet.has(Number(option.id || 0))
                  )
                : [];

            addProductToCart(modifierModalProduct, {
                qty: modifierModalQuantity,
                notes: modifierModalNotes,
                modifiers: selectedModifiers,
            }).then(() => {
                setIsModifierModalSubmitting(false);
                setModifierModalProduct(null);
                setModifierModalQuantity(1);
                setModifierModalNotes("");
                setSelectedModifierOptionIds([]);
                setIsModifierPromoDetailOpen(false);
                toast.success(`${modifierModalProduct.title} ditambahkan`);
            });
        },
        [
            addProductToCart,
            modifierModalNotes,
            modifierModalProduct,
            modifierModalQuantity,
            selectedModifierOptionIds,
        ]
    );

    const openPaymentInfoTab = useCallback(() => {
        if (normalizedCarts.length === 0) {
            toast.error("Keranjang masih kosong. Tambahkan produk terlebih dahulu.");
            setMobileView("products");
            return;
        }

        setMobileView("payment");
    }, [normalizedCarts.length]);

    const openCartTab = useCallback(() => {
        if (normalizedCarts.length === 0) {
            toast("Keranjang masih kosong, tambahkan produk terlebih dahulu", {
                icon: "🛒",
                duration: 2000,
            });
            setMobileView("products");
            return;
        }

        setMobileView("cart");
    }, [normalizedCarts.length]);

    const startFloatingCartDrag = useCallback(
        (clientX, clientY) => {
            floatingCartDragRef.current = {
                dragging: true,
                moved: false,
                startX: clientX,
                startY: clientY,
                originX: floatingCartPosition.x,
                originY: floatingCartPosition.y,
            };
        },
        [floatingCartPosition.x, floatingCartPosition.y]
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handlePointerMove = (event) => {
            const drag = floatingCartDragRef.current;
            if (!drag.dragging) {
                return;
            }

            const deltaX = event.clientX - drag.startX;
            const deltaY = event.clientY - drag.startY;
            const nextX = Math.min(
                Math.max(12, drag.originX + deltaX),
                Math.max(12, window.innerWidth - 220)
            );
            const nextY = Math.min(
                Math.max(12, drag.originY + deltaY),
                Math.max(12, window.innerHeight - 120)
            );

            if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
                floatingCartDragRef.current.moved = true;
            }

            setFloatingCartPosition({
                x: nextX,
                y: nextY,
            });
        };

        const handlePointerUp = () => {
            floatingCartDragRef.current.dragging = false;
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, []);

    const confirmSubmitOrder = useCallback(() => {
        const itemsHtml = paymentPreviewItems
            .map(({ item, resolvedPromoItem, promoState }) => {
                const { resolvedLine } = promoState;
                const promoTitle = hasPromoApplied(resolvedPromoItem)
                    ? promoTitleText(resolvedPromoItem)
                    : null;
                const promoDetail = promoDetailText(resolvedPromoItem);
                const modifierGroups = (item.modifiers || []).reduce(
                    (groups, modifier) => {
                        const groupName = normalizeModifierGroupName(
                            modifier.group_name
                        );

                        if (!groups[groupName]) {
                            groups[groupName] = [];
                        }

                        groups[groupName].push(modifier);

                        return groups;
                    },
                    {}
                );
                const modifierHtml =
                    Object.keys(modifierGroups).length > 0
                        ? `
                            <div style="margin-top:10px;display:grid;gap:8px;">
                                ${Object.entries(modifierGroups)
                                    .map(
                                        ([groupName, modifiers]) => `
                                            <div style="border:1px solid #e2e8f0;border-radius:14px;padding:10px;background:#ffffff;">
                                                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Kategori topping</div>
                                                <div style="margin-top:4px;font-size:13px;font-weight:700;color:#0f172a;">${groupName}</div>
                                                <div style="margin-top:8px;display:grid;gap:6px;">
                                                    ${modifiers
                                                        .map(
                                                            (modifier) => `
                                                                <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#475569;">
                                                                    <span style="min-width:0;flex:1;">${modifier.name}</span>
                                                                    <strong style="white-space:nowrap;color:${
                                                                        Number(
                                                                            modifier.total_price || 0
                                                                        ) > 0
                                                                            ? "#0369a1"
                                                                            : "#047857"
                                                                    };">
                                                                        ${
                                                                            Number(
                                                                                modifier.total_price || 0
                                                                            ) > 0
                                                                                ? formatPrice(
                                                                                      modifier.total_price
                                                                                  )
                                                                                : "Gratis"
                                                                        }
                                                                    </strong>
                                                                </div>
                                                            `
                                                        )
                                                        .join("")}
                                                </div>
                                            </div>
                                        `
                                    )
                                    .join("")}
                            </div>
                        `
                        : "";
                const itemNotesHtml = item.notes
                    ? `<div style="margin-top:10px;border-radius:12px;background:#f8fafc;padding:10px;font-size:12px;color:#475569;"><strong style="color:#0f172a;">Catatan item:</strong> ${item.notes}</div>`
                    : "";

                return `
                    <div style="border:1px solid #e2e8f0;border-radius:20px;padding:16px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);text-align:left;">
                        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                            <div style="min-width:0;flex:1;">
                                <div style="font-weight:600;color:#0f172a;">${item.product?.title || "Produk"}</div>
                                <div style="font-size:12px;color:#64748b;margin-top:4px;">
                                    ${
                                        resolvedLine.baseUnitPrice >
                                        resolvedLine.effectiveUnitPrice
                                            ? `<div style="text-decoration:line-through;">${formatPrice(resolvedLine.baseUnitPrice)} × ${item.qty}</div>`
                                            : ""
                                    }
                                    <div>${formatPrice(resolvedLine.effectiveUnitPrice)} × ${item.qty}</div>
                                </div>
                                ${
                                    promoTitle
                                        ? `<div style="margin-top:8px;font-size:12px;font-weight:600;color:#be123c;">${promoTitle}</div>`
                                        : ""
                                }
                                ${
                                    promoDetail
                                        ? `<div style="margin-top:4px;font-size:11px;color:#e11d48;">${promoDetail}</div>`
                                        : ""
                                }
                                ${modifierHtml}
                                ${itemNotesHtml}
                            </div>
                            <div style="text-align:right;white-space:nowrap;">
                                ${
                                    resolvedLine.baseLineTotal >
                                    resolvedLine.effectiveLineTotal
                                        ? `<div style="font-size:11px;color:#94a3b8;text-decoration:line-through;">${formatPrice(resolvedLine.baseLineTotal)}</div>`
                                        : ""
                                }
                                <div style="font-weight:700;color:#4f46e5;">${formatPrice(resolvedLine.effectiveLineTotal)}</div>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join("");
        const orderNotesHtml = orderForm.data.notes
            ? `<div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px;background:#ffffff;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Catatan umum order</div>
                    <div style="margin-top:6px;font-size:13px;line-height:1.6;color:#334155;">${orderForm.data.notes}</div>
               </div>`
            : "";

        return Swal.fire({
            title: editableOrder?.access_token
                ? "Konfirmasi Perbarui Pesanan"
                : "Konfirmasi Kirim Order",
            html: `
                <div style="text-align:left;display:grid;gap:14px;">
                    <div style="display:grid;gap:10px;">
                        <div style="border:1px solid #bfdbfe;border-radius:18px;padding:14px;background:linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%);">
                            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1d4ed8;">Alur pembayaran</div>
                            <div style="margin-top:8px;display:grid;gap:8px;font-size:13px;color:#334155;">
                                <div style="display:flex;gap:10px;"><span style="display:inline-flex;height:22px;min-width:22px;align-items:center;justify-content:center;border-radius:999px;background:#2563eb;color:#fff;font-size:11px;font-weight:700;">1</span><span>Order ini dikirim dulu ke panel kasir, belum langsung dibayar.</span></div>
                                <div style="display:flex;gap:10px;"><span style="display:inline-flex;height:22px;min-width:22px;align-items:center;justify-content:center;border-radius:999px;background:#0f766e;color:#fff;font-size:11px;font-weight:700;">2</span><span>Kasir akan cek item, topping, promo, dan total akhir yang sama.</span></div>
                                <div style="display:flex;gap:10px;"><span style="display:inline-flex;height:22px;min-width:22px;align-items:center;justify-content:center;border-radius:999px;background:#b45309;color:#fff;font-size:11px;font-weight:700;">3</span><span>Setelah itu kasir memproses pembayaran dan order masuk ke dapur.</span></div>
                            </div>
                        </div>
                        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px;background:#fff;">
                            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Pesanan yang akan dikirim</div>
                            <div style="margin-top:6px;font-size:13px;color:#475569;">Periksa menu, topping, qty, promo, dan catatan sebelum lanjut.</div>
                        </div>
                    </div>
                    <div style="max-height:320px;overflow:auto;padding:0 2px;display:grid;gap:10px;">
                        ${itemsHtml}
                    </div>
                    ${orderNotesHtml}
                    <div style="border:1px solid #e2e8f0;border-radius:20px;padding:16px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);display:grid;gap:8px;">
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:#64748b;">Subtotal Dasar</span><strong>${formatPrice(baseSubtotal)}</strong></div>
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:#64748b;">${PROMO_TOTAL_LABEL}</span><strong style="color:#e11d48;">-${formatPrice(promoDiscount)}</strong></div>
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span style="color:#64748b;">Subtotal Setelah Promo</span><strong>${formatPrice(subtotal)}</strong></div>
                        <div style="height:1px;background:#e2e8f0;"></div>
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:17px;"><span><strong>Total dibayar ke kasir</strong></span><strong style="color:#4f46e5;">${formatPrice(payable)}</strong></div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: editableOrder?.access_token
                ? "Simpan perubahan"
                : "Kirim ke Kasir",
            cancelButtonText: "Periksa Lagi",
            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
            width: 720,
        });
    }, [
        baseSubtotal,
        editableOrder?.access_token,
        orderForm.data.notes,
        payable,
        paymentPreviewItems,
        promoDiscount,
        subtotal,
    ]);

    const submitOrder = useCallback(
        async (event) => {
            event?.preventDefault?.();

            if (normalizedCarts.length === 0) {
                toast.error("Keranjang masih kosong.");
                setMobileView("products");
                return;
            }

            const result = await confirmSubmitOrder();
            if (!result.isConfirmed) {
                return;
            }

            orderForm.transform((data) => ({
                ...data,
                items: buildPreviewRequestItems(normalizedCarts),
            }));

            const submitConfig = {
                preserveScroll: true,
                onSuccess: () => {
                    if (cartStorageKey && typeof window !== "undefined") {
                        window.localStorage.removeItem(cartStorageKey);
                    }

                    setCartLines([]);
                    setPricingPreview(emptyPricingPreview);
                    orderForm.setData("notes", "");
                },
            };

            if (editableOrder?.access_token) {
                orderForm.patch(
                    route("table-order.update-items", editableOrder.access_token),
                    submitConfig
                );
                return;
            }

            orderForm.post(route("table-order.store", table.qr_token), submitConfig);
        },
        [
            buildPreviewRequestItems,
            cartStorageKey,
            confirmSubmitOrder,
            editableOrder?.access_token,
            normalizedCarts,
            orderForm,
            table.qr_token,
        ]
    );

    const submitIdentify = (event) => {
        event.preventDefault();
        const sanitizedPhone = sanitizePhoneNumber(identifyForm.data.no_telp);
        identifyForm.setData("no_telp", sanitizedPhone);

        if (!isValidPhoneNumber(sanitizedPhone)) {
            identifyForm.setError(
                "no_telp",
                "Format nomor hape tidak valid. Gunakan angka saja, misalnya 0812xxxxxxx atau 62812xxxxxxx."
            );
            return;
        }

        identifyForm.clearErrors("no_telp");
        identifyForm.post(route("table-order.identify", table.qr_token), {
            preserveScroll: true,
        });
    };

    const submitRegister = (event) => {
        event.preventDefault();
        registerForm.post(route("table-order.register-identity", table.qr_token), {
            preserveScroll: true,
        });
    };

    const logoutCustomer = () => {
        if (cartStorageKey && typeof window !== "undefined") {
            window.localStorage.removeItem(cartStorageKey);
        }

        setCartLines([]);
        setPricingPreview(emptyPricingPreview);
        orderForm.setData("notes", "");
        setOrderNotesDraft("");
        logoutForm.post(route("table-order.logout", table.qr_token), {
            preserveScroll: true,
        });
    };

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (flash?.info) {
            toast(flash.info, { icon: "ℹ️" });
        }
    }, [flash]);

    useEffect(() => {
        if (recentRewardProductIds.length === 0) {
            return;
        }

        const timerId = window.setTimeout(() => {
            setRecentRewardProductIds([]);
        }, 2500);

        return () => window.clearTimeout(timerId);
    }, [recentRewardProductIds]);

    useEffect(() => {
        if (customer) {
            return undefined;
        }

        const focusTimer = window.setTimeout(() => {
            if (pendingPhone) {
                registerNameInputRef.current?.focus();
                return;
            }

            identifyPhoneInputRef.current?.focus();
        }, 60);

        return () => window.clearTimeout(focusTimer);
    }, [customer, pendingPhone]);

    useEffect(() => {
        if (!editableOrder?.access_token) {
            editableOrderHydratedTokenRef.current = null;
            editableOrderOpenedRef.current = false;
            return;
        }

        if (editableOrderHydratedTokenRef.current === editableOrder.access_token) {
            return;
        }

        editableOrderHydratedTokenRef.current = editableOrder.access_token;
        setCartLines(buildEditableOrderCartLines(editableOrder));
        orderForm.setData("notes", editableOrder.notes || "");

        if (!editableOrderOpenedRef.current) {
            editableOrderOpenedRef.current = true;
            setMobileView("cart");
            toast("Keranjang pesanan lama dibuka untuk diedit.", {
                icon: "🧾",
                duration: 2400,
            });
        }
    }, [
        buildEditableOrderCartLines,
        editableOrder,
        editableOrder?.access_token,
        orderForm,
    ]);

    useEffect(() => {
        if (editableOrder?.access_token) {
            cartStorageHydratedKeyRef.current = null;
            return;
        }

        if (!cartStorageKey || typeof window === "undefined") {
            cartStorageHydratedKeyRef.current = null;
            setCartLines([]);
            orderForm.setData("notes", "");
            return;
        }

        if (cartStorageHydratedKeyRef.current === cartStorageKey) {
            return;
        }

        try {
            const storedPayload = window.localStorage.getItem(cartStorageKey);

            if (!storedPayload) {
                cartStorageHydratedKeyRef.current = cartStorageKey;
                setCartLines([]);
                orderForm.setData("notes", "");
                return;
            }

            const parsedPayload = JSON.parse(storedPayload);
            const restoredLines = Array.isArray(parsedPayload?.cartLines)
                ? parsedPayload.cartLines
                      .map((line) => {
                          const product = productsById[Number(line.product_id)];
                          if (!product) {
                              return null;
                          }

                          return {
                              ...line,
                              product,
                              qty: Math.max(
                                  1,
                                  Math.min(
                                      Number(line.qty || 1),
                                      Number(product.stock || line.qty || 1)
                                  )
                              ),
                          };
                      })
                      .filter(Boolean)
                : [];

            cartStorageHydratedKeyRef.current = cartStorageKey;
            setCartLines(restoredLines);
            orderForm.setData("notes", parsedPayload?.notes || "");
        } catch {
            cartStorageHydratedKeyRef.current = cartStorageKey;
            setCartLines([]);
            orderForm.setData("notes", "");
        }
    }, [cartStorageKey, editableOrder?.access_token, productsById]);

    useEffect(() => {
        if (!cartStorageKey || typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            cartStorageKey,
            JSON.stringify({
                notes: orderForm.data.notes || "",
                cartLines,
            })
        );
    }, [cartLines, cartStorageKey, orderForm.data.notes]);

    useEffect(() => {
        if (!modifierModalProduct || !modifierModalDraftCart) {
            modifierModalPricingAbortRef.current?.abort?.();
            if (modifierModalPricingTimerRef.current) {
                window.clearTimeout(modifierModalPricingTimerRef.current);
                modifierModalPricingTimerRef.current = null;
            }
            setModifierModalPricingPreview(null);
            return;
        }

        let cancelled = false;
        const previewItems = [...normalizedCarts, modifierModalDraftCart];

        modifierModalPricingAbortRef.current?.abort?.();
        const controller = new AbortController();
        modifierModalPricingAbortRef.current = controller;

        modifierModalPricingTimerRef.current = window.setTimeout(() => {
            axios
                .post(
                    route("table-order.preview", table.qr_token),
                    {
                        notes: orderForm.data.notes || "",
                        items: buildPreviewRequestItems(previewItems),
                    },
                    {
                        signal: controller.signal,
                    }
                )
                .then((response) => {
                    if (!cancelled) {
                        setModifierModalPricingPreview(
                            response.data ?? buildLocalPricingPreview(previewItems)
                        );
                    }
                })
                .catch((error) => {
                    if (cancelled || error?.code === "ERR_CANCELED") {
                        return;
                    }

                    setModifierModalPricingPreview(
                        buildLocalPricingPreview(previewItems)
                    );
                });
        }, 180);

        return () => {
            cancelled = true;
            if (modifierModalPricingTimerRef.current) {
                window.clearTimeout(modifierModalPricingTimerRef.current);
                modifierModalPricingTimerRef.current = null;
            }
            controller.abort();
        };
    }, [
        buildPreviewRequestItems,
        modifierModalDraftCart,
        modifierModalProduct,
        normalizedCarts,
        orderForm.data.notes,
        table.qr_token,
    ]);

    useEffect(() => {
        if (normalizedCarts.length === 0) {
            pricingRequestAbortRef.current?.abort?.();
            setPricingPreview(emptyPricingPreview);
            setIsLoadingPricing(false);
            return;
        }

        let cancelled = false;
        setIsLoadingPricing(true);

        pricingRequestAbortRef.current?.abort?.();
        const controller = new AbortController();
        pricingRequestAbortRef.current = controller;

        pricingRequestTimerRef.current = window.setTimeout(() => {
            axios
                .post(
                    route("table-order.preview", table.qr_token),
                    {
                        notes: orderForm.data.notes || "",
                        items: buildPreviewRequestItems(normalizedCarts),
                    },
                    {
                        signal: controller.signal,
                    }
                )
                .then((response) => {
                    if (!cancelled) {
                        setPricingPreview(response.data ?? emptyPricingPreview);
                    }
                })
                .catch((error) => {
                    if (cancelled || error?.code === "ERR_CANCELED") {
                        return;
                    }

                    setPricingPreview(buildLocalPricingPreview(normalizedCarts));
                })
                .finally(() => {
                    if (!cancelled) {
                        setIsLoadingPricing(false);
                    }
                });
        }, 250);

        return () => {
            cancelled = true;
            if (pricingRequestTimerRef.current) {
                window.clearTimeout(pricingRequestTimerRef.current);
                pricingRequestTimerRef.current = null;
            }
            controller.abort();
        };
    }, [
        buildPreviewRequestItems,
        normalizedCarts,
        orderForm.data.notes,
        pricingDependency,
        table.qr_token,
    ]);

    return (
        <>
            <Head title={`Self Order ${table.name}`} />

            {sidebarOpen ? (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            ) : null}

            <div
                className={`fixed inset-y-0 left-0 z-[70] w-[300px] max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                        <div>
                            <p className="text-sm font-bold text-slate-900">
                                Toko Anda
                            </p>
                            <p className="text-xs text-slate-500">
                                Meja {table.code || table.name}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                        >
                            <IconX size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Outlet
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {outlet?.name || storeProfile?.name || "Outlet"}
                            </p>
                            <p className="text-xs text-slate-500">
                                Meja {table.code || table.name} • bayar lewat approval kasir
                            </p>
                        </div>

                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Pelanggan
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {customer?.name || "Pelanggan"}
                            </p>
                            <p className="text-xs text-slate-500">
                                {customer?.no_telp || "-"}
                            </p>
                            {customer?.loyalty_points ? (
                                <p className="mt-1 text-xs font-medium text-emerald-600">
                                    {customer.loyalty_points} poin loyalti
                                </p>
                            ) : null}
                        </div>

                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Akun
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {customer?.email || "Belum ada email"}
                            </p>
                            <p className="text-xs text-slate-500">
                                {customer?.member_code
                                    ? `Kode member ${customer.member_code}`
                                    : "Akun self-order aktif"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Tier {customer?.loyalty_tier || "regular"}
                            </p>
                        </div>

                        <div className="mb-4">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Riwayat Pesanan
                            </p>
                            {recentOrders.length > 0 ? (
                                <div className="space-y-2">
                                    {recentOrders.slice(0, 3).map((order) => (
                                        <div
                                            key={order.id}
                                            className="rounded-xl border border-slate-200 bg-white p-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-800">
                                                        {order.order_number}
                                                    </p>
                                                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                        {orderStatusLabel[order.status] ||
                                                            order.status}
                                                    </span>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold text-slate-800">
                                                    {formatPrice(order.grand_total)}
                                                </p>
                                            </div>
                                            {order.access_token ? (
                                                <Link
                                                    href={route(
                                                        "table-order.status",
                                                        order.access_token
                                                    )}
                                                    className="mt-2 inline-flex text-xs font-medium text-sky-700"
                                                >
                                                    Lihat status →
                                                </Link>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : recentTransactions.length > 0 ? (
                                <div className="space-y-2">
                                    {recentTransactions
                                        .slice(0, 3)
                                        .map((transaction) => (
                                            <div
                                                key={transaction.id}
                                                className="rounded-xl border border-slate-200 bg-white p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-slate-800">
                                                            {transaction.invoice}
                                                        </p>
                                                        <p className="text-xs capitalize text-slate-500">
                                                            {transaction.payment_status}
                                                        </p>
                                                    </div>
                                                    <p className="shrink-0 text-sm font-semibold text-slate-800">
                                                        {formatPrice(
                                                            transaction.grand_total
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                                    Belum ada riwayat pesanan.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-200 px-4 py-3">
                        {customer ? (
                            <button
                                type="button"
                                onClick={logoutCustomer}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Ganti akun
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur sm:left-5 sm:top-5"
                aria-label="Buka menu"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-700"
                >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                </svg>
            </button>

            <div className="relative flex h-screen flex-col overflow-hidden bg-slate-100">
                <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
                    <button
                        type="button"
                        onClick={() => setMobileView("products")}
                        className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                            mobileView === "products"
                                ? "border-b-2 border-primary-500 text-primary-600"
                                : "text-slate-500"
                        }`}
                    >
                        <IconShoppingCart size={18} />
                        <span>Produk</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (normalizedCarts.length === 0) {
                                toast("Keranjang masih kosong, tambahkan produk terlebih dahulu", {
                                    icon: "🛒",
                                    duration: 2000,
                                });
                                setMobileView("products");
                                return;
                            }

                            setMobileView("cart");
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                            mobileView === "cart"
                                ? "border-b-2 border-primary-500 text-primary-600"
                                : "text-slate-500"
                        }`}
                    >
                        <IconReceipt size={18} />
                        <span className="inline-flex items-center gap-1">
                            Keranjang
                            {cartCount > 0 && (
                                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white">
                                    {cartCount}
                                </span>
                            )}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={openPaymentInfoTab}
                        className={`flex items-center justify-center gap-2 px-2 py-3 text-center text-sm font-semibold transition-colors ${
                            mobileView === "payment"
                                ? "border-b-2 border-primary-500 text-primary-600"
                                : "text-slate-500"
                        }`}
                    >
                        <IconCash size={18} />
                        <span className="truncate">Info Pembayaran</span>
                    </button>
                </div>

                <div className="min-h-0 flex flex-1 flex-col">
                    <div
                        className={`min-h-0 flex-1 overflow-hidden bg-slate-100 ${
                            mobileView !== "products" ? "hidden" : "flex flex-col"
                        }`}
                    >
                        <ProductGrid
                            products={products}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onSearch={() => setIsSearching(false)}
                            isSearching={isSearching}
                            onAddToCart={handleAddProduct}
                            addingProductId={addingProductId}
                            searchInputRef={searchInputRef}
                            initialViewMode="grid"
                            persistViewMode={false}
                            storageNamespace="public:self-order-product-grid"
                            onBarcodeDetected={(barcode) => {
                                setSearchQuery(barcode);
                                setIsSearching(false);
                            }}
                            compactHeaderLayout={true}
                            embedHeaderInScroll={true}
                            scrollIntro={
                                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800">
                                                Toko Anda
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {outlet?.name || storeProfile?.name || "Outlet"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Meja {table.code || table.name} • bayar lewat approval kasir
                                            </p>
                                            {editableOrder?.order_number ? (
                                                <p className="mt-1 text-xs font-semibold text-amber-600">
                                                    Sedang edit order {editableOrder.order_number}
                                                </p>
                                            ) : null}
                                        </div>
                                        {customer ? (
                                            <button
                                                type="button"
                                                onClick={logoutCustomer}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                            >
                                                Ganti akun
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            }
                        />
                    </div>

                    <div
                        className={`flex h-full flex-col overflow-hidden bg-white ${
                            mobileView !== "cart" ? "hidden" : "flex"
                        }`}
                    >
                        <div className="border-b border-slate-200 px-3 py-3 lg:px-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        Keranjang
                                    </p>
                                    {editableOrder?.order_number ? (
                                        <p className="text-xs font-semibold text-amber-600">
                                            Draft edit {editableOrder.order_number}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-500">
                                            Promo dan struktur item mengikuti engine
                                            POS kasir.
                                        </p>
                                    )}
                                </div>
                                {normalizedCarts.length > 0 && (
                                    <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700">
                                        {cartCount} item
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="p-2.5 pb-28 lg:p-3 lg:pb-3">
                                {normalizedCarts.length > 0 ? (
                                    <div className="space-y-2 pr-1">
                                        {normalizedCarts.map((item) => {
                                            const fallbackProduct =
                                                productsById[
                                                    Number(item.product_id || 0)
                                                ] || item.product;
                                            const pricingItem =
                                                pricingItemsByCartId[item.id];
                                            const promoState = buildCartPromoState({
                                                cartItem: item,
                                                pricingItem,
                                                fallbackProduct,
                                                formatPrice,
                                            });
                                            return (
                                                <CartLineItem
                                                    key={item.id}
                                                    item={item}
                                                    promoState={promoState}
                                                    formatPrice={formatPrice}
                                                    onAddRewardProducts={
                                                        handleAddRewardProducts
                                                    }
                                                    onRemoveModifier={
                                                        handleRemoveModifier
                                                    }
                                                    onNotesChange={
                                                        handleLocalCartNotesChange
                                                    }
                                                    onQtyChange={handleUpdateQty}
                                                    onRemoveItem={
                                                        handleRemoveFromCart
                                                    }
                                                    highlightRewardProductIds={
                                                        recentRewardProductIds
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-10 text-center">
                                        <IconShoppingCart
                                            size={36}
                                            className="mx-auto mb-3 text-slate-300"
                                        />
                                        <p className="text-sm font-medium text-slate-500">
                                            Keranjang kosong
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Tambahkan produk dari tab Produk.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-20 flex-shrink-0 border-t border-slate-200 bg-slate-50/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur">
                            <div className="space-y-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Pelanggan
                                        </p>
                                        <p className="truncate text-sm font-semibold text-slate-800">
                                            {customer?.name || "Pelanggan"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            {customer?.no_telp || "-"}
                                        </p>
                                        {customer?.loyalty_points ? (
                                            <p className="mt-1 text-[11px] font-medium text-emerald-600">
                                                {customer.loyalty_points} poin loyalti
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Akun
                                        </p>
                                        <p className="truncate text-sm font-semibold text-slate-800">
                                            {customer?.email || "Belum ada email"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            {customer?.member_code
                                                ? `Kode member ${customer.member_code}`
                                                : "Akun self-order aktif"}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Tier {customer?.loyalty_tier || "regular"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={openPaymentInfoTab}
                                    className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                                        !normalizedCarts.length
                                            ? "cursor-not-allowed bg-slate-200 text-slate-400"
                                            : "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700"
                                    }`}
                                >
                                    <IconCash size={16} />
                                    <span>
                                        {!normalizedCarts.length
                                            ? "Pilih menu dulu"
                                            : "Lanjut ke info pembayaran"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`flex h-full flex-col overflow-hidden bg-white ${
                            mobileView !== "payment" ? "hidden" : "flex"
                        }`}
                    >
                        <div className="border-b border-slate-200 px-4 py-4">
                            <p className="text-sm font-semibold text-slate-800">
                                Info Pembayaran
                            </p>
                            <p className="text-xs text-slate-500">
                                Cek total pesanan di sini, lalu kirim ke kasir untuk diproses dan dibayar.
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-32">
                            <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                                            Status saat ini
                                        </p>
                                        <p className="mt-1 text-base font-bold text-slate-900">
                                            Menunggu approval kasir
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                        Belum dibayar
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    Order dari meja ini belum masuk pembayaran. Setelah Anda konfirmasi, kasir menerima detail yang sama untuk dicek dan diproses.
                                </p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-white/80 bg-white/90 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                            1. Kirim order
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">
                                            Anda kirim detail menu dan catatan ke kasir.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-white/80 bg-white/90 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                            2. Kasir cek
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">
                                            Kasir memverifikasi item, topping, promo, dan total.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-white/80 bg-white/90 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                            3. Bayar ke kasir
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">
                                            Pembayaran diselesaikan di kasir, bukan di halaman ini.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Ringkasan menu dipilih
                                    </p>
                                    <div className="mt-3 space-y-2">
                                        {paymentPreviewItems.map(
                                            ({
                                                item,
                                                promoState,
                                                resolvedPromoItem,
                                            }) => {
                                                const { resolvedLine } =
                                                    promoState;

                                                return (
                                                    <div
                                                        key={`payment-preview-${item.id}`}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                                    {item.product
                                                                        ?.title ||
                                                                        "Produk"}
                                                                </p>
                                                                <div className="mt-1 text-xs text-slate-500">
                                                                    {resolvedLine.baseUnitPrice >
                                                                    resolvedLine.effectiveUnitPrice ? (
                                                                        <p className="line-through">
                                                                            {formatPrice(
                                                                                resolvedLine.baseUnitPrice
                                                                            )}{" "}
                                                                            ×{" "}
                                                                            {item.qty}
                                                                        </p>
                                                                    ) : null}
                                                                    <p>
                                                                        {formatPrice(
                                                                            resolvedLine.effectiveUnitPrice
                                                                        )}{" "}
                                                                        ×{" "}
                                                                        {item.qty}
                                                                    </p>
                                                                </div>
                                                                {hasPromoApplied(
                                                                    resolvedPromoItem
                                                                ) ? (
                                                                    <div className="mt-2 space-y-1">
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                                                                                {promoTitleText(
                                                                                    resolvedPromoItem
                                                                                )}
                                                                            </span>
                                                                            {resolvedPromoItem.pricing_rule_kind ? (
                                                                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                                                                    {promoKindLabel(
                                                                                        resolvedPromoItem.pricing_rule_kind
                                                                                    )}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        {promoDetailText(
                                                                            resolvedPromoItem
                                                                        ) ? (
                                                                            <p className="text-[11px] text-rose-600">
                                                                                {promoDetailText(
                                                                                    resolvedPromoItem
                                                                                )}
                                                                            </p>
                                                                        ) : null}
                                                                    </div>
                                                                ) : null}
                                                                {(item.modifiers ||
                                                                    []).length >
                                                                0 ? (
                                                                    <div className="mt-2 space-y-1">
                                                                        {(item.modifiers || []).map(
                                                                            (
                                                                                modifier
                                                                            ) => (
                                                                                <div
                                                                                    key={`payment-modifier-${item.id}-${modifier.id}`}
                                                                                    className="flex items-center justify-between gap-2 text-[11px] text-slate-500"
                                                                                >
                                                                                    <span className="truncate">
                                                                                        +
                                                                                        {" "}
                                                                                        {
                                                                                            modifier.name
                                                                                        }
                                                                                    </span>
                                                                                    <span>
                                                                                        {formatPrice(
                                                                                            modifier.total_price
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-right">
                                                                {resolvedLine.baseLineTotal >
                                                                resolvedLine.effectiveLineTotal ? (
                                                                    <p className="text-[11px] text-slate-400 line-through">
                                                                        {formatPrice(
                                                                            resolvedLine.baseLineTotal
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                <p className="text-sm font-bold text-primary-600">
                                                                    {formatPrice(
                                                                        resolvedLine.effectiveLineTotal
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">
                                            Subtotal Dasar
                                        </span>
                                        <span className="font-medium text-slate-800">
                                            {formatPrice(baseSubtotal)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">
                                            {PROMO_TOTAL_LABEL}
                                        </span>
                                        <span className="font-medium text-rose-600">
                                            -{formatPrice(promoDiscount)}
                                        </span>
                                    </div>
                                    {appliedPromoGroups.length > 0 && (
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                Promo yang sedang bekerja
                                            </div>
                                            <div className="max-h-20 space-y-1 overflow-y-auto pr-1">
                                                {appliedPromoGroups.map((group) => (
                                                    <div
                                                        key={group.key}
                                                        className="flex items-start justify-between gap-2 text-[10px]"
                                                    >
                                                        <span className="min-w-0 flex-1 break-words text-slate-600">
                                                            {group.label}
                                                        </span>
                                                        <span className="whitespace-nowrap font-medium text-emerald-600">
                                                            -{formatPrice(group.discount_total)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">
                                            Subtotal Setelah Promo
                                        </span>
                                        <span className="font-medium text-slate-800">
                                            {formatPrice(subtotal)}
                                        </span>
                                    </div>
                                    <div className="h-px bg-slate-200" />
                                    <div className="flex justify-between">
                                        <span className="text-base font-semibold text-slate-800">
                                            Total
                                        </span>
                                        <span className="text-xl font-bold text-primary-600">
                                            {formatPrice(payable)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Catatan umum order
                                </p>
                                <textarea
                                    rows={4}
                                    value={orderNotesDraft}
                                    onFocus={() => {
                                        orderNotesFocusedRef.current = true;
                                    }}
                                    onChange={(event) =>
                                        setOrderNotesDraft(event.target.value)
                                    }
                                    onBlur={(event) => {
                                        orderNotesFocusedRef.current = false;
                                        orderForm.setData("notes", event.target.value);
                                    }}
                                    placeholder="Catatan umum untuk kasir atau dapur"
                                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
                                />
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Riwayat pelanggan
                                </p>
                                <div className="mt-3 space-y-2">
                                    {recentOrders.length > 0 ? (
                                        recentOrders.slice(0, 3).map((order) => (
                                            <div
                                                key={order.id}
                                                className="rounded-xl border border-slate-200 px-3 py-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {order.order_number}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {orderStatusLabel[
                                                                order.status
                                                            ] || order.status}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {formatPrice(order.grand_total)}
                                                    </p>
                                                </div>
                                                {order.access_token ? (
                                                    <Link
                                                        href={route(
                                                            "table-order.status",
                                                            order.access_token
                                                        )}
                                                        className="mt-2 inline-flex text-xs font-semibold text-primary-600"
                                                    >
                                                        Lihat status
                                                    </Link>
                                                ) : null}
                                            </div>
                                        ))
                                    ) : recentTransactions.length > 0 ? (
                                        recentTransactions
                                            .slice(0, 3)
                                            .map((transaction) => (
                                                <div
                                                    key={transaction.id}
                                                    className="rounded-xl border border-slate-200 px-3 py-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900">
                                                                {transaction.invoice}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 capitalize">
                                                                {
                                                                    transaction.payment_status
                                                                }
                                                            </p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {formatPrice(
                                                                transaction.grand_total
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                                            Belum ada riwayat pesanan.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-20 flex-shrink-0 border-t border-slate-200 bg-slate-50/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur">
                            <button
                                type="button"
                                onClick={submitOrder}
                                disabled={
                                    orderForm.processing ||
                                    normalizedCarts.length === 0
                                }
                                className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                                    orderForm.processing ||
                                    normalizedCarts.length === 0
                                        ? "cursor-not-allowed bg-slate-200 text-slate-400"
                                        : "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700"
                                }`}
                            >
                                <IconReceipt size={16} />
                                <span>
                                    {orderForm.processing
                                        ? editableOrder?.access_token
                                          ? "Menyimpan perubahan..."
                                          : "Mengirim order..."
                                        : editableOrder?.access_token
                                          ? "Simpan Perubahan Pesanan"
                                          : "Kirim Order ke Kasir"}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <IdentityGate
                customer={customer}
                pendingPhone={pendingPhone}
                table={table}
                identifyForm={identifyForm}
                registerForm={registerForm}
                submitIdentify={submitIdentify}
                submitRegister={submitRegister}
                identifyPhoneInputRef={identifyPhoneInputRef}
                registerNameInputRef={registerNameInputRef}
            />

            {cartCount > 0 && mobileView === "products" ? (
                <button
                    type="button"
                    onPointerDown={(event) =>
                        startFloatingCartDrag(event.clientX, event.clientY)
                    }
                    onClick={() => {
                        if (floatingCartDragRef.current.moved) {
                            floatingCartDragRef.current.moved = false;
                            return;
                        }

                        openCartTab();
                    }}
                    className="fixed z-[55] flex min-w-[164px] max-w-[220px] items-center justify-between gap-3 rounded-2xl bg-slate-950/95 px-4 py-3 text-left text-white shadow-[0_18px_38px_-18px_rgba(15,23,42,0.75)] backdrop-blur active:scale-[0.99]"
                    style={{
                        left: `${floatingCartPosition.x}px`,
                        bottom: `${floatingCartPosition.y}px`,
                    }}
                >
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                            Keranjang
                        </p>
                        <p className="truncate text-sm font-bold text-white">
                            {formatPrice(payable)}
                        </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                        {cartCount}
                    </div>
                </button>
            ) : null}

            <ModifierOptionsModal
                product={modifierModalProduct}
                quantity={modifierModalQuantity}
                onQuantityChange={setModifierModalQuantity}
                notesValue={modifierModalNotes}
                onNotesChange={setModifierModalNotes}
                selectedModifierOptionIds={selectedModifierOptionIds}
                onToggleModifierOption={handleToggleModifierOption}
                selectedModifierTotal={modifierModalSelectedModifierTotal}
                promo={modifierModalPromo}
                promoBenefit={modifierModalPromoBenefit}
                isPromoDetailOpen={isModifierPromoDetailOpen}
                onTogglePromoDetail={() =>
                    setIsModifierPromoDetailOpen((current) => !current)
                }
                onAddRewardProducts={handleAddRewardProducts}
                onClose={closeModifierModal}
                onSubmit={submitModifierModal}
                isSubmitting={isModifierModalSubmitting}
            />
        </>
    );
}
