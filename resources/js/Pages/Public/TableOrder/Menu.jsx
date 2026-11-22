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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import IdentityGate from "./components/IdentityGate";

// Lazy-loaded: hanya dimuat saat pelanggan tap produk dengan modifier atau saat submit order
const ModifierOptionsModal = lazy(() => import("@/Components/POS/ModifierOptionsModal"));
import StoreClosedOverlay from "./components/StoreClosedOverlay";
import {
    formatPrice,
    paymentMethodSummary,
    normalizeModifierGroupName,
    ORDER_TYPE_LABEL,
    buildOrderTypeNotes,
    stripOrderTypeNotes,
    appliesToOrderType,
    isModifierOptionAvailable,
    sanitizePhoneNumber,
    isValidPhoneNumber,
    normalizePhoneNumber,
    EMPTY_PRICING_PREVIEW as emptyPricingPreview,
} from "./utils/tableOrderHelpers";

function SubmitErrorAlert({ errors = [] }) {
    if (errors.length === 0) {
        return null;
    }

    return (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4" role="alert">
            <p className="text-sm font-bold text-danger-800">Pesanan belum dikirim</p>
            <p className="mt-1 text-xs text-danger-700">
                Keranjang tetap tersimpan. Perbaiki bagian berikut:
            </p>
            <ul className="mt-3 space-y-2">
                {errors.map((error, index) => (
                    <li key={`${error.field}-${index}`} className="flex gap-2 text-xs leading-5 text-danger-800">
                        <span aria-hidden="true">•</span>
                        <span>
                            <strong>{error.label}:</strong> {error.message}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}


export default function Menu({
    table,
    outlet,
    products = [],
    identity,
    editableOrder = null,
    paymentMethods = [],
    bankAccounts = [],
    storeHours = null,
    tenantOutlets = [],
    recommendations = null,
}) {
    const { flash, storeProfile } = usePage().props;
    const customer = identity?.customer || null;
    const pendingPhone = identity?.pending_phone || "";
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];
    const availablePaymentMethods =
        Array.isArray(paymentMethods) && paymentMethods.length > 0
            ? paymentMethods
            : [
                  {
                      value: "cash",
                      label: "Bayar di Kasir",
                      description:
                          "Pesanan dikirim dulu ke kasir, lalu pembayaran di-approve kasir.",
                      kind: "cashier",
                  },
              ];
    const defaultPaymentMethod = availablePaymentMethods[0]?.value || "cash";

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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileView, setMobileView] = useState("products");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [addingProductId, setAddingProductId] = useState(null);
    const [cartLines, setCartLines] = useState([]);
    const [pricingPreview, setPricingPreview] = useState(emptyPricingPreview);
    const [isLoadingPricing, setIsLoadingPricing] = useState(false);
    const [modifierModalProduct, setModifierModalProduct] = useState(null);
    const [modifierModalQuantity, setModifierModalQuantity] = useState(1);
    const [modifierModalNotes, setModifierModalNotes] = useState("");
    const [modifierModalOrderType, setModifierModalOrderType] = useState("dine_in");
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
    const [submitErrors, setSubmitErrors] = useState([]);
    const [hydratedCartStorageKey, setHydratedCartStorageKey] = useState(null);

    const orderForm = useForm({
        notes: "",
        payment_method: defaultPaymentMethod,
        bank_account_id: "",
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
    const submitOrderLabel = editableOrder?.access_token
        ? "Simpan Perubahan Pesanan"
        : orderForm.data.payment_method === "cash"
          ? "Buat Pesanan"
          : orderForm.data.payment_method === "bank_transfer"
            ? "Buat Pesanan & Lanjut Bayar"
            : "Buat Pesanan & Bayar Online";

    useEffect(() => {
        if (orderNotesFocusedRef.current) {
            return;
        }

        setOrderNotesDraft(orderForm.data.notes || "");
    }, [orderForm.data.notes]);

    useEffect(() => {
        if (!orderForm.data.payment_method && defaultPaymentMethod) {
            orderForm.setData("payment_method", defaultPaymentMethod);
        }
    }, [defaultPaymentMethod, orderForm]);

    const productsById = useMemo(
        () =>
            products.reduce((accumulator, product) => {
                accumulator[Number(product.id)] = product;
                return accumulator;
            }, {}),
        [products]
    );
    const bestSellerIds = useMemo(() => {
        if (!recommendations?.best_sellers?.length) {
            return [];
        }

        return recommendations.best_sellers
            .map((product) => Number(product.id))
            .filter(Boolean);
    }, [recommendations]);
    const selfOrderProducts = useMemo(
        () =>
            products
                .filter((product) => {
                    const tenantOutletId =
                        product.tenant_outlet?.id ??
                        product.tenant_outlet_id ??
                        null;

                    return (
                        !tenantOutletId ||
                        tenantOutlets.some(
                            (tenant) =>
                                Number(tenant.id) === Number(tenantOutletId)
                        )
                    );
                })
                .map((product) => {
                    const tenantOutletId =
                        product.tenant_outlet?.id ??
                        product.tenant_outlet_id ??
                        null;
                    const tenant = tenantOutlets.find(
                        (item) => Number(item.id) === Number(tenantOutletId)
                    );
                    const tenantHours =
                        tenant?.open_time && tenant?.close_time
                            ? {
                                  open_time: tenant.open_time,
                                  close_time: tenant.close_time,
                              }
                            : null;

                    return {
                        ...product,
                        category: tenant
                            ? {
                                  id: tenant.id,
                                  name: tenant.name,
                                  parent_id: null,
                              }
                            : null,
                        ...(tenant?.closed_reason
                            ? {
                                  store_closed_reason: tenant.closed_reason,
                                  ...(tenantHours
                                      ? { tenant_store_hours: tenantHours }
                                      : {}),
                                  ...(tenant.next_open_label
                                      ? {
                                            tenant_open_countdown:
                                                tenant.next_open_label,
                                        }
                                      : {}),
                              }
                            : tenantHours
                              ? { tenant_store_hours: tenantHours }
                              : {}),
                    };
                }),
        [products, tenantOutlets]
    );
    const kitchenCategories = useMemo(
        () =>
            tenantOutlets
                .filter((tenant) =>
                    selfOrderProducts.some(
                        (product) =>
                            Number(product.tenant_outlet_id) === Number(tenant.id)
                    )
                )
                .map((tenant) => ({
                    id: tenant.id,
                    name: tenant.name,
                    parent_id: null,
                    sort_order: tenant.sort_order,
                })),
        [selfOrderProducts, tenantOutlets]
    );
    const cartStorageOwnerKey = customer?.id
        ? `customer:${customer.id}`
        : pendingPhone
          ? `phone:${sanitizePhoneNumber(pendingPhone)}`
          : customer?.no_telp
            ? `phone:${sanitizePhoneNumber(customer.no_telp)}`
            : `table:${table.qr_token}`;
    const cartStorageKey = editableOrder?.access_token
        ? `table-order-edit:${editableOrder.access_token}`
        : `table-order-cart:${table.qr_token}:${cartStorageOwnerKey}`;

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
                            Number(modifier.unit_price || modifier.price || 0),
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
    const paymentFeeTotal = Number(
        resolvedPricingPreview?.summary?.payment_fee_total ?? 0
    );
    const payable = Number(
        resolvedPricingPreview?.summary?.grand_total ?? subtotal ?? 0
    );
    const selectedPaymentMethod =
        availablePaymentMethods.find(
            (method) => method.value === orderForm.data.payment_method
        ) || availablePaymentMethods[0] || null;
    const selectedBankAccount = (bankAccounts || []).find(
        (account) => String(account.id) === String(orderForm.data.bank_account_id)
    );
    const formatSubmitErrors = useCallback(
        (errors) =>
            Object.entries(errors || {}).flatMap(([field, value]) => {
                const messages = Array.isArray(value) ? value : [value];
                const itemIndex = field.match(/^items\.(\d+)/)?.[1];
                const itemName =
                    itemIndex !== undefined
                        ? normalizedCarts[Number(itemIndex)]?.product?.title ||
                          `Item ${Number(itemIndex) + 1}`
                        : null;
                const labels = {
                    customer: "Identitas pembeli",
                    notes: "Catatan pesanan",
                    payment_method: "Metode pembayaran",
                    bank_account_id: "Rekening transfer",
                    items: "Pesanan",
                };

                return messages.filter(Boolean).map((message) => ({
                    field,
                    label: itemName || labels[field] || "Pesanan",
                    message: String(message),
                }));
            }),
        [normalizedCarts]
    );
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
            order_type: modifierModalOrderType,
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
                        Number(option.price || 0),
                })),
            promo_reward_meta: null,
            is_promo_reward: false,
        };
    }, [
        modifierModalNotes,
        modifierModalOrderType,
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
            notes = "",
            orderType = "dine_in"
        ) => ({
            id: `line-${product.id}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            product_id: Number(product.id),
            qty: Math.max(1, Number(quantity || 1)),
            notes,
            order_type: orderType === "take_away" ? "take_away" : "dine_in",
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
                        notes: stripOrderTypeNotes(line.notes),
                        order_type:
                            line.order_type === "take_away"
                                ? "take_away"
                                : "dine_in",
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
                notes: buildOrderTypeNotes(
                    item.order_type,
                    item.notes
                ),
                order_type: item.order_type,
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
            const orderType =
                options?.orderType === "take_away" ? "take_away" : "dine_in";
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
                                notes,
                                orderType
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
                            createCartLine(
                                product,
                                [],
                                quantity,
                                null,
                                notes,
                                orderType
                            ),
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
                toast.error("Syarat promo Beli X Gratis Y belum terpenuhi.");
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
            setModifierModalOrderType("dine_in");
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

            const applicableOptions = (
                modifierModalProduct.modifier_options || []
            ).filter((option) =>
                appliesToOrderType(option, modifierModalOrderType)
            );
            const selectableOptions = applicableOptions.filter((option) =>
                isModifierOptionAvailable(option, modifierModalQuantity)
            );
            const selectedOptionIdSet = new Set(
                selectedModifierOptionIds.map((id) => Number(id || 0))
            );
            const selectableSelectedCount = selectableOptions.filter((option) =>
                selectedOptionIdSet.has(Number(option.id || 0))
            ).length;
            const groupedOptions = selectableOptions.reduce((groups, option) => {
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
                    const minSelect = Math.min(
                        options.length,
                        Math.max(
                            selectionMode === "optional" ? 0 : 1,
                            Number(firstOption.min_select ?? 0)
                        )
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
                    groupedOptions.size > 0 &&
                    Boolean(modifierModalProduct?.requires_modifier_selection) &&
                    selectableSelectedCount === 0
                ) {
                    toast.error("Produk ini wajib memilih minimal satu topping.");
                    return;
                }
            }

            setIsModifierModalSubmitting(true);

            const selectedModifiers = includeModifiers
                ? selectableOptions.filter((option) =>
                      selectedOptionIdSet.has(Number(option.id || 0))
                  )
                : [];

            addProductToCart(modifierModalProduct, {
                qty: modifierModalQuantity,
                notes: modifierModalNotes,
                orderType: modifierModalOrderType,
                modifiers: selectedModifiers,
            }).then(() => {
                setIsModifierModalSubmitting(false);
                setModifierModalProduct(null);
                setModifierModalQuantity(1);
                setModifierModalNotes("");
                setModifierModalOrderType("dine_in");
                setSelectedModifierOptionIds([]);
                setIsModifierPromoDetailOpen(false);
                toast.success(`${modifierModalProduct.title} ditambahkan`);
            });
        },
        [
            addProductToCart,
            modifierModalNotes,
            modifierModalOrderType,
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

    const openWizardStep = useCallback(
        (step) => {
            if (step === "products") {
                setMobileView("products");
                return;
            }

            if (normalizedCarts.length === 0) {
                toast.error("Keranjang masih kosong. Tambahkan menu terlebih dahulu.");
                setMobileView("products");
                return;
            }

            if (step === "payment") {
                openPaymentInfoTab();
                return;
            }

            setMobileView("cart");
        },
        [normalizedCarts.length, openPaymentInfoTab]
    );

    const confirmSubmitOrder = useCallback(async () => {
        const paymentMethodLabel =
            selectedPaymentMethod?.label || "Bayar di Kasir";
        const paymentFlowSummary =
            orderForm.data.payment_method === "cash"
                ? "Pembayaran diselesaikan dan di-approve kasir seperti alur sekarang."
                : orderForm.data.payment_method === "bank_transfer"
                  ? "Anda transfer manual ke rekening outlet, lalu admin/kasir mengonfirmasi setelah dana diterima."
                  : "Setelah order dibuat, Anda bisa langsung bayar sendiri dari meja lewat tautan pembayaran otomatis.";
        const paymentProcessingSummary =
            orderForm.data.payment_method === "cash"
                ? "Pesanan masuk ke dapur setelah pembayaran di-approve kasir."
                : orderForm.data.payment_method === "bank_transfer"
                  ? "Pesanan masuk ke dapur setelah transfer diverifikasi oleh admin atau kasir."
                  : "Pesanan masuk ke dapur otomatis setelah pembayaran online berhasil.";
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

        const { default: Swal } = await import("sweetalert2");
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
                                <div style="display:flex;gap:10px;"><span style="display:inline-flex;height:22px;min-width:22px;align-items:center;justify-content:center;border-radius:999px;background:#2563eb;color:#fff;font-size:11px;font-weight:700;">1</span><span>Metode dipilih: <strong>${paymentMethodLabel}</strong>.</span></div>
                                <div style="display:flex;gap:10px;"><span style="display:inline-flex;height:22px;min-width:22px;align-items:center;justify-content:center;border-radius:999px;background:#0f766e;color:#fff;font-size:11px;font-weight:700;">2</span><span>${paymentFlowSummary}</span></div>
                                <div style="display:flex;gap:10px;"><span style="display:inline-flex;height:22px;min-width:22px;align-items:center;justify-content:center;border-radius:999px;background:#b45309;color:#fff;font-size:11px;font-weight:700;">3</span><span>${paymentProcessingSummary}</span></div>
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
                        ${paymentFeeTotal > 0 ? `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;border:1px solid #fdba74;border-radius:14px;padding:10px 12px;background:linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%);"><span style="color:#9a3412;font-weight:600;">Biaya layanan pembayaran</span><strong style="color:#9a3412;">${formatPrice(paymentFeeTotal)}</strong></div>` : ""}
                        <div style="height:1px;background:#e2e8f0;"></div>
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:17px;"><span><strong>Total pembayaran</strong></span><strong style="color:#4f46e5;">${formatPrice(payable)}</strong></div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: editableOrder?.access_token
                ? "Simpan perubahan"
                : orderForm.data.payment_method === "cash"
                  ? "Kirim ke Kasir"
                  : "Buat Pesanan",
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
        paymentFeeTotal,
        paymentPreviewItems,
        promoDiscount,
        selectedPaymentMethod?.label,
        subtotal,
    ]);

    const submitOrder = useCallback(
        async (event) => {
            event?.preventDefault?.();
            setSubmitErrors([]);
            orderForm.clearErrors();

            if (normalizedCarts.length === 0) {
                setSubmitErrors([
                    {
                        field: "items",
                        label: "Pesanan",
                        message: "Keranjang masih kosong. Tambahkan minimal satu menu.",
                    },
                ]);
                toast.error("Keranjang masih kosong.");
                setMobileView("cart");
                return;
            }

            if (
                orderForm.data.payment_method === "bank_transfer" &&
                !orderForm.data.bank_account_id
            ) {
                setSubmitErrors([
                    {
                        field: "bank_account_id",
                        label: "Rekening transfer",
                        message: "Pilih rekening tujuan transfer terlebih dahulu.",
                    },
                ]);
                toast.error("Pilih rekening tujuan transfer terlebih dahulu.");
                setMobileView("payment");
                return;
            }

            const result = await confirmSubmitOrder();
            if (!result.isConfirmed) {
                return;
            }

            orderForm.transform((data) => ({
                ...data,
                payment_method: data.payment_method,
                bank_account_id:
                    data.payment_method === "bank_transfer" &&
                    data.bank_account_id
                        ? Number(data.bank_account_id)
                        : null,
                items: buildPreviewRequestItems(normalizedCarts),
            }));

            if (cartStorageKey && typeof window !== "undefined") {
                try {
                    window.localStorage.setItem(
                        cartStorageKey,
                        JSON.stringify({
                            notes: orderForm.data.notes || "",
                            cartLines,
                        })
                    );
                } catch {
                    // Submit tetap berjalan; state React masih mempertahankan keranjang.
                }
            }

            const submitConfig = {
                preserveScroll: true,
                onError: (errors) => {
                    const details = formatSubmitErrors(errors);
                    const resolvedDetails = details.length
                        ? details
                        : [
                              {
                                  field: "items",
                                  label: "Pesanan",
                                  message: "Stok atau data pesanan berubah. Periksa kembali pesanan.",
                              },
                          ];

                    setSubmitErrors(resolvedDetails);
                    toast.error("Pesanan belum dikirim. Keranjang tetap tersimpan.");
                    setMobileView(
                        resolvedDetails.some((error) =>
                            ["payment_method", "bank_account_id"].includes(error.field)
                        )
                            ? "payment"
                            : "cart"
                    );
                },
                onSuccess: () => {
                    if (cartStorageKey && typeof window !== "undefined") {
                        window.localStorage.removeItem(cartStorageKey);
                    }

                    setSubmitErrors([]);
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
            cartLines,
            cartStorageKey,
            confirmSubmitOrder,
            editableOrder?.access_token,
            formatSubmitErrors,
            normalizedCarts,
            orderForm,
            table.qr_token,
        ]
    );

    const submitIdentify = (event) => {
        event.preventDefault();
        const sanitizedPhone = sanitizePhoneNumber(identifyForm.data.no_telp);
        const normalizedPhone = normalizePhoneNumber(sanitizedPhone);
        identifyForm.setData("no_telp", normalizedPhone);

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
        orderForm.setData(
            "payment_method",
            editableOrder.payment_method || defaultPaymentMethod
        );

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
        defaultPaymentMethod,
        editableOrder,
        editableOrder?.access_token,
        orderForm,
    ]);

    useEffect(() => {
        if (editableOrder?.access_token) {
            cartStorageHydratedKeyRef.current = null;
            setHydratedCartStorageKey(null);
            return;
        }

        if (!cartStorageKey || typeof window === "undefined") {
            cartStorageHydratedKeyRef.current = null;
            setHydratedCartStorageKey(null);
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
                setHydratedCartStorageKey(cartStorageKey);
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
            setHydratedCartStorageKey(cartStorageKey);
            setCartLines(restoredLines);
            orderForm.setData("notes", parsedPayload?.notes || "");
        } catch {
            cartStorageHydratedKeyRef.current = cartStorageKey;
            setHydratedCartStorageKey(cartStorageKey);
            setCartLines([]);
            orderForm.setData("notes", "");
        }
    }, [cartStorageKey, editableOrder?.access_token, productsById]);

    useEffect(() => {
        if (
            !cartStorageKey ||
            hydratedCartStorageKey !== cartStorageKey ||
            typeof window === "undefined"
        ) {
            return;
        }

        try {
            window.localStorage.setItem(
                cartStorageKey,
                JSON.stringify({
                    notes: orderForm.data.notes || "",
                    cartLines,
                })
            );
        } catch {
            // State keranjang tetap tersedia selama halaman masih terbuka.
        }
    }, [cartLines, cartStorageKey, hydratedCartStorageKey, orderForm.data.notes]);

    useEffect(() => {
        if (!modifierModalProduct || !modifierModalDraftCart || !customer) {
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
                        payment_method: orderForm.data.payment_method,
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
        customer,
        modifierModalDraftCart,
        modifierModalProduct,
        normalizedCarts,
        orderForm.data.notes,
        orderForm.data.payment_method,
        table.qr_token,
    ]);

    useEffect(() => {
        if (!customer || normalizedCarts.length === 0) {
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
                        payment_method: orderForm.data.payment_method,
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
        customer,
        normalizedCarts,
        orderForm.data.notes,
        orderForm.data.payment_method,
        pricingDependency,
        table.qr_token,
    ]);

    return (
        <>
            <Head title={`Self Order ${table.name}`} />

            {sidebarOpen ? (
                <div
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
                    onClick={() => setSidebarOpen(false)}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.55)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_52%,_#38bdf8_100%)] px-4 py-4 text-white sm:px-6 sm:py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/90">
                                        Riwayat & Meja
                                    </p>
                                    <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                                        {outlet?.name || storeProfile?.name || "Outlet"}
                                    </h2>
                                    <p className="mt-1 text-sm text-sky-50/90">
                                        Meja {table.code || table.name}
                                        {customer?.name ? ` • ${customer.name}` : ""}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSidebarOpen(false)}
                                    className="rounded-2xl border border-white/15 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100/90">
                                        Pembayaran aktif
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-white">
                                        {selectedPaymentMethod?.label || "Bayar di Kasir"}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100/90">
                                        Nomor pelanggan
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-white">
                                        {customer?.no_telp || "-"}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100/90">
                                        Status akun
                                    </p>
                                    <p className="mt-1 text-sm font-semibold capitalize text-white">
                                        Tier {customer?.loyalty_tier || "regular"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[calc(92vh-180px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                            <div className="grid gap-4 lg:grid-cols-[1.05fr_1.4fr]">
                                <div className="space-y-4">
                                    <div className="rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,_#fffaf2_0%,_#fff1d6_55%,_#f9e3b3_100%)] p-4 shadow-[0_20px_45px_-34px_rgba(180,83,9,0.3)]">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                                            Informasi Meja
                                        </p>
                                        <div className="mt-3 space-y-3 text-sm text-slate-700">
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-slate-500">Outlet</span>
                                                <strong className="text-right text-slate-900">
                                                    {outlet?.name || storeProfile?.name || "Outlet"}
                                                </strong>
                                            </div>
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-slate-500">Meja aktif</span>
                                                <strong className="text-right text-slate-900">
                                                    {table.code || table.name}
                                                </strong>
                                            </div>
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-slate-500">Pelanggan</span>
                                                <strong className="text-right text-slate-900">
                                                    {customer?.name || "Pelanggan"}
                                                </strong>
                                            </div>
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-slate-500">Email</span>
                                                <strong className="text-right text-slate-900">
                                                    {customer?.email || "Belum ada email"}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,_#f4fdf7_0%,_#dcfce7_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(22,163,74,0.28)]">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                            Aksi Cepat
                                        </p>
                                        <div className="mt-3 grid gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSidebarOpen(false);
                                                    setMobileView("products");
                                                }}
                                                className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800"
                                            >
                                                Lihat Menu Lagi
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSidebarOpen(false);
                                                    setMobileView("cart");
                                                }}
                                                className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800"
                                            >
                                                Buka Keranjang
                                            </button>
                                            {customer ? (
                                                <button
                                                    type="button"
                                                    onClick={logoutCustomer}
                                                    className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-left text-sm font-semibold text-slate-700"
                                                >
                                                    Ganti Akun / Meja
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                Riwayat Pesanan
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Pilih riwayat untuk cek status atau lanjut melihat detail pesanan sebelumnya.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {recentOrders.length > 0 ? (
                                            recentOrders.slice(0, 5).map((order) => (
                                                <div
                                                    key={order.id}
                                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold text-slate-900">
                                                                {order.order_number}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {paymentMethodSummary(
                                                                    order.payment_method,
                                                                    order.payment_status ||
                                                                        order.status
                                                                )}
                                                            </p>
                                                        </div>
                                                        <p className="shrink-0 text-sm font-bold text-slate-900">
                                                            {formatPrice(order.grand_total)}
                                                        </p>
                                                    </div>
                                                    {order.access_token ? (
                                                        <Link
                                                            href={route("table-order.status", order.access_token)}
                                                            className="mt-3 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                                                        >
                                                            Lihat Status Pesanan
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            ))
                                        ) : recentTransactions.length > 0 ? (
                                            recentTransactions.slice(0, 5).map((transaction) => (
                                                <div
                                                    key={transaction.id}
                                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold text-slate-900">
                                                                {transaction.invoice}
                                                            </p>
                                                            <p className="mt-1 text-xs capitalize text-slate-500">
                                                                {paymentMethodSummary(
                                                                    transaction.payment_method,
                                                                    transaction.payment_status
                                                                )}
                                                            </p>
                                                        </div>
                                                        <p className="shrink-0 text-sm font-bold text-slate-900">
                                                            {formatPrice(transaction.grand_total)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                                                <p className="text-sm font-medium text-slate-500">
                                                    Belum ada riwayat pesanan
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    Riwayat pesanan pelanggan akan muncul di sini.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="fixed left-5 top-5 z-50 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur sm:flex"
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

            <div className="relative flex h-dvh flex-col overflow-hidden bg-slate-100">
                {/* Header minimal */}
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                                {outlet?.name || storeProfile?.name || "Outlet"}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                                Meja {table.code || table.name}
                                {customer?.name ? ` · ${customer.name}` : ""}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100"
                            aria-label="Riwayat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </button>
                    </div>
                </div>

                <div className="border-b border-slate-200 bg-white px-3 py-3">
                    <div className="mx-auto grid w-full max-w-3xl grid-cols-3">
                        {[
                            { id: "products", number: 1, label: "Pilih menu", shortLabel: "Menu" },
                            { id: "cart", number: 2, label: "Periksa pesanan", shortLabel: "Periksa" },
                            { id: "payment", number: 3, label: "Bayar & kirim", shortLabel: "Kirim" },
                        ].map((step, index, steps) => {
                            const currentIndex = steps.findIndex((item) => item.id === mobileView);
                            const completed = index < currentIndex;
                            const active = step.id === mobileView;
                            const locked = step.id !== "products" && cartCount === 0;

                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => openWizardStep(step.id)}
                                    disabled={locked}
                                    aria-current={active ? "step" : undefined}
                                    className="group relative flex min-w-0 flex-col items-center px-1 disabled:cursor-not-allowed"
                                >
                                    {index > 0 ? (
                                        <span className={`absolute right-1/2 top-4 h-0.5 w-full ${completed || active ? "bg-primary-400" : "bg-slate-200"}`} />
                                    ) : null}
                                    <span className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition ${
                                        completed
                                            ? "bg-primary-600 text-white"
                                            : active
                                              ? "bg-primary-100 text-primary-700 ring-4 ring-primary-50"
                                              : locked
                                                ? "bg-slate-100 text-slate-300"
                                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                                    }`}>
                                        {completed ? "✓" : step.number}
                                    </span>
                                    <span className={`mt-2 truncate text-[11px] font-bold sm:text-xs ${
                                        active || completed ? "text-slate-800" : locked ? "text-slate-300" : "text-slate-500"
                                    }`}>
                                        <span className="sm:hidden">{step.shortLabel}</span>
                                        <span className="hidden sm:inline">{step.label}</span>
                                        {step.id === "cart" && cartCount > 0 ? ` (${cartCount})` : ""}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="min-h-0 flex flex-1 flex-col">
                    {/* Panel produk */}
                    <div
                        className={`min-h-0 flex-1 overflow-hidden bg-slate-100 ${
                            mobileView !== "products" ? "hidden" : "flex flex-col"
                        }`}
                    >
                        <ProductGrid
                            products={selfOrderProducts}
                            mainCategories={kitchenCategories}
                            categories={kitchenCategories}
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
                            initialSortMode="featured_first"
                            bestSellerIds={bestSellerIds}
                            onBarcodeDetected={(barcode) => {
                                setSearchQuery(barcode);
                                setIsSearching(false);
                            }}
                            compactHeaderLayout={true}
                            embedHeaderInScroll={true}
                            simpleCards={true}
                            showViewModeToggle={false}
                            initialFilterExpanded={false}
                            gridLayoutClass="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                            scrollIntro={
                                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-700">
                                            Meja {table.code || table.name}
                                            {editableOrder?.order_number ? ` · Edit ${editableOrder.order_number}` : ""}
                                        </p>
                                        <p className="text-[11px] text-slate-400">{selectedPaymentMethod?.label || "Bayar di Kasir"}</p>
                                    </div>
                                    {customer ? (
                                        <button
                                            type="button"
                                            onClick={logoutCustomer}
                                            className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600"
                                        >
                                            Ganti akun
                                        </button>
                                    ) : null}
                                </div>
                            }
                        />
                    </div>

                    {/* Panel keranjang */}
                    <div
                        className={`flex h-full flex-col overflow-hidden bg-white ${
                            mobileView !== "cart" ? "hidden" : "flex"
                        }`}
                    >
                        <div className="border-b border-slate-100 px-4 py-3">
                            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
                                <p className="text-sm font-bold text-slate-900">
                                    Pesanan saya
                                    {editableOrder?.order_number ? (
                                        <span className="ml-2 text-xs font-normal text-amber-600">Edit {editableOrder.order_number}</span>
                                    ) : null}
                                </p>
                                {normalizedCarts.length > 0 && (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                                        {cartCount}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="mx-auto w-full max-w-3xl p-3 pb-36 lg:p-5 lg:pb-36">
                                <SubmitErrorAlert errors={submitErrors} />
                                {normalizedCarts.length > 0 ? (
                                    <div className={`${submitErrors.length ? "mt-3 " : ""}space-y-2`}>
                                        {normalizedCarts.map((item) => {
                                            const fallbackProduct = productsById[Number(item.product_id || 0)] || item.product;
                                            const pricingItem = pricingItemsByCartId[item.id];
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
                                                    onAddRewardProducts={handleAddRewardProducts}
                                                    onRemoveModifier={handleRemoveModifier}
                                                    onNotesChange={handleLocalCartNotesChange}
                                                    onQtyChange={handleUpdateQty}
                                                    onRemoveItem={handleRemoveFromCart}
                                                    highlightRewardProductIds={recentRewardProductIds}
                                                    simple={true}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                                            <IconShoppingCart size={32} />
                                        </div>
                                        <p className="text-sm font-medium text-slate-500">Belum ada pesanan</p>
                                        <button
                                            type="button"
                                            onClick={() => setMobileView("products")}
                                            className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-primary-600"
                                        >
                                            Lihat menu
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tombol lanjut ke bayar — sticky bottom */}
                        <div className="border-t border-slate-100 bg-white p-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.85rem)] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
                            <div className="mx-auto w-full max-w-3xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-600">Total</span>
                                    <span className="text-lg font-extrabold text-primary-600">{formatPrice(payable)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={openPaymentInfoTab}
                                    disabled={!normalizedCarts.length}
                                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold shadow-lg transition-all ${
                                        !normalizedCarts.length
                                            ? "cursor-not-allowed bg-slate-100 text-slate-400 shadow-none"
                                            : "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 active:scale-[0.99]"
                                    }`}
                                >
                                    <IconCash size={18} />
                                    <span>Lanjut ke Pembayaran</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`flex h-full flex-col overflow-hidden bg-white ${
                            mobileView !== "payment" ? "hidden" : "flex"
                        }`}
                    >
                        <div className="border-b border-slate-200 px-4 py-3">
                            <p className="text-sm font-bold text-slate-900">
                                Periksa dan kirim pesanan
                            </p>
                            <p className="text-xs text-slate-500">
                                Pilih cara bayar, lalu kirim ke kasir.
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-36 lg:pb-4">
                            <SubmitErrorAlert errors={submitErrors} />
                            <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold text-primary-700">
                                            {cartCount} item · Meja {table.code || table.name}
                                        </p>
                                        <p className="mt-1 text-base font-bold text-slate-900">
                                            {formatPrice(payable)}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                                        {selectedPaymentMethod?.label || "Bayar di Kasir"}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-slate-600">
                                    {orderForm.data.payment_method === "cash"
                                        ? "Pesanan dikirim ke kasir dan pembayaran diselesaikan di kasir."
                                        : orderForm.data.payment_method === "bank_transfer"
                                          ? "Kirim pesanan, lalu transfer ke rekening outlet yang dipilih."
                                          : "Kirim pesanan, lalu selesaikan pembayaran dari tautan yang tersedia."}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Metode pembayaran
                                </p>
                                <div className="mt-3 space-y-2">
                                    {availablePaymentMethods.map((method) => (
                                        <label
                                            key={method.value}
                                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                                                orderForm.data.payment_method === method.value
                                                    ? "border-primary-300 bg-primary-50"
                                                    : "border-slate-200 bg-slate-50"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="payment_method"
                                                value={method.value}
                                                checked={orderForm.data.payment_method === method.value}
                                                onChange={() => {
                                                    setSubmitErrors((current) =>
                                                        current.filter(
                                                            (error) =>
                                                                !["payment_method", "bank_account_id"].includes(error.field)
                                                        )
                                                    );
                                                    orderForm.setData("payment_method", method.value);
                                                    if (method.value !== "bank_transfer") {
                                                        orderForm.setData("bank_account_id", "");
                                                    } else if (!orderForm.data.bank_account_id && bankAccounts[0]?.id) {
                                                        orderForm.setData("bank_account_id", String(bankAccounts[0].id));
                                                    }
                                                }}
                                                className="shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {method.label}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {orderForm.data.payment_method === "bank_transfer" ? (
                                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                            Pilih rekening tujuan
                                        </p>
                                        <div className="mt-3 space-y-2">
                                            {bankAccounts.map((account) => (
                                                <label
                                                    key={account.id}
                                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 ${
                                                        String(orderForm.data.bank_account_id) === String(account.id)
                                                            ? "border-amber-300 bg-white"
                                                            : "border-amber-100 bg-white/70"
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="bank_account_id"
                                                        value={account.id}
                                                        checked={String(orderForm.data.bank_account_id) === String(account.id)}
                                                        onChange={() => {
                                                            setSubmitErrors((current) =>
                                                                current.filter(
                                                                    (error) => error.field !== "bank_account_id"
                                                                )
                                                            );
                                                            orderForm.setData("bank_account_id", String(account.id));
                                                        }}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {account.bank_name}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {account.account_number} a.n. {account.account_name}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        {selectedBankAccount ? (
                                            <p className="mt-3 text-xs text-amber-800">
                                                Transfer ke {selectedBankAccount.bank_name} {selectedBankAccount.account_number} a.n. {selectedBankAccount.account_name}.
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-4">
                                    <p className="text-sm font-bold text-slate-900">
                                        Ringkasan pesanan
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
                                            Subtotal
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
                                    {paymentFeeTotal > 0 && (
                                        <div className="flex justify-between rounded-xl border border-amber-200 bg-[linear-gradient(135deg,_#fff7ed_0%,_#fffbeb_100%)] px-3 py-2 text-sm">
                                            <span className="font-medium text-amber-800">
                                                Biaya layanan
                                            </span>
                                            <span className="font-semibold text-amber-900">
                                                {formatPrice(paymentFeeTotal)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="h-px bg-slate-200" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-semibold text-slate-800">
                                            Total
                                        </span>
                                        <span className={`text-xl font-bold transition-colors ${isLoadingPricing ? 'text-primary-400 animate-pulse' : 'text-primary-600'}`}>
                                            {formatPrice(payable)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-bold text-slate-900">
                                    Catatan <span className="font-normal text-slate-400">(opsional)</span>
                                </p>
                                <textarea
                                    rows={3}
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
                                    placeholder="Contoh: antarkan bersamaan"
                                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
                                />
                            </div>

                        </div>

                        <div className="hidden flex-shrink-0 border-t border-slate-200 bg-slate-50 p-3 lg:block">
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
                                        : submitOrderLabel}
                                </span>
                            </button>
                        </div>

                        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-slate-50/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur lg:hidden">
                            <div className="mx-auto w-full max-w-5xl">
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
                                            : "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30"
                                    }`}
                                >
                                    <IconReceipt size={16} />
                                    <span>
                                        {orderForm.processing
                                            ? editableOrder?.access_token
                                              ? "Menyimpan perubahan..."
                                              : "Mengirim order..."
                                            : submitOrderLabel}
                                    </span>
                                </button>
                            </div>
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

            {storeHours !== null && (storeHours?.is_permanently_closed || storeHours?.is_open === false) && (
                <StoreClosedOverlay storeHours={storeHours} />
            )}

            {cartCount > 0 && mobileView === "products" ? (
                <button
                    type="button"
                    onClick={() => setMobileView("cart")}
                    className="fixed bottom-5 right-4 z-40 flex min-w-[190px] items-center justify-between gap-4 rounded-2xl bg-slate-950 px-4 py-3 text-left text-white shadow-[0_18px_45px_-18px_rgba(15,23,42,0.85)] transition active:scale-[0.98] lg:right-6"
                >
                    <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                            <IconShoppingCart size={19} />
                        </span>
                        <span>
                            <span className="block text-xs text-slate-300">
                                {cartCount} item
                            </span>
                            <span className="block text-sm font-bold">
                                Lihat pesanan
                            </span>
                        </span>
                    </span>
                    <span className="text-sm font-bold">{formatPrice(payable)}</span>
                </button>
            ) : null}

            <Suspense fallback={null}>
                <ModifierOptionsModal
                    product={modifierModalProduct}
                    orderType={modifierModalOrderType}
                    onOrderTypeChange={(nextOrderType) => {
                        setModifierModalOrderType(nextOrderType);
                        setSelectedModifierOptionIds([]);
                    }}
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
                    simpleFlow={true}
                />
            </Suspense>
        </>
    );
}
