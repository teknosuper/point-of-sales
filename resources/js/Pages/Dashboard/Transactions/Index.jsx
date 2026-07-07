import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
    useRef,
} from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import axios from "axios";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import POSLayout from "@/Layouts/POSLayout";
import ProductGrid from "@/Components/POS/ProductGrid";
import ModifierOptionsModal from "@/Components/POS/ModifierOptionsModal";
import CartLineItem from "@/Components/POS/CartLineItem";
import CartPanel from "@/Components/POS/CartPanel";
import PaymentPanel from "@/Components/POS/PaymentPanel";
import CustomerSelect from "@/Components/POS/CustomerSelect";
import NumpadModal from "@/Components/POS/NumpadModal";
import HeldTransactions, {
    HoldButton,
} from "@/Components/POS/HeldTransactions";
import useBarcodeScanner from "@/Hooks/useBarcodeScanner";
import {
    buildLocalPricingPreview,
    buildCartPromoState,
    buildPricingItemsByCartId,
    formatRuleItems,
    hasPromoApplied,
    mergeRewardMetadataIntoCarts,
    normalizeBuyGetRewardCarts,
    PROMO_TOTAL_LABEL,
    promoBadgeSummary,
    promoBenefitPreview,
    promoDetailText,
    REWARD_ITEM_LABEL,
    promoTitleText,
    resolveCartPricingLine,
    resolveBuyGetBreakdown,
    shouldUseLocalPricingPreview,
} from "@/Utils/pricingRules";
import { useAuthorization } from "@/Utils/authorization";
import {
    buildOfflineInvoice,
    buildOfflineTransactionSignature,
    buildOfflinePricing,
    clearOfflineCart,
    clearOfflinePosBootstrap,
    loadOfflineCart,
    loadOfflinePosBootstrap,
    loadOfflineTransactionHistory,
    loadOfflineTransactionQueue,
    saveOfflineCart,
    saveOfflinePosBootstrap,
    saveOfflineTransactionHistory,
    saveOfflineTransactionQueue,
} from "@/Utils/offlinePos";
import {
    IconUser,
    IconShoppingCart,
    IconReceipt,
    IconPrinter,
    IconHistory,
    IconKeyboard,
    IconBarcode,
    IconCash,
    IconCreditCard,
    IconBuildingBank,
    IconAlertTriangle,
    IconQrcode,
    IconWallet,
    IconX,
    IconCheck,
    IconLoader2,
    IconChevronDown, IconMinus, IconPlus,
    IconChevronUp,
} from "@/Utils/icons";

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

const formatApiErrorMessage = (error, fallbackMessage) => {
    const responseData = error?.response?.data;
    const baseMessage =
        responseData?.message || error?.message || fallbackMessage;
    const detailMessage =
        responseData?.details ||
        responseData?.error?.message ||
        responseData?.error;

    if (
        detailMessage &&
        typeof detailMessage === "string" &&
        detailMessage !== baseMessage
    ) {
        return `${baseMessage}\n${detailMessage}`;
    }

    return baseMessage;
};

const formatInertiaErrorBag = (errors, fallbackMessage) => {
    if (!errors || typeof errors !== "object") {
        return fallbackMessage;
    }

    const messages = Object.values(errors)
        .flatMap((value) =>
            Array.isArray(value) ? value : value ? [value] : []
        )
        .filter(Boolean);

    if (messages.length === 0) {
        return fallbackMessage;
    }

    return messages.join("\n");
};

const resolveFreshnessMeta = (timestamp) => {
    if (!timestamp) {
        return {
            label: "belum ada",
            className:
                "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        };
    }

    const ageMinutes = Math.max(
        0,
        Math.round((Date.now() - new Date(timestamp).getTime()) / 60000)
    );

    if (ageMinutes <= 5) {
        return {
            label: "baru",
            className:
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        };
    }

    if (ageMinutes <= 30) {
        return {
            label: "perlu cek",
            className:
                "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
        };
    }

    return {
        label: "lama",
        className:
            "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    };
};

const WALK_IN_CUSTOMER = {
    id: "walk_in",
    name: "Pelanggan Umum",
    no_telp: "",
    member_code: "",
    is_loyalty_member: false,
    is_walk_in: true,
    loyalty_tier: null,
    loyalty_points: 0,
};

const resolvedProductDisplayPrice = (product) =>
    Number(product?.pricing_badge?.promo_price ?? product?.sell_price ?? 0);

const buildCartConsistencySignature = (items = []) =>
    (Array.isArray(items) ? items : [])
        .map((item) => {
            const modifierSignature = (item.modifiers || [])
                .map((modifier) =>
                    [
                        Number(modifier.product_modifier_option_id || 0),
                        String(modifier.name || "").trim(),
                        Number(modifier.qty || 0),
                        Number(modifier.unit_price || 0),
                        Number(modifier.base_price || 0),
                        Number(modifier.markup_price || 0),
                    ].join(":")
                )
                .sort()
                .join("|");

            return [
                Number(item.product_id || 0),
                Number(item.tenant_outlet_id || 0),
                Number(item.qty || 0),
                Number(item.price || 0),
                String(item.notes || "").trim(),
                String(item.promo_reward_meta?.rule_name || ""),
                String(item.promo_reward_meta?.reward_label || ""),
                modifierSignature,
            ].join("::");
        })
        .sort()
        .join("##");

export default function Index({
    carts = [],
    carts_total = 0,
    heldCarts = [],
    customers: customerOptions = [],
    diningTables: diningTableOptions = [],
    products: productOptions = [],
    categories: categoryOptions = [],
    productsMeta: productMetaProp = {
        page: 1,
        per_page: 120,
        total: 0,
        has_more: false,
    },
    initialPricingPreview = { items: [], summary: {} },
    paymentGateways: paymentGatewayOptions = [],
    defaultPaymentGateway = "cash",
    paymentGatewayMeta = {},
    bankAccounts = [],
    pendingTableOrders = [],
    kitchenStations: kitchenStationOptions = [],
    openTableOrderId = null,
    outletOpenShift = null,
    loyaltyTierOptions: loyaltyTierOptionValues = [],
    tenantOutlets: tenantOutletOptions = [],
    operationalSettings = null,
}) {
    const {
        auth,
        errors,
        lowStockNotifications = [],
        activeCashierShift: activeCashierShiftProp,
        activeOutlet: activeOutletProp,
        storeProfile: storeProfileProp,
    } = usePage().props;
    const { can } = useAuthorization();
    const canOpenShift = can("cashier-shifts-open");
    const canConfirmPayment = can("transactions-confirm-payment");
    const canCreateSalesReturn = can("sales-returns-create");

    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [remoteProducts, setRemoteProducts] = useState([]);
    const [catalogProducts, setCatalogProducts] = useState(productOptions);
    const [productCatalogMeta, setProductCatalogMeta] = useState(productMetaProp);
    const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState(false);
    const [addingProductId, setAddingProductId] = useState(null);
    const [removingItemId, setRemovingItemId] = useState(null);
    const [localCarts, setLocalCarts] = useState(carts);
    const [cartSyncVersion, setCartSyncVersion] = useState(0);
    const [pendingCartMutations, setPendingCartMutations] = useState(0);
    const [savingNoteCartId, setSavingNoteCartId] = useState(null);
    const [savingModifierCartId, setSavingModifierCartId] = useState(null);
    const [modifierModalProduct, setModifierModalProduct] = useState(null);
    const [modifierModalCartTargetId, setModifierModalCartTargetId] =
        useState(null);
    const [modifierModalQuantity, setModifierModalQuantity] = useState(1);
    const [modifierModalNotes, setModifierModalNotes] = useState("");
    const [isModifierPromoDetailOpen, setIsModifierPromoDetailOpen] =
        useState(false);
    const [selectedModifierOptionIds, setSelectedModifierOptionIds] = useState(
        []
    );
    const [isModifierModalSubmitting, setIsModifierModalSubmitting] =
        useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(WALK_IN_CUSTOMER);
    const [isCustomerInfoConfirmed, setIsCustomerInfoConfirmed] =
        useState(false);
    const [isCustomerInfoModalOpen, setIsCustomerInfoModalOpen] =
        useState(false);
    const [draftCustomer, setDraftCustomer] = useState(WALK_IN_CUSTOMER);
    const [openAddCustomerModalSignal, setOpenAddCustomerModalSignal] =
        useState(0);
    const [orderType, setOrderType] = useState("dine_in");
    const [draftOrderType, setDraftOrderType] = useState("dine_in");
    const [selectedTableId, setSelectedTableId] = useState("");
    const [draftSelectedTableId, setDraftSelectedTableId] = useState("");
    const [orderReferenceName, setOrderReferenceName] = useState("");
    const [draftOrderReferenceName, setDraftOrderReferenceName] = useState("");
    const [isTablePickerModalOpen, setIsTablePickerModalOpen] =
        useState(false);
    const [tablePickerContext, setTablePickerContext] = useState("final");
    const [pricingPreview, setPricingPreview] = useState(initialPricingPreview);
    const [isLoadingPricing, setIsLoadingPricing] = useState(false);
    const [redeemPointsInput, setRedeemPointsInput] = useState("");
    const [cashInput, setCashInput] = useState("");
    const [isCashPaymentModalOpen, setIsCashPaymentModalOpen] =
        useState(false);
    const [paymentMethod, setPaymentMethod] = useState(
        defaultPaymentGateway ?? "cash"
    );
    const [payLater, setPayLater] = useState(false);
    const [dueDate, setDueDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPreparingCheckoutPreview, setIsPreparingCheckoutPreview] =
        useState(false);
    const [checkoutModalStep, setCheckoutModalStep] = useState(null);
    const [completedTransaction, setCompletedTransaction] = useState(null);
    const [checkoutWarning, setCheckoutWarning] = useState("");
    const [isAddingMissingRewards, setIsAddingMissingRewards] = useState(false);
    const [recentRewardProductIds, setRecentRewardProductIds] = useState([]);
    const isRewardSyncingRef = useRef(false);
    const [isReceiptFrameReady, setIsReceiptFrameReady] = useState(false);
    const [isBrowserOnline, setIsBrowserOnline] = useState(
        typeof navigator === "undefined" ? true : navigator.onLine
    );
    const [isServerReachable, setIsServerReachable] = useState(true);
    const isOfflineMode = !isBrowserOnline || !isServerReachable;
    const [offlineBootstrap, setOfflineBootstrap] = useState(() =>
        loadOfflinePosBootstrap()
    );
    const [offlineQueue, setOfflineQueue] = useState([]);
    const [offlineHistory, setOfflineHistory] = useState([]);
    const [isOfflineHistoryOpen, setIsOfflineHistoryOpen] = useState(false);
    const [offlineHistoryFilter, setOfflineHistoryFilter] = useState("all");
    const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false);
    const [isPreparingOfflineSnapshot, setIsPreparingOfflineSnapshot] =
        useState(false);
    const [isCheckingOfflineDevice, setIsCheckingOfflineDevice] =
        useState(true);
    const [isRefreshingOfflinePreparation, setIsRefreshingOfflinePreparation] =
        useState(false);
    const [lastOfflineDeviceCheckAt, setLastOfflineDeviceCheckAt] =
        useState(null);
    const [offlineDeviceStatus, setOfflineDeviceStatus] = useState({
        serviceWorkerReady: false,
        standalone: false,
        likelyTablet: false,
    });
    const [isOfflineBannerExpanded, setIsOfflineBannerExpanded] = useState(
        () => {
            if (typeof window === "undefined") {
                return false;
            }

            const stored = window.localStorage.getItem(
                "pos:offline-banner-expanded"
            );

            return stored === "1";
        }
    );
    const [prefersPrintOpenLabel, setPrefersPrintOpenLabel] = useState(false);
    const [mobileView, setMobileView] = useState("products"); // 'products' | 'cart' | 'payment'
    const lastSyncedCartSignatureRef = useRef("");
    const lastShownStockIssueSignatureRef = useRef("");
    const cartReloadTimerRef = useRef(null);
    const hydratedOfflineCartRef = useRef(false);
    const [numpadOpen, setNumpadOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [selectedBankAccount, setSelectedBankAccount] = useState(null);
    const [selectedVoucherId, setSelectedVoucherId] = useState("");
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [shiftNotesInput, setShiftNotesInput] = useState("");
    const openingCashHelper =
        openingCashInput === ""
            ? null
            : formatPrice(Number(openingCashInput || 0));
    const [tableOrderApprovalTarget, setTableOrderApprovalTarget] = useState(null);
    const [tableOrderCashInput, setTableOrderCashInput] = useState("");
    const [tableOrderPaymentMethod, setTableOrderPaymentMethod] =
        useState("cash");
    const [isApprovingTableOrder, setIsApprovingTableOrder] = useState(false);
    const [tableOrderCancelTarget, setTableOrderCancelTarget] = useState(null);
    const [tableOrderCancelReason, setTableOrderCancelReason] = useState("");
    const [isCancellingTableOrder, setIsCancellingTableOrder] = useState(false);
    const [isEditingTableOrder, setIsEditingTableOrder] = useState(false);
    const [tableOrderEditItems, setTableOrderEditItems] = useState([]);
    const [isUpdatingTableOrder, setIsUpdatingTableOrder] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isHistoryFilterExpanded, setIsHistoryFilterExpanded] =
        useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        q: "",
        start_date: "",
        end_date: "",
        customer_scope: "",
        payment_status: "",
        payment_method: "",
        per_page: 10,
        page: 1,
    });
    const [historyTransactions, setHistoryTransactions] = useState([]);
    const [historyMeta, setHistoryMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
        from: null,
        to: null,
    });
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [selectedHistoryTransactionId, setSelectedHistoryTransactionId] =
        useState(null);
    const [isConfirmingHistoryPayment, setIsConfirmingHistoryPayment] =
        useState(false);
    const [isRequeueingHistoryReceipt, setIsRequeueingHistoryReceipt] =
        useState(false);
    const [isThermalPreviewOpen, setIsThermalPreviewOpen] = useState(false);
    const offlineSyncInFlightRef = useRef(false);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            "pos:offline-banner-expanded",
            isOfflineBannerExpanded ? "1" : "0"
        );
    }, [isOfflineBannerExpanded]);

    const trustedOfflineBootstrap =
        offlineBootstrap &&
        Number(offlineBootstrap.user_id || 0) === Number(auth?.user?.id || 0)
            ? offlineBootstrap
            : null;

    const normalizedSelectedCategory =
        selectedCategory === null ? null : Number(selectedCategory);
    const normalizedSearchQuery = String(searchQuery || "").trim();
    const shouldUseRemoteProductSearch =
        !isOfflineMode && normalizedSearchQuery.length >= 2;
    const products =
        catalogProducts.length > 0
            ? catalogProducts
            : trustedOfflineBootstrap?.products || [];
    const customers =
        customerOptions.length > 0
            ? customerOptions
            : trustedOfflineBootstrap?.customers || [];
    const categories =
        categoryOptions.length > 0
            ? categoryOptions
            : trustedOfflineBootstrap?.categories || [];
    const diningTables =
        diningTableOptions.length > 0
            ? diningTableOptions
            : trustedOfflineBootstrap?.diningTables || [];
    const paymentGateways =
        paymentGatewayOptions.length > 0
            ? paymentGatewayOptions
            : trustedOfflineBootstrap?.paymentGateways || [];
    const productsById = useMemo(
        () =>
            Object.fromEntries(
                (catalogProducts.length > 0
                    ? catalogProducts
                    : trustedOfflineBootstrap?.products || []
                ).map((product) => [Number(product.id), product])
            ),
        [catalogProducts, trustedOfflineBootstrap?.products]
    );
    const loyaltyTierOptions =
        loyaltyTierOptionValues.length > 0
            ? loyaltyTierOptionValues
            : trustedOfflineBootstrap?.loyaltyTierOptions || [];
    const tenantOutlets =
        tenantOutletOptions.length > 0
            ? tenantOutletOptions
            : trustedOfflineBootstrap?.tenantOutlets || [];
    const kitchenStations =
        kitchenStationOptions.length > 0
            ? kitchenStationOptions
            : trustedOfflineBootstrap?.kitchenStations || [];
    const activeCashierShift =
        activeCashierShiftProp ||
        (isOfflineMode ? trustedOfflineBootstrap?.activeCashierShift : null) ||
        null;
    const activeOutlet =
        activeOutletProp ||
        (isOfflineMode ? trustedOfflineBootstrap?.activeOutlet : null) ||
        null;
    const storeProfile =
        storeProfileProp ||
        (isOfflineMode ? trustedOfflineBootstrap?.storeProfile : null) ||
        null;
    const resolvedDefaultPaymentGateway =
        defaultPaymentGateway ||
        trustedOfflineBootstrap?.defaultPaymentGateway ||
        "cash";
    const qrisPaymentImageUrl = paymentGatewayMeta?.qrisImageUrl || null;
    const resolvedPricingPreview = useMemo(() => {
        if (localCarts.length === 0) {
            return pricingPreview;
        }

        const fallbackPreview = buildLocalPricingPreview(localCarts);
        if (shouldUseLocalPricingPreview(localCarts, pricingPreview)) {
            return fallbackPreview;
        }

        return pricingPreview;
    }, [localCarts, pricingPreview]);
    const pricingItemsByCartId = useMemo(
        () => buildPricingItemsByCartId(resolvedPricingPreview),
        [resolvedPricingPreview]
    );
    const modifierModalSelectedModifierTotal = useMemo(
        () =>
            (modifierModalProduct?.modifier_options || [])
                .filter((option) => selectedModifierOptionIds.includes(option.id))
                .reduce((sum, option) => sum + Number(option.price || 0), 0),
        [modifierModalProduct, selectedModifierOptionIds]
    );
    const modifierModalSelectedModifiers = useMemo(
        () =>
            (modifierModalProduct?.modifier_options || [])
                .filter((option) => selectedModifierOptionIds.includes(option.id))
                .map((option) => {
                    const unitPrice = Math.max(0, Number(option.price || 0));

                    return {
                        id: `preview-${option.id}`,
                        name: option.name,
                        qty: 1,
                        unit_price: unitPrice,
                        total_price: unitPrice,
                    };
                }),
        [modifierModalProduct, selectedModifierOptionIds]
    );
    const modifierModalPricingLine = useMemo(() => {
        if (!modifierModalProduct?.id) {
            return null;
        }

        const previewCartItem = {
            id: "preview-item",
            product_id: modifierModalProduct.id,
            qty: Math.max(1, Number(modifierModalQuantity || 1)),
            product: modifierModalProduct,
            modifiers: modifierModalSelectedModifiers,
        };
        const previewPricing = buildLocalPricingPreview([previewCartItem]);
        const previewPricingItem =
            buildPricingItemsByCartId(previewPricing)?.["preview-item"] || null;

        return resolveCartPricingLine(previewCartItem, previewPricingItem);
    }, [
        modifierModalProduct,
        modifierModalQuantity,
        modifierModalSelectedModifiers,
    ]);
    const modifierModalPromo = useMemo(() => {
        const badge = modifierModalProduct?.pricing_badge;
        const rule =
            modifierModalPricingLine?.pricingRule || badge?.pricing_rule || null;
        const quantity = Math.max(1, Number(modifierModalQuantity || 1));
        const baseUnitPrice = Number(
            modifierModalPricingLine?.baseUnitPrice ??
                badge?.base_price ??
                modifierModalProduct?.sell_price ??
                0
        );
        const effectiveUnitPrice = Number(
            modifierModalPricingLine?.effectiveUnitPrice ??
                badge?.promo_price ??
                modifierModalProduct?.sell_price ??
                0
        );
        const minimumQuantity = Math.max(
            1,
            Number(rule?.minimum_quantity || rule?.preview_quantity || 1)
        );
        const promoEligible =
            Boolean(rule) &&
            (rule.kind !== "qty_break" ||
                quantity >= minimumQuantity ||
                Number(modifierModalPricingLine?.discountTotal || 0) > 0);
        const summary = promoBadgeSummary(rule, badge?.label || badge?.rule_name || null);

        return {
            ...summary,
            quantity,
            minimumQuantity,
            promoEligible,
            baseUnitPrice,
            effectiveUnitPrice,
            baseLineTotal: baseUnitPrice * quantity,
            effectiveLineTotal: effectiveUnitPrice * quantity,
        };
    }, [modifierModalPricingLine, modifierModalProduct, modifierModalQuantity]);
    const modifierModalPromoBenefit = useMemo(
        () =>
            promoBenefitPreview({
                rule:
                    modifierModalPricingLine?.pricingRule ||
                    modifierModalProduct?.pricing_badge?.pricing_rule ||
                    null,
                quantity: modifierModalQuantity,
                baseUnitPrice: modifierModalPromo.baseUnitPrice,
                effectiveUnitPrice: modifierModalPromo.effectiveUnitPrice,
                productId: modifierModalProduct?.id,
                formatPrice,
            }),
        [
            modifierModalPricingLine,
            modifierModalProduct,
            modifierModalPromo,
            modifierModalQuantity,
        ]
    );
    const resolveRemainingProductStockForModal = useCallback(
        (productId, cartTargetId = null) => {
            const selectedProductId = Number(productId || 0);

            if (!selectedProductId) {
                return 0;
            }

            const product = productsById[selectedProductId];
            const baseStock = Math.max(0, Number(product?.stock || 0));
            const reservedQty = localCarts.reduce((sum, item) => {
                if (Number(item?.product_id || 0) !== selectedProductId) {
                    return sum;
                }

                if (cartTargetId && Number(item?.id || 0) === Number(cartTargetId)) {
                    return sum;
                }

                return sum + Math.max(0, Number(item?.qty || 0));
            }, 0);

            return Math.max(0, baseStock - reservedQty);
        },
        [localCarts, productsById]
    );
    const handleModifierModalQuantityChange = useCallback(
        (nextQuantity) => {
            const normalizedQuantity = Math.max(1, Number(nextQuantity || 1));
            const remainingStock = resolveRemainingProductStockForModal(
                modifierModalProduct?.id,
                modifierModalCartTargetId
            );

            if (normalizedQuantity > remainingStock) {
                toast.error(
                    `Stok tidak mencukupi. Tersedia: ${remainingStock}`
                );
                return;
            }

            setModifierModalQuantity(normalizedQuantity);
        },
        [
            modifierModalCartTargetId,
            modifierModalProduct?.id,
            resolveRemainingProductStockForModal,
        ]
    );
    const selectedTableItemNote = useMemo(() => {
        const normalizedReferenceName = String(
            orderReferenceName || selectedCustomer?.name || ""
        ).trim();
        const prefix =
            orderType === "dine_in"
                ? (() => {
                      if (!selectedTableId) {
                          return "";
                      }

                      const table = diningTableOptions.find(
                          (item) => String(item.id) === String(selectedTableId)
                      );

                      if (!table) {
                          return "";
                      }

                      const label = table.code || table.name || "";

                      return label ? `Meja ${label}` : "";
                  })()
                : "Take Away";

        if (!prefix) {
            return normalizedReferenceName;
        }

        if (!normalizedReferenceName) {
            return prefix;
        }

        return `${prefix} - ${normalizedReferenceName}`;
    }, [
        diningTableOptions,
        orderReferenceName,
        orderType,
        selectedCustomer?.name,
        selectedTableId,
    ]);

    // Ref for search input to enable keyboard focus
    const searchInputRef = useRef(null);
    const cartSectionRef = useRef(null);
    const receiptFrameRef = useRef(null);
    const pricingRequestAbortRef = useRef(null);
    const pricingRequestTimerRef = useRef(null);
    const cartTabAudioContextRef = useRef(null);
    const addToCartAudioContextRef = useRef(null);
    const paymentSuccessAudioContextRef = useRef(null);
    const hasUnlockedAudioRef = useRef(false);
    const previousSelectedTableItemNoteRef = useRef("");
    const hasHydratedOfflineCartRef = useRef(false);

    // Set default payment method
    useEffect(() => {
        setPaymentMethod(resolvedDefaultPaymentGateway);
    }, [resolvedDefaultPaymentGateway]);

    useEffect(() => {
        setPricingPreview(initialPricingPreview);
    }, [initialPricingPreview]);

    useEffect(
        () => () => {
            if (cartReloadTimerRef.current) {
                window.clearTimeout(cartReloadTimerRef.current);
                cartReloadTimerRef.current = null;
            }
        },
        []
    );

    const scheduleCartReconcile = useCallback((delay = 180) => {
        if (isOfflineMode) {
            return;
        }

        if (cartReloadTimerRef.current) {
            window.clearTimeout(cartReloadTimerRef.current);
        }

        cartReloadTimerRef.current = window.setTimeout(() => {
            router.reload({
                only: ["carts", "initialPricingPreview"],
                preserveScroll: true,
                preserveState: true,
            });
            cartReloadTimerRef.current = null;
        }, delay);
    }, [isOfflineMode]);

    useEffect(() => {
        setCatalogProducts(productOptions);
    }, [productOptions]);

    useEffect(() => {
        setProductCatalogMeta(productMetaProp);
    }, [productMetaProp]);

    useEffect(() => {
        if (pendingCartMutations > 0) {
            return;
        }

        if (carts.length > 0) {
            const nextCarts = normalizeBuyGetRewardCarts(
                mergeRewardMetadataIntoCarts(carts, localCarts),
                productsById
            );
            const nextSignature = nextCarts
                .map((item) =>
                    [
                        String(item.id),
                        Number(item.qty || 0),
                        String(item.notes || ""),
                        Number(item.product?.stock || 0),
                        (item.modifiers || [])
                            .map((modifier) =>
                                `${modifier.id || modifier.name}:${Number(modifier.unit_price || 0)}`
                            )
                            .join(","),
                    ].join("::")
                )
                .join("|");

            if (lastSyncedCartSignatureRef.current === nextSignature) {
                return;
            }

            lastSyncedCartSignatureRef.current = nextSignature;
            setLocalCarts(nextCarts);
            return;
        }

        if (
            !isOfflineMode &&
            isBrowserOnline &&
            isServerReachable &&
            hydratedOfflineCartRef.current &&
            localCarts.length > 0
        ) {
            lastSyncedCartSignatureRef.current = "";
            hydratedOfflineCartRef.current = false;
            setLocalCarts([]);
            clearOfflineCart();
            return;
        }

        if (!isOfflineMode && localCarts.length === 0) {
            lastSyncedCartSignatureRef.current = "";
        }
    }, [
        carts,
        isBrowserOnline,
        isOfflineMode,
        isServerReachable,
        localCarts,
        normalizeBuyGetRewardCarts,
        pendingCartMutations,
        productsById,
    ]);

    useEffect(() => {
        if (
            isOfflineMode ||
            pendingCartMutations > 0 ||
            carts.length > 0 ||
            localCarts.length > 0 ||
            !activeCashierShift
        ) {
            return;
        }

        let cancelled = false;

        axios
            .get(route("transactions.active-cart"), {
                headers: {
                    Accept: "application/json",
                },
            })
            .then((response) => {
                if (cancelled) {
                    return;
                }

                const serverCarts = Array.isArray(response.data?.data?.carts)
                    ? response.data.data.carts
                    : [];

                if (serverCarts.length === 0) {
                    return;
                }

                setLocalCarts(
                    normalizeBuyGetRewardCarts(
                        mergeRewardMetadataIntoCarts(serverCarts, localCarts),
                        productsById
                    )
                );
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [
        activeCashierShift,
        carts,
        isOfflineMode,
        localCarts,
        normalizeBuyGetRewardCarts,
        pendingCartMutations,
        productsById,
    ]);

    useEffect(() => {
        if (localCarts.length > 0) {
            hasHydratedOfflineCartRef.current = true;
            return;
        }

        const savedCart = loadOfflineCart();
        hasHydratedOfflineCartRef.current = true;

        if (savedCart.length === 0) {
            return;
        }

        if (!isBrowserOnline || !isServerReachable) {
            hydratedOfflineCartRef.current = true;
            setLocalCarts(savedCart);
        }
    }, [
        isBrowserOnline,
        isServerReachable,
        localCarts.length,
    ]);

    useEffect(() => {
        const previousAutoNote = previousSelectedTableItemNoteRef.current;
        const nextAutoNote = selectedTableItemNote;

        previousSelectedTableItemNoteRef.current = nextAutoNote;

        if (localCarts.length === 0) {
            return;
        }

        const changedItems = localCarts
            .map((item) => {
                const normalizedNotes = String(item.notes || "").trim();
                const usesAutoNote =
                    normalizedNotes === "" ||
                    (previousAutoNote !== "" &&
                        normalizedNotes === previousAutoNote);

                if (!usesAutoNote) {
                    return null;
                }

                const nextNotes = nextAutoNote || null;

                if ((item.notes || null) === nextNotes) {
                    return null;
                }

                return {
                    ...item,
                    notes: nextNotes,
                };
            })
            .filter(Boolean);

        if (changedItems.length === 0) {
            return;
        }

        setLocalCarts((currentCarts) =>
            currentCarts.map((item) => {
                const updatedItem = changedItems.find(
                    (candidate) => candidate.id === item.id
                );

                return updatedItem || item;
            })
        );

        if (isOfflineMode) {
            return;
        }

        changedItems.forEach((item) => {
            if (!item.id || String(item.id).startsWith("temp-")) {
                return;
            }

            axios.patch(route("transactions.updateCartNotes", item.id), {
                notes: item.notes || null,
            });
        });
    }, [isOfflineMode, localCarts, selectedTableItemNote]);

    useEffect(() => {
        setOfflineQueue(loadOfflineTransactionQueue());
        setOfflineHistory(loadOfflineTransactionHistory());
    }, []);

    useEffect(() => {
        if (!offlineBootstrap) {
            return;
        }

        if (
            Number(offlineBootstrap.user_id || 0) !==
            Number(auth?.user?.id || 0)
        ) {
            clearOfflinePosBootstrap();
            clearOfflineCart();
            setOfflineBootstrap(null);
            setLocalCarts([]);
        }
    }, [auth?.user?.id, offlineBootstrap]);

    const persistOfflineSnapshot = useCallback(async () => {
        if (
            isOfflineMode ||
            !activeCashierShiftProp
        ) {
            setIsPreparingOfflineSnapshot(false);
            return;
        }

        setIsPreparingOfflineSnapshot(true);

        try {
            const response = await axios.get(
                route("transactions.offline-bootstrap"),
                {
                    timeout: 20000,
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const snapshot = {
                saved_at: new Date().toISOString(),
                ...(response.data?.data || {}),
            };

            saveOfflinePosBootstrap(snapshot);
            setOfflineBootstrap(snapshot);
        } catch (error) {
            console.error("Offline bootstrap fetch error:", error);
        } finally {
            setIsPreparingOfflineSnapshot(false);
        }
    }, [
        activeCashierShiftProp,
        isOfflineMode,
    ]);

    useEffect(() => {
        persistOfflineSnapshot();
    }, [persistOfflineSnapshot]);

    const syncOfflineDeviceStatus = useCallback(() => {
        if (typeof window === "undefined") {
            setIsCheckingOfflineDevice(false);
            return;
        }

        setOfflineDeviceStatus({
            serviceWorkerReady: Boolean(navigator.serviceWorker?.controller),
            standalone: Boolean(
                window.matchMedia?.("(display-mode: standalone)")?.matches ||
                    window.navigator?.standalone === true
            ),
            likelyTablet: Boolean(
                window.matchMedia?.("(pointer: coarse)")?.matches ||
                    window.innerWidth <= 1024
            ),
        });
        setLastOfflineDeviceCheckAt(new Date().toISOString());
        setIsCheckingOfflineDevice(false);
    }, []);

    useEffect(() => {
        syncOfflineDeviceStatus();

        navigator.serviceWorker?.ready
            ?.then(() => {
                syncOfflineDeviceStatus();
            })
            .catch(() => {
                setIsCheckingOfflineDevice(false);
            });

        window.addEventListener("focus", syncOfflineDeviceStatus);

        return () => {
            window.removeEventListener("focus", syncOfflineDeviceStatus);
        };
    }, [syncOfflineDeviceStatus]);

    useEffect(() => {
        const handleOnline = () => setIsBrowserOnline(true);
        const handleOffline = () => setIsBrowserOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const checkServerHealth = useCallback(async () => {
        try {
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                setIsServerReachable(false);
                return;
            }

            await axios.get(route("transactions.health"), {
                timeout: 5000,
                headers: {
                    Accept: "application/json",
                },
            });

            setIsServerReachable(true);
        } catch {
            setIsServerReachable(false);
        }
    }, []);

    const refreshOfflinePreparation = useCallback(async () => {
        setIsRefreshingOfflinePreparation(true);
        setIsPreparingOfflineSnapshot(true);
        setIsCheckingOfflineDevice(true);

        persistOfflineSnapshot();
        syncOfflineDeviceStatus();
        await checkServerHealth();

        setIsRefreshingOfflinePreparation(false);
    }, [checkServerHealth, persistOfflineSnapshot, syncOfflineDeviceStatus]);

    useEffect(() => {
        let cancelled = false;
        const safeCheck = async () => {
            if (cancelled) {
                return;
            }

            if (typeof document !== "undefined" && document.visibilityState !== "visible") {
                return;
            }

            await checkServerHealth();
        };

        safeCheck();
        const intervalId = window.setInterval(safeCheck, 30000);

    const handleWakeUp = () => {
            if (document.visibilityState === "visible") {
                safeCheck();
            }
        };

        window.addEventListener("focus", safeCheck);
        document.addEventListener("visibilitychange", handleWakeUp);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener("focus", safeCheck);
            document.removeEventListener("visibilitychange", handleWakeUp);
        };
    }, [checkServerHealth]);

    const openProductSelection = useCallback((product) => {
        if (!product?.id) return;

        setModifierModalProduct(product);
        setModifierModalCartTargetId(null);
        setModifierModalNotes("");
        setIsModifierPromoDetailOpen(false);
        setSelectedModifierOptionIds([]);
        setModifierModalQuantity(1);
    }, []);

    // Barcode scanner integration
    const handleBarcodeScan = useCallback(
        async (barcode) => {
            const product = products.find(
                (p) => p.barcode?.toLowerCase() === barcode.toLowerCase()
            );

            if (product) {
                if (product.stock > 0) {
                    openProductSelection(product);
                    toast.success(`${product.title} ditambahkan (barcode)`);
                } else {
                    toast.error(`${product.title} stok habis`);
                }
            } else {
                if (isOfflineMode) {
                    toast.error(`Produk tidak ditemukan: ${barcode}`);
                    return;
                }

                try {
                    const response = await axios.post(
                        route("transactions.searchProduct"),
                        { barcode },
                        {
                            headers: {
                                Accept: "application/json",
                            },
                        }
                    );

                    const remoteProduct = response.data?.data;
                    if (remoteProduct) {
                        openProductSelection(remoteProduct);
                        toast.success(
                            `${remoteProduct.title} ditambahkan (barcode)`
                        );
                        return;
                    }
                } catch (error) {
                    console.error("Barcode product lookup error:", error);
                }

                toast.error(`Produk tidak ditemukan: ${barcode}`);
            }
        },
        [isOfflineMode, openProductSelection, products]
    );

    const { isScanning } = useBarcodeScanner(handleBarcodeScan, {
        enabled: true,
        minLength: 3,
    });

    const LowStockAlerts = () => null;

    // Calculations
    const discount = 0;
    const shipping = 0;
    const baseSubtotal = useMemo(
        () =>
            Number(
                resolvedPricingPreview?.summary?.base_subtotal ??
                    carts_total ??
                    0
            ),
        [resolvedPricingPreview, carts_total]
    );
    const promoDiscount = useMemo(
        () => Number(resolvedPricingPreview?.summary?.promo_discount_total ?? 0),
        [resolvedPricingPreview]
    );
    const voucherDiscount = useMemo(
        () =>
            Number(
                resolvedPricingPreview?.summary?.voucher_discount_total ?? 0
            ),
        [resolvedPricingPreview]
    );
    const loyaltyDiscount = useMemo(
        () =>
            Number(
                resolvedPricingPreview?.summary?.loyalty_discount_total ?? 0
            ),
        [resolvedPricingPreview]
    );
    const subtotal = useMemo(
        () =>
            Number(
                resolvedPricingPreview?.summary?.subtotal_after_promo ?? 0
            ),
        [resolvedPricingPreview]
    );
    const payable = useMemo(
        () =>
            Number(
                resolvedPricingPreview?.summary?.grand_total ?? subtotal ?? 0
            ),
        [resolvedPricingPreview, subtotal]
    );
    const appliedPromoGroups = useMemo(() => {
        const groups = resolvedPricingPreview?.applied_groups || [];

        return Object.values(
            groups.reduce((accumulator, group, index) => {
                const label = group?.label || group?.rule?.name || `Promo ${index + 1}`;
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
    const quickCashAmounts = useMemo(() => {
        const normalizedPayable = Math.max(0, Math.ceil(payable));
        const denominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

        if (normalizedPayable <= 0) {
            return [10000, 20000, 50000, 100000];
        }

        const amounts = [
            normalizedPayable,
            ...denominations.map(
                (denomination) =>
                    Math.ceil(normalizedPayable / denomination) * denomination
            ),
        ];

        return [...new Set(amounts)].sort((a, b) => a - b).slice(0, 4);
    }, [payable]);
    const isCashPayment = !payLater && paymentMethod === "cash";
    const cash = useMemo(
        () => (isCashPayment ? Math.max(0, Number(cashInput) || 0) : payable),
        [cashInput, isCashPayment, payable]
    );
    const cartCount = useMemo(
        () => localCarts.reduce((total, item) => total + Number(item.qty), 0),
        [localCarts]
    );
    const cartStockIssues = useMemo(
        () => {
            if (checkoutModalStep === "preview") {
                return [];
            }

            return localCarts
                .map((item) => {
                    const qty = Math.max(0, Number(item?.qty || 0));
                    const availableStock = Math.max(
                        0,
                        Number(item?.product?.stock || 0)
                    );

                    if (qty <= availableStock) {
                        return null;
                    }

                    return {
                        cartId: item.id,
                        productTitle: item?.product?.title || "Produk",
                        qty,
                        availableStock,
                    };
                })
                .filter(Boolean);
        },
        [checkoutModalStep, localCarts]
    );
    const hasCartStockIssue = cartStockIssues.length > 0;
    const lowStockCartWarnings = useMemo(() => {
        const seenProductIds = new Set();

        return localCarts
            .map((item) => {
                const productId = Number(item?.product_id || 0);
                const availableStock = Math.max(
                    0,
                    Number(item?.product?.stock || 0)
                );

                if (!productId || seenProductIds.has(productId)) {
                    return null;
                }

                seenProductIds.add(productId);

                if (availableStock <= 0 || availableStock >= 5) {
                    return null;
                }

                return {
                    productId,
                    productTitle: item?.product?.title || "Produk",
                    availableStock,
                };
            })
            .filter(Boolean)
            .sort((left, right) => left.availableStock - right.availableStock);
    }, [localCarts]);
    const hasLowStockCartWarning = lowStockCartWarnings.length > 0;
    
    useEffect(() => {
        if (!cartStockIssues || cartStockIssues.length === 0) {
            lastShownStockIssueSignatureRef.current = "";
            return;
        }

        const issueSignature = cartStockIssues
            .map((issue) =>
                [
                    String(issue.cartId),
                    issue.productTitle,
                    Number(issue.qty || 0),
                    Number(issue.availableStock || 0),
                ].join("::")
            )
            .join("|");

        if (lastShownStockIssueSignatureRef.current === issueSignature) {
            return;
        }

        lastShownStockIssueSignatureRef.current = issueSignature;

        const zeroStockItems = cartStockIssues.filter(
            (issue) => issue.availableStock === 0
        );

        const zeroStockCartIds = new Set(zeroStockItems.map((i) => i.cartId));

        if (zeroStockCartIds.size > 0) {
            setLocalCarts((prev) =>
                prev.filter((item) => !zeroStockCartIds.has(item.id))
            );

            if (!isOfflineMode) {
                const persistedZeroStockCartIds = zeroStockItems
                    .map((item) => item.cartId)
                    .filter(
                        (cartId) =>
                            cartId &&
                            !String(cartId).startsWith("temp-") &&
                            Number(cartId) > 0
                    );

                if (persistedZeroStockCartIds.length > 0) {
                    setPendingCartMutations((count) =>
                        count + persistedZeroStockCartIds.length
                    );

                    Promise.allSettled(
                        persistedZeroStockCartIds.map((cartId) =>
                            axios.delete(route("transactions.destroyCart", cartId))
                        )
                    )
                        .then(() => {
                            setCartSyncVersion((version) => version + 1);
                            scheduleCartReconcile(180);
                        })
                        .finally(() => {
                            setPendingCartMutations((count) =>
                                Math.max(
                                    0,
                                    count - persistedZeroStockCartIds.length
                                )
                            );
                        });
                }
            }
        }
    }, [cartStockIssues, isOfflineMode, scheduleCartReconcile]);
    const selectedDiningTable = useMemo(
        () =>
            diningTables.find(
                (table) => String(table.id) === String(selectedTableId)
            ) || null,
        [diningTables, selectedTableId]
    );
    const draftSelectedDiningTable = useMemo(
        () =>
            diningTables.find(
                (table) => String(table.id) === String(draftSelectedTableId)
            ) || null,
        [diningTables, draftSelectedTableId]
    );
    const isDraftTablePicker = tablePickerContext === "draft";
    const customerInfoReady = useMemo(
        () =>
            Boolean(selectedCustomer) &&
            (!selectedCustomer?.is_walk_in ||
                Boolean(String(orderReferenceName || "").trim())) &&
            (orderType !== "dine_in" || Boolean(selectedTableId)),
        [orderReferenceName, orderType, selectedCustomer, selectedTableId]
    );
    const pricingRelevantDependency = useMemo(
        () =>
            localCarts
                .map((item) => {
                    const modifierSignature = (item.modifiers || [])
                        .map(
                            (modifier) =>
                                `${modifier.name}:${Number(
                                    modifier.unit_price || 0
                                )}:${Number(modifier.qty || 0)}`
                        )
                        .sort()
                        .join(",");

                    return [
                        item.id,
                        item.product_id,
                        item.tenant_outlet_id,
                        item.qty,
                        item.price,
                        item.promo_reward_meta?.rule_name || "",
                        item.promo_reward_meta?.reward_label || "",
                        modifierSignature,
                    ].join(":");
                })
                .join("|"),
        [localCarts]
    );
    const rewardCartMetaPayload = useMemo(
        () =>
            localCarts
                .filter((item) => item.promo_reward_meta)
                .map((item) => ({
                    cart_id: String(item.id),
                    rule_name: item.promo_reward_meta?.rule_name || null,
                    reward_label:
                        item.promo_reward_meta?.reward_label || null,
                })),
        [pricingRelevantDependency]
    );
    const isCartSyncing = pendingCartMutations > 0;
    const offlineQueueCount = offlineQueue.length;
    const offlineModeReason = useMemo(() => {
        if (!isBrowserOnline) {
            return {
                label: "Mode kasir offline aktif - internet perangkat terputus",
                detail:
                    "Perangkat kasir tidak terhubung ke internet. Hanya transaksi tunai yang bisa diproses lokal sampai koneksi kembali.",
            };
        }

        if (!isServerReachable) {
            return {
                label: "Mode kasir offline aktif - server POS tidak merespons",
                detail:
                    "Internet perangkat tersedia, tetapi server POS sedang tidak merespons. Transaksi tunai tetap disimpan lokal dan akan sinkron saat server kembali normal.",
            };
        }

        if (offlineQueueCount > 0) {
            return {
                label: "Menunggu sinkronisasi offline - transaksi lokal belum terkirim",
                detail: `${offlineQueueCount} transaksi offline masih menunggu dikirim ke server.`,
            };
        }

        return {
            label: "Status offline",
            detail: "Mode offline aktif sementara.",
        };
    }, [isBrowserOnline, isServerReachable, offlineQueueCount]);
    const offlinePendingItems = useMemo(
        () => offlineQueue.filter((item) => item.status !== "failed"),
        [offlineQueue]
    );
    const offlineFailedItems = useMemo(
        () => offlineQueue.filter((item) => item.status === "failed"),
        [offlineQueue]
    );
    const offlineSyncedItems = useMemo(
        () => offlineHistory.filter((item) => item.status === "synced"),
        [offlineHistory]
    );
    const hasOfflineSnapshot = useMemo(
        () =>
            Boolean(
                trustedOfflineBootstrap?.products?.length &&
                    trustedOfflineBootstrap?.activeCashierShift
            ),
        [trustedOfflineBootstrap]
    );
    const isOfflineDeviceReady = useMemo(
        () =>
            Boolean(
                activeCashierShift &&
                    hasOfflineSnapshot &&
                    offlineDeviceStatus.serviceWorkerReady
            ),
        [
            activeCashierShift,
            hasOfflineSnapshot,
            offlineDeviceStatus.serviceWorkerReady,
        ]
    );
    const offlinePreparationSteps = useMemo(
        () => [
            {
                key: "snapshot",
                label: "Data POS",
                status: isPreparingOfflineSnapshot
                    ? "loading"
                    : hasOfflineSnapshot
                    ? "ready"
                    : "pending",
                helper: isPreparingOfflineSnapshot
                    ? "Menyimpan data terakhir"
                    : hasOfflineSnapshot
                    ? "Snapshot tersimpan"
                    : "Perlu dibuka online",
            },
            {
                key: "device",
                label: "Perangkat",
                status: isCheckingOfflineDevice
                    ? "loading"
                    : offlineDeviceStatus.serviceWorkerReady
                    ? "ready"
                    : "pending",
                helper: isCheckingOfflineDevice
                    ? "Memeriksa service worker"
                    : offlineDeviceStatus.serviceWorkerReady
                    ? offlineDeviceStatus.standalone
                        ? "PWA siap"
                        : "Browser siap offline"
                    : "Service worker belum aktif",
            },
            {
                key: "ready",
                label: "Mode Offline",
                status:
                    isPreparingOfflineSnapshot || isCheckingOfflineDevice
                        ? "loading"
                        : isOfflineDeviceReady
                        ? "ready"
                        : "pending",
                helper:
                    isPreparingOfflineSnapshot || isCheckingOfflineDevice
                        ? "Persiapan masih berjalan"
                        : isOfflineDeviceReady
                        ? "Siap untuk transaksi tunai"
                        : "Belum semua syarat terpenuhi",
            },
        ],
        [
            hasOfflineSnapshot,
            isCheckingOfflineDevice,
            isOfflineDeviceReady,
            isPreparingOfflineSnapshot,
            offlineDeviceStatus.serviceWorkerReady,
            offlineDeviceStatus.standalone,
        ]
    );
    const offlinePreparationProgress = useMemo(() => {
        const readySteps = offlinePreparationSteps.filter(
            (step) => step.status === "ready"
        ).length;

        return Math.round((readySteps / offlinePreparationSteps.length) * 100);
    }, [offlinePreparationSteps]);
    const formattedOfflineSnapshotAt = useMemo(
        () =>
            offlineBootstrap?.saved_at
                ? new Date(offlineBootstrap.saved_at).toLocaleString("id-ID")
                : null,
        [offlineBootstrap?.saved_at]
    );
    const formattedOfflineDeviceCheckAt = useMemo(
        () =>
            lastOfflineDeviceCheckAt
                ? new Date(lastOfflineDeviceCheckAt).toLocaleString("id-ID")
                : null,
        [lastOfflineDeviceCheckAt]
    );
    const unmetRewardWarnings = useMemo(() => {
        const cartProductQuantities = localCarts.reduce((accumulator, item) => {
            const productId = Number(item.product_id || 0);
            accumulator[productId] =
                (accumulator[productId] || 0) + Number(item.qty || 0);
            return accumulator;
        }, {});

        return localCarts
            .map((item) => {
                const fallbackProduct =
                    productsById[Number(item.product_id || 0)] || item.product;
                const rule = fallbackProduct?.pricing_badge?.pricing_rule;

                if (
                    !rule ||
                    rule.kind !== "buy_x_get_y" ||
                    !Array.isArray(rule.get_items) ||
                    !Array.isArray(rule.buy_items)
                ) {
                    return null;
                }

                const currentProductId = Number(item.product_id || 0);
                const hasCrossReward = rule.get_items.some(
                    (rewardItem) =>
                        Number(rewardItem.product_id || 0) !== currentProductId
                );

                if (!hasCrossReward) {
                    return null;
                }

                const currentBuyItem = rule.buy_items.find(
                    (buyItem) =>
                        Number(buyItem.product_id || 0) === currentProductId
                );
                const triggerQty = Math.max(
                    1,
                    Number(currentBuyItem?.quantity || rule.buy_qty || 1)
                );
                const currentQty = Number(item.qty || 0);

                if (currentQty < triggerQty) {
                    return null;
                }

                const missingRewards = rule.get_items.filter((rewardItem) => {
                    const rewardProductId = Number(rewardItem.product_id || 0);
                    const rewardQty = Math.max(
                        1,
                        Number(rewardItem.quantity || 1)
                    );
                    return (
                        rewardProductId !== currentProductId &&
                        Number(cartProductQuantities[rewardProductId] || 0) <
                            rewardQty
                    );
                });

                if (missingRewards.length === 0) {
                    return null;
                }

                return {
                    ruleId: rule.id,
                    ruleName: rule.name || promoBadgeSummary(rule).title || "Promo",
                    sourceProduct: item.product?.title || fallbackProduct?.title,
                    missingRewards: formatRuleItems(missingRewards),
                    rule,
                };
            })
            .filter(Boolean)
            .filter(
                (warning, index, array) =>
                    array.findIndex((item) => item.ruleId === warning.ruleId) ===
                    index
            );
    }, [localCarts, productsById]);
    const offlineSnapshotFreshness = useMemo(
        () => resolveFreshnessMeta(offlineBootstrap?.saved_at),
        [offlineBootstrap?.saved_at]
    );
    const offlineDeviceCheckFreshness = useMemo(
        () => resolveFreshnessMeta(lastOfflineDeviceCheckAt),
        [lastOfflineDeviceCheckAt]
    );
    const tableOrderCashAmount = useMemo(
        () => Math.max(0, Number(tableOrderCashInput) || 0),
        [tableOrderCashInput]
    );
    const tableOrderChangeAmount = useMemo(() => {
        const targetTotal = Number(tableOrderApprovalTarget?.grand_total || 0);

        return Math.max(0, tableOrderCashAmount - targetTotal);
    }, [tableOrderApprovalTarget, tableOrderCashAmount]);
    useEffect(() => {
        if (!tableOrderApprovalTarget || tableOrderPaymentMethod !== "qris") {
            return;
        }

        setTableOrderCashInput(
            String(Number(tableOrderApprovalTarget.grand_total || 0))
        );
    }, [tableOrderApprovalTarget, tableOrderPaymentMethod]);
    const selectedHistoryTransaction = useMemo(() => {
        if (!historyTransactions.length) {
            return null;
        }

        return (
            historyTransactions.find(
                (transaction) =>
                    Number(transaction.id) ===
                    Number(selectedHistoryTransactionId)
            ) ?? historyTransactions[0]
        );
    }, [historyTransactions, selectedHistoryTransactionId]);

    useEffect(() => {
        if (unmetRewardWarnings.length === 0 && checkoutWarning) {
            setCheckoutWarning("");
        }
    }, [checkoutWarning, unmetRewardWarnings.length]);

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
        if (localCarts.length === 0) {
            if (pricingRequestTimerRef.current) {
                window.clearTimeout(pricingRequestTimerRef.current);
                pricingRequestTimerRef.current = null;
            }

            pricingRequestAbortRef.current?.abort?.();
            setPricingPreview({
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
            });

            return;
        }

        if (isOfflineMode) {
            setPricingPreview(buildOfflinePricing(localCarts));
            setIsLoadingPricing(false);
            return;
        }

        if (isCartSyncing) {
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
                    route("transactions.pricing-preview"),
                    {
                        customer_id: selectedCustomer?.is_walk_in ? null : selectedCustomer?.id ?? null,
                        discount,
                        shipping_cost: shipping,
                        redeem_points: Number(redeemPointsInput || 0),
                        customer_voucher_id: selectedVoucherId || null,
                        reward_cart_meta: rewardCartMetaPayload,
                    },
                    {
                        signal: controller.signal,
                    }
                )
                .then((response) => {
                    if (!cancelled) {
                        setPricingPreview(response.data?.data ?? initialPricingPreview);
                    }
                })
                .catch((error) => {
                    if (cancelled || error?.code === "ERR_CANCELED") {
                        return;
                    }

                    setPricingPreview(buildLocalPricingPreview(localCarts));
                })
                .finally(() => {
                    if (!cancelled) {
                        setIsLoadingPricing(false);
                    }
                });
        }, 400);

        return () => {
            cancelled = true;
            if (pricingRequestTimerRef.current) {
                window.clearTimeout(pricingRequestTimerRef.current);
                pricingRequestTimerRef.current = null;
            }

            controller.abort();
        };
    }, [
        selectedCustomer?.id,
        selectedCustomer?.is_walk_in,
        pricingRelevantDependency,
        discount,
        shipping,
        redeemPointsInput,
        selectedVoucherId,
        cartSyncVersion,
        isCartSyncing,
        isOfflineMode,
        rewardCartMetaPayload,
    ]);

    useEffect(() => {
        if (!selectedCustomer?.is_loyalty_member) {
            setRedeemPointsInput("");
            setSelectedVoucherId("");
        }
    }, [selectedCustomer?.id, selectedCustomer?.is_loyalty_member]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const unlockAudio = () => {
            hasUnlockedAudioRef.current = true;
        };

        window.addEventListener("pointerdown", unlockAudio, { passive: true });
        window.addEventListener("keydown", unlockAudio, { passive: true });

        return () => {
            window.removeEventListener("pointerdown", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
        };
    }, []);

    useEffect(() => {
        if (orderType !== "dine_in") {
            setSelectedTableId("");
        }
    }, [orderType]);

    useEffect(() => {
        if (payLater || paymentMethod !== "cash") {
            setIsCashPaymentModalOpen(false);
        }
    }, [payLater, paymentMethod]);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) {
            return undefined;
        }

        const mediaQuery = window.matchMedia(
            "(max-width: 1024px), (pointer: coarse)"
        );
        const syncPreference = (event) => {
            setPrefersPrintOpenLabel(event.matches);
        };

        syncPreference(mediaQuery);

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", syncPreference);

            return () => {
                mediaQuery.removeEventListener("change", syncPreference);
            };
        }

        mediaQuery.addListener(syncPreference);

        return () => {
            mediaQuery.removeListener(syncPreference);
        };
    }, []);

    useEffect(() => {
        const eligibleVoucherIds = new Set(
            (resolvedPricingPreview?.eligible_vouchers || []).map((voucher) =>
                String(voucher.id)
            )
        );

        if (selectedVoucherId && !eligibleVoucherIds.has(selectedVoucherId)) {
            setSelectedVoucherId("");
        }
    }, [resolvedPricingPreview?.eligible_vouchers, selectedVoucherId]);

    useEffect(() => {
        if (!hasHydratedOfflineCartRef.current) {
            return;
        }

        if (localCarts.length > 0) {
            saveOfflineCart(localCarts);
            return;
        }

        clearOfflineCart();
    }, [localCarts]);

    // Payment options
    const paymentOptions = useMemo(() => {
        const options = Array.isArray(paymentGateways)
            ? paymentGateways.filter(
                  (gateway) =>
                      gateway?.value && gateway.value.toLowerCase() !== "cash"
              )
            : [];

        return [
            {
                value: "cash",
                label: "Tunai",
                description: "Pembayaran tunai langsung di kasir.",
            },
            ...options,
        ];
    }, [paymentGateways]);
    const paymentMethodLabel = useMemo(() => {
        if (payLater) {
            return "Nota Barang";
        }

        if (paymentMethod === "bank_transfer") {
            return "Transfer Bank";
        }

        if (paymentMethod === "midtrans") {
            return "Midtrans";
        }

        if (paymentMethod === "xendit") {
            return "Xendit";
        }

        if (paymentMethod === "qris") {
            return "QRIS";
        }

        return "Tunai";
    }, [payLater, paymentMethod]);
    const activePaymentOption = useMemo(
        () =>
            paymentOptions.find((option) => option.value === paymentMethod) || {
                value: "cash",
                label: "Tunai",
                description: "Pembayaran tunai langsung di kasir.",
            },
        [paymentMethod, paymentOptions]
    );
    const needsCashAdjustment = useMemo(
        () => isCashPayment && payable > 0 && cash < payable,
        [cash, isCashPayment, payable]
    );

    // Auto-set cash input for non-cash payment
    useEffect(() => {
        if (!isCashPayment && payable >= 0) {
            setCashInput(String(payable));
        }
    }, [isCashPayment, payable]);

    useEffect(() => {
        if (!isCustomerInfoModalOpen) {
            return;
        }

        setDraftCustomer(selectedCustomer || WALK_IN_CUSTOMER);
        setDraftOrderType(orderType || "dine_in");
        setDraftSelectedTableId(selectedTableId || "");
        setDraftOrderReferenceName(
            selectedCustomer?.is_walk_in
                ? orderReferenceName || ""
                : orderReferenceName || selectedCustomer?.name || ""
        );
    }, [
        isCustomerInfoModalOpen,
        orderReferenceName,
        orderType,
        selectedCustomer,
        selectedTableId,
    ]);

    const handleOpenShift = async () => {
        const openingCashNumber = Number(openingCashInput || 0);

        const result = await Swal.fire({
            title: "Buka shift kasir?",
            html: `Modal awal akan disimpan sebesar <strong>${formatPrice(
                openingCashNumber
            )}</strong>.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, Buka Shift",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        router.post(route("cashier-shifts.store"), {
            opening_cash: openingCashNumber,
            notes: shiftNotesInput,
            redirect_to: "transactions",
        });
    };
    const handleJoinShift = () => {
        router.post(route("cashier-shifts.store"), {
            join_existing: true,
            redirect_to: "transactions",
        });
    };
    const openCustomerInfoModal = useCallback(() => {
        setDraftCustomer(selectedCustomer || WALK_IN_CUSTOMER);
        setDraftOrderType(orderType || "dine_in");
        setDraftSelectedTableId(selectedTableId || "");
        setDraftOrderReferenceName(
            selectedCustomer?.is_walk_in
                ? orderReferenceName || ""
                : orderReferenceName || selectedCustomer?.name || ""
        );
        setIsCustomerInfoModalOpen(true);
    }, [
        orderReferenceName,
        orderType,
        selectedCustomer,
        selectedTableId,
    ]);
    const handleSaveCustomerInfo = useCallback(() => {
        if (!draftCustomer) {
            toast.error("Pilih pelanggan terlebih dahulu.");
            return;
        }

        if (draftOrderType === "dine_in" && !draftSelectedTableId) {
            toast.error("Pilih meja untuk makan di tempat.");
            return;
        }

        if (draftCustomer?.is_walk_in && !draftOrderReferenceName.trim()) {
            toast.error("Isi nama untuk keterangan order.");
            return;
        }

        setSelectedCustomer(draftCustomer);
        setOrderType(draftOrderType);
        setSelectedTableId(
            draftOrderType === "dine_in" ? draftSelectedTableId : ""
        );
        setOrderReferenceName(draftOrderReferenceName.trim());
        setIsCustomerInfoConfirmed(true);
        setIsCustomerInfoModalOpen(false);
    }, [
        draftCustomer,
        draftOrderReferenceName,
        draftOrderType,
        draftSelectedTableId,
    ]);
    const openPaymentInfoTab = useCallback(() => {
        // Validasi keranjang kosong
        if (localCarts.length === 0) {
            toast.error("Keranjang masih kosong. Tambahkan produk terlebih dahulu.");
            setMobileView("products");
            return;
        }
        if (hasCartStockIssue) {
            const firstIssue = cartStockIssues[0];
            toast.error(
                `${firstIssue.productTitle} melebihi stok. Kurangi qty sebelum lanjut ke pembayaran.`
            );
            setMobileView("cart");
            return;
        }
        if (!isCustomerInfoConfirmed || !customerInfoReady) {
            toast.error(
                "Atur info pelanggan terlebih dahulu sebelum lanjut ke pembayaran."
            );
            openCustomerInfoModal();
            return;
        }

        setMobileView("payment");
    }, [
        cartStockIssues,
        customerInfoReady,
        hasCartStockIssue,
        isCustomerInfoConfirmed,
        openCustomerInfoModal,
        localCarts,
    ]);

    useEffect(() => {
        if (!shouldUseRemoteProductSearch) {
            setRemoteProducts([]);
            setIsSearching(false);
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        setIsSearching(true);
        setRemoteProducts([]);

        const timerId = window.setTimeout(async () => {
            try {
                const response = await axios.get(
                    route("transactions.product-catalog"),
                    {
                        params: {
                            q: normalizedSearchQuery,
                            category_id: normalizedSelectedCategory || undefined,
                            limit: 24,
                        },
                        signal: controller.signal,
                    }
                );

                if (!cancelled) {
                    setRemoteProducts(response.data?.data || []);
                    setProductCatalogMeta((current) => ({
                        ...current,
                        ...(response.data?.meta || {}),
                    }));
                }
            } catch (error) {
                if (!cancelled && error?.code !== "ERR_CANCELED") {
                    setRemoteProducts([]);
                }
            } finally {
                if (!cancelled) {
                    setIsSearching(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timerId);
        };
    }, [
        normalizedSearchQuery,
        normalizedSelectedCategory,
        shouldUseRemoteProductSearch,
    ]);

    const loadMoreProducts = useCallback(async () => {
        if (
            shouldUseRemoteProductSearch ||
            isLoadingMoreProducts ||
            !productCatalogMeta?.has_more
        ) {
            return;
        }

        setIsLoadingMoreProducts(true);

        try {
            const nextPage = Number(productCatalogMeta?.page || 1) + 1;
            const response = await axios.get(
                route("transactions.product-catalog"),
                {
                    params: {
                        page: nextPage,
                        limit: productCatalogMeta?.per_page || 120,
                    },
                }
            );

            const incomingProducts = response.data?.data || [];
            setCatalogProducts((currentProducts) => {
                const existingIds = new Set(
                    currentProducts.map((product) => Number(product.id))
                );

                return [
                    ...currentProducts,
                    ...incomingProducts.filter(
                        (product) => !existingIds.has(Number(product.id))
                    ),
                ];
            });
            setProductCatalogMeta((current) => ({
                ...current,
                ...(response.data?.meta || {}),
            }));
        } catch (error) {
            console.error("Load more products error:", error);
        } finally {
            setIsLoadingMoreProducts(false);
        }
    }, [isLoadingMoreProducts, productCatalogMeta, shouldUseRemoteProductSearch]);

    const playCartTabSound = useCallback(() => {
        if (typeof window === "undefined" || !hasUnlockedAudioRef.current) {
            return;
        }

        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        try {
            if (!cartTabAudioContextRef.current) {
                cartTabAudioContextRef.current = new AudioContextClass();
            }

            const audioContext = cartTabAudioContextRef.current;

            if (audioContext.state === "suspended") {
                audioContext.resume().catch(() => {});
            }

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(720, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(
                520,
                audioContext.currentTime + 0.09
            );

            gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.05,
                audioContext.currentTime + 0.01
            );
            gainNode.gain.exponentialRampToValueAtTime(
                0.0001,
                audioContext.currentTime + 0.12
            );

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.12);
        } catch (error) {
            console.debug("Gagal memutar suara tab keranjang", error);
        }
    }, []);

    const playAddToCartSound = useCallback(() => {
        if (typeof window === "undefined" || !hasUnlockedAudioRef.current) {
            return;
        }

        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        try {
            if (!addToCartAudioContextRef.current) {
                addToCartAudioContextRef.current = new AudioContextClass();
            }

            const audioContext = addToCartAudioContextRef.current;

            if (audioContext.state === "suspended") {
                audioContext.resume().catch(() => {});
            }

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(
                860,
                audioContext.currentTime + 0.08
            );

            gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.045,
                audioContext.currentTime + 0.01
            );
            gainNode.gain.exponentialRampToValueAtTime(
                0.0001,
                audioContext.currentTime + 0.14
            );

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.14);
        } catch (error) {
            console.debug("Gagal memutar suara tambah keranjang", error);
        }
    }, []);

    const playPaymentSuccessSound = useCallback(() => {
        if (typeof window === "undefined" || !hasUnlockedAudioRef.current) {
            return;
        }

        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        try {
            if (!paymentSuccessAudioContextRef.current) {
                paymentSuccessAudioContextRef.current =
                    new AudioContextClass();
            }

            const audioContext = paymentSuccessAudioContextRef.current;

            if (audioContext.state === "suspended") {
                audioContext.resume().catch(() => {});
            }

            const gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.06,
                audioContext.currentTime + 0.02
            );
            gainNode.gain.exponentialRampToValueAtTime(
                0.0001,
                audioContext.currentTime + 0.32
            );

            const notes = [660, 880, 1040];

            notes.forEach((frequency, index) => {
                const oscillator = audioContext.createOscillator();
                const startAt = audioContext.currentTime + index * 0.08;

                oscillator.type = "triangle";
                oscillator.frequency.setValueAtTime(
                    frequency,
                    startAt
                );
                oscillator.connect(gainNode);
                oscillator.start(startAt);
                oscillator.stop(startAt + 0.12);
            });
        } catch (error) {
            console.debug("Gagal memutar suara pembayaran berhasil", error);
        }
    }, []);

    const tableOrderPaymentMethodLabel = (order) => {
        const method = String(
            order?.transaction?.payment_method || order?.payment_method || "cash"
        ).toLowerCase();

        return (
            {
                cash: "Tunai Kasir",
                qris: "QRIS Kasir",
                xendit: "Xendit Online",
                midtrans: "Midtrans Online",
                bank_transfer: "Transfer Bank",
            }[method] || method
        );
    };

    const isTableOrderOnlinePayment = (order) =>
        ["xendit", "midtrans"].includes(
            String(order?.transaction?.payment_method || order?.payment_method || "").toLowerCase()
        );

    const tableOrderPaymentStateLabel = (order) => {
        if (isTableOrderOnlinePayment(order)) {
            return String(order?.transaction?.payment_status || "").toLowerCase() === "paid"
                ? "Sudah Dibayar Online"
                : "Menunggu Bayar Online";
        }

        return "Menunggu Bayar Kasir";
    };

    const openTableOrderApproval = (order) => {
        setTableOrderApprovalTarget(order);
        setTableOrderCashInput(String(order?.grand_total || 0));
        setTableOrderPaymentMethod(
            isTableOrderOnlinePayment(order) ? "qris" : "cash"
        );
    };

    const clearOpenTableOrderQuery = () => {
        if (!window.location.search.includes("open_table_order=")) {
            return;
        }

        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete("open_table_order");
        window.history.replaceState(
            window.history.state,
            "",
            `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
        );
    };

    const closeTableOrderApproval = ({ reopenQrList = false } = {}) => {
        if (isApprovingTableOrder) {
            return;
        }

        setTableOrderApprovalTarget(null);
        setTableOrderCashInput("");
        setTableOrderPaymentMethod("cash");
        clearOpenTableOrderQuery();

        if (reopenQrList) {
            window.dispatchEvent(new CustomEvent("pos:open-qr-orders"));
        }
    };

    const confirmQrisPayment = () =>
        Swal.fire({
            title: "Konfirmasi Pembayaran QRIS",
            html: "Pastikan pembayaran QRIS manual sudah berhasil diterima.<br/>Lanjutkan hanya jika dana sudah benar-benar masuk.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sudah Dibayar",
            cancelButtonText: "Periksa Lagi",
            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
        });

    const confirmCashPayment = ({ total, paid }) =>
        Swal.fire({
            title: "Periksa Pembayaran Tunai",
            html: `
                <div style="text-align:left;display:grid;gap:8px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Total</span><strong>${formatPrice(total)}</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Dibayar</span><strong>${formatPrice(paid)}</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Kembalian</span><strong>${formatPrice(Math.max(paid - total, 0))}</strong></div>
                </div>
                <p style="margin-top:16px;">Pastikan uang diterima dan kembalian sudah sesuai sebelum transaksi disimpan.</p>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sudah Sesuai",
            cancelButtonText: "Cek Lagi",
            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
        });

    const submitTableOrderApproval = async () => {
        if (!tableOrderApprovalTarget?.id) {
            return;
        }

        if (tableOrderCashAmount < Number(tableOrderApprovalTarget.grand_total || 0)) {
            toast.error(
                tableOrderPaymentMethod === "cash"
                    ? "Nominal tunai kurang dari total order."
                    : "Nominal pembayaran kurang dari total order."
            );
            return;
        }

        if (tableOrderPaymentMethod === "qris") {
            const result = await confirmQrisPayment();

            if (!result.isConfirmed) {
                return;
            }
        }

        if (tableOrderPaymentMethod === "cash") {
            const result = await confirmCashPayment({
                total: Number(tableOrderApprovalTarget.grand_total || 0),
                paid: tableOrderCashAmount,
            });

            if (!result.isConfirmed) {
                return;
            }
        }

        setIsApprovingTableOrder(true);

        router.post(
            route("table-orders.approve", tableOrderApprovalTarget.id),
            {
                cash: tableOrderCashAmount,
                payment_method: tableOrderPaymentMethod,
                redirect_to: "transactions",
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    playPaymentSuccessSound();
                    toast.success(
                        `Pembayaran ${tableOrderApprovalTarget.order_number} berhasil dikonfirmasi.`
                    );
                    closeTableOrderApproval();
                },
                onError: (errors) => {
                    toast.error(
                        formatInertiaErrorBag(
                            errors,
                            "Gagal mengonfirmasi pembayaran order meja."
                        )
                    );
                },
                onCancel: () => {
                    toast.error("Proses approval pembayaran dibatalkan.");
                },
                onFinish: () => {
                    setIsApprovingTableOrder(false);
                },
            }
        );
    };

    const openTableOrderCancel = (order) => {
        setTableOrderCancelTarget(order);
        setTableOrderCancelReason("");
    };

    const openTableOrderEdit = (order) => {
        setIsEditingTableOrder(true);
        setTableOrderEditItems(
            (order.items || []).map((item) => ({
                product_id: item.product_id,
                product_title: item.product_title,
                qty: item.qty,
                unit_price: item.unit_price,
                line_total: item.line_total,
                notes: item.notes || "",
                modifiers: item.modifiers || [],
            }))
        );
    };

    const closeTableOrderEdit = () => {
        setIsEditingTableOrder(false);
        setTableOrderEditItems([]);
    };

    const updateTableOrderItemQty = (index, newQty) => {
        setTableOrderEditItems((prev) =>
            prev.map((item, i) =>
                i === index
                    ? { ...item, qty: newQty, line_total: item.unit_price * newQty }
                    : item
            )
        );
    };

    const removeTableOrderItem = (index) => {
        setTableOrderEditItems((prev) => prev.filter((_, i) => i !== index));
    };

    const submitTableOrderEdit = async () => {
        if (!tableOrderApprovalTarget) return;

        setIsUpdatingTableOrder(true);
        try {
            await axios.patch(
                route("table-orders.update-items", tableOrderApprovalTarget.id),
                {
                    items: tableOrderEditItems
                        .filter((item) => item.qty > 0)
                        .map((item) => ({
                            product_id: Number(item.product_id || 0),
                            qty: Number(item.qty || 0),
                            notes: item.notes || null,
                            modifier_ids: (item.modifiers || [])
                                .map((modifier) => ({
                                    id: Number(
                                        modifier.product_modifier_option_id ||
                                            modifier.id ||
                                            0
                                    ),
                                }))
                                .filter((modifier) => modifier.id > 0),
                        })),
                }
            );

            // Refresh the page to get updated data
            window.location.href = route("transactions.index", {
                open_table_order: tableOrderApprovalTarget.id
            });
        } catch (error) {
            console.error(error);
            toast.error(
                error.response?.data?.message ||
                error.response?.data?.error ||
                "Gagal update pesanan"
            );
        } finally {
            setIsUpdatingTableOrder(false);
        }
    };

    const closeTableOrderCancel = () => {
        if (isCancellingTableOrder) {
            return;
        }

        setTableOrderCancelTarget(null);
        setTableOrderCancelReason("");
    };

    const submitTableOrderCancel = () => {
        if (!tableOrderCancelTarget?.id) {
            return;
        }

        setIsCancellingTableOrder(true);

        router.post(
            route("table-orders.cancel", tableOrderCancelTarget.id),
            {
                reason: tableOrderCancelReason,
                redirect_to: "transactions",
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(
                        `Pesanan ${tableOrderCancelTarget.order_number} sudah dibatalkan.`
                    );
                    setTableOrderCancelTarget(null);
                    setTableOrderCancelReason("");
                    setTableOrderApprovalTarget(null);
                    setTableOrderCashInput("");
                    setTableOrderPaymentMethod("cash");
                    clearOpenTableOrderQuery();
                    window.dispatchEvent(new CustomEvent("pos:close-qr-orders"));
                    router.reload({
                        only: ["pendingTableOrders"],
                        preserveScroll: true,
                        preserveState: true,
                    });
                },
                onFinish: () => setIsCancellingTableOrder(false),
            }
        );
    };

    useEffect(() => {
        if (!openTableOrderId || tableOrderApprovalTarget?.id === openTableOrderId) {
            return;
        }

        const matchedOrder = (pendingTableOrders || []).find(
            (order) => Number(order.id) === Number(openTableOrderId)
        );

        if (matchedOrder) {
            openTableOrderApproval(matchedOrder);
        }
    }, [openTableOrderId, pendingTableOrders, tableOrderApprovalTarget]);

    useEffect(() => {
        const handleOpenHistory = () => {
            setIsHistoryModalOpen(true);
        };

        window.addEventListener("pos:open-history", handleOpenHistory);

        return () => {
            window.removeEventListener("pos:open-history", handleOpenHistory);
        };
    }, []);

    useEffect(() => {
        if (
            selectedHistoryTransaction ||
            !historyTransactions.length
        ) {
            return;
        }

        setSelectedHistoryTransactionId(historyTransactions[0].id);
    }, [historyTransactions, selectedHistoryTransaction]);

    useEffect(() => {
        if (!isHistoryModalOpen) {
            return;
        }

        const controller = new AbortController();
        const keywordDelay = historyFilters.q ? 250 : 0;

        const fetchHistory = window.setTimeout(async () => {
            setIsHistoryLoading(true);

            try {
                const response = await axios.get(
                    route("transactions.history-feed"),
                    {
                        params: historyFilters,
                        signal: controller.signal,
                    }
                );

                const payload = response.data || {};
                const nextTransactions = Array.isArray(payload.data)
                    ? payload.data
                    : [];

                setHistoryTransactions(nextTransactions);
                setHistoryMeta((current) => ({
                    ...current,
                    ...(payload.meta || {}),
                }));
                setSelectedHistoryTransactionId((current) =>
                    current &&
                    nextTransactions.some((item) => item.id === current)
                        ? current
                        : nextTransactions[0]?.id ?? null
                );
            } catch (error) {
                if (
                    axios.isCancel?.(error) ||
                    error?.name === "CanceledError"
                ) {
                    return;
                }

                toast.error("Gagal memuat riwayat transaksi.");
            } finally {
                setIsHistoryLoading(false);
            }
        }, keywordDelay);

        return () => {
            window.clearTimeout(fetchHistory);
            controller.abort();
        };
    }, [isHistoryModalOpen, historyFilters]);

    const addProductToCart = useCallback(async (product, options = {}) => {
        if (!product?.id) return;

        // Block add to cart if tenant outlet is closed or outside operating hours
        if (product.store_closed_reason) {
            const tenantHours = product.tenant_store_hours ?? null;
            const hoursLabel =
                tenantHours?.open_time && tenantHours?.close_time
                    ? ` (${tenantHours.open_time}–${tenantHours.close_time})`
                    : "";
            const label = product.store_closed_reason === "store_closed"
                ? "Toko Tutup"
                : `Belum Buka${hoursLabel}`;
            toast.error(`${product.tenant_outlet?.name || product.title} — ${label}. Tidak bisa ditambahkan saat ini.`);
            return;
        }

        const modifiers = Array.isArray(options.modifiers)
            ? options.modifiers.filter((item) => item?.name)
            : [];
        const quantity = Math.max(1, Number(options.qty || 1));
        // Use product-specific notes for display (but not for shouldForceNew)
        const normalizedNotes = String(options.notes || "").trim();
        const rewardPromoMeta = options.rewardPromoMeta || null;
        // Note: selectedTableItemNote (table info) should NOT trigger forceNew
        // Only product-specific notes should trigger forceNew
        const productSpecificNotes = String(options.notes || "").trim();
        const shouldForceNew =
            modifiers.length > 0 ||
            Boolean(rewardPromoMeta) ||
            productSpecificNotes.length > 0;

        if (isOfflineMode) {
            const tempId = `offline-${product.id}-${Date.now()}`;

            setLocalCarts((currentCarts) => {
                if (!shouldForceNew) {
                    const existingCart = currentCarts.find(
                        (item) =>
                            item.product_id === product.id &&
                            !item.promo_reward_meta &&
                            !(item.notes || "").trim() &&
                            (!item.modifiers || item.modifiers.length === 0)
                    );

                    if (existingCart) {
                        return currentCarts.map((item) =>
                            item.id === existingCart.id
                                ? {
                                      ...item,
                                      qty: Number(item.qty || 0) + quantity,
                                      promo_reward_meta:
                                          rewardPromoMeta ||
                                          item.promo_reward_meta ||
                                          null,
                                  }
                                : item
                        );
                    }
                }

                return [
                    {
                        id: tempId,
                        product_id: product.id,
                        qty: quantity,
                        price: resolvedProductDisplayPrice(product) * quantity,
                        notes: normalizedNotes,
                        product: { ...product },
                        tenant_outlet_id: product.tenant_outlet_id || null,
                        promo_reward_meta: rewardPromoMeta,
                        modifiers: modifiers.map((modifier, index) => ({
                            id: `${tempId}-modifier-${index}`,
                            name: modifier.name,
                            qty: 1,
                            unit_price: Math.max(
                                0,
                                Number(modifier.price || 0)
                            ),
                            total_price: Math.max(
                                0,
                                Number(modifier.price || 0)
                            ),
                        })),
                        is_offline: true,
                    },
                    ...currentCarts,
                ];
            });

            toast.success(`${product.title} ditambahkan (offline)`);
            playAddToCartSound();
            return true;
        }

        setAddingProductId(product.id);
        setPendingCartMutations((count) => count + 1);
        if (checkoutModalStep === "preview") {
            try {
                await axios.post(route("transactions.checkout-release"));
            } catch {
                // Backend also releases on cart mutations.
            } finally {
                setCheckoutModalStep(null);
                setCheckoutWarning("");
                setIsReceiptFrameReady(false);
            }
        }
        const previousCarts = localCarts;
        const tempId = `temp-${product.id}-${Date.now()}`;

        setLocalCarts((currentCarts) => {
            if (!shouldForceNew) {
                const existingCart = currentCarts.find(
                    (item) =>
                        item.product_id === product.id &&
                        !item.promo_reward_meta &&
                        !(item.notes || "").trim() &&
                        (!item.modifiers || item.modifiers.length === 0)
                );

                if (existingCart) {
                    return currentCarts.map((item) =>
                        item.id === existingCart.id
                            ? {
                                  ...item,
                                  qty: Number(item.qty || 0) + quantity,
                                  price: resolvedProductDisplayPrice(
                                      item.product || product
                                  ) * (Number(item.qty || 0) + quantity),
                                  promo_reward_meta:
                                      rewardPromoMeta ||
                                      item.promo_reward_meta ||
                                      null,
                              }
                            : item
                    );
                }
            }

            return [
                {
                    id: tempId,
                    product_id: product.id,
                    qty: quantity,
                    price: resolvedProductDisplayPrice(product) * quantity,
                    notes: normalizedNotes || null,
                    product: {
                        ...product,
                    },
                    tenant_outlet_id: product.tenant_outlet_id || null,
                    promo_reward_meta: rewardPromoMeta,
                    modifiers: modifiers.map((modifier, index) => ({
                        id: `${tempId}-modifier-${index}`,
                        name: modifier.name,
                        qty: 1,
                        unit_price: Math.max(
                            0,
                            Number(modifier.price || 0)
                        ),
                        total_price: Math.max(
                            0,
                            Number(modifier.price || 0)
                        ),
                    })),
                    is_optimistic: true,
                },
                ...currentCarts,
            ];
        });

        return axios
            .post(
                route("transactions.addToCart"),
                {
                    product_id: product.id,
                    sell_price: product.sell_price,
                    qty: quantity,
                    force_new: shouldForceNew,
                    is_promo_reward: Boolean(rewardPromoMeta),
                    promo_reward_rule_name:
                        rewardPromoMeta?.rule_name || null,
                    promo_reward_label:
                        rewardPromoMeta?.reward_label || null,
                },
                {
                    headers: {
                        Accept: "application/json",
                    },
                }
            )
            .then(async (response) => {
                let serverCart = response.data?.data?.cart;

                if (serverCart && modifiers.length > 0) {
                    const modifierResponse = await axios.put(
                        route("transactions.syncCartModifiers", serverCart.id),
                        {
                            notes: normalizedNotes,
                            modifiers: modifiers.map((modifier) => ({
                                name: modifier.name,
                                qty: 1,
                                unit_price: Math.max(
                                    0,
                                    Number(modifier.price || 0)
                                ),
                                base_price: Math.max(0, Number(modifier.base_price || 0)),
                                markup_price: Math.max(0, Number(modifier.markup_price || 0)),
                            })),
                        }
                    );

                    serverCart = modifierResponse.data?.data?.cart || serverCart;
                } else if (serverCart && normalizedNotes) {
                    const notesResponse = await axios.patch(
                        route("transactions.updateCartNotes", serverCart.id),
                        {
                            notes: normalizedNotes,
                        }
                    );

                    serverCart = notesResponse.data?.data?.cart || serverCart;
                }

                if (serverCart) {
                    setLocalCarts((currentCarts) => {
                        const withoutTemp = currentCarts.filter(
                            (item) => item.id !== tempId
                        );
                        const normalizedServerCart = rewardPromoMeta
                            ? {
                                  ...serverCart,
                                  promo_reward_meta: rewardPromoMeta,
                              }
                            : serverCart;
                        const existingIndex = withoutTemp.findIndex(
                            (item) => item.id === normalizedServerCart.id
                        );

                        if (existingIndex >= 0) {
                            const nextCarts = [...withoutTemp];
                            nextCarts[existingIndex] = normalizedServerCart;

                            return nextCarts;
                        }

                        return [normalizedServerCart, ...withoutTemp];
                    });
                }

                setCartSyncVersion((version) => version + 1);
                toast.success(`${product.title} ditambahkan`);
                playAddToCartSound();
                return true;
            })
            .catch((error) => {
                if (!error?.response) {
                    setIsServerReachable(false);

                    setLocalCarts((currentCarts) =>
                        currentCarts.map((item) =>
                            item.id === tempId
                                ? {
                                      ...item,
                                      is_offline: true,
                                  }
                                : item
                        )
                    );

                    toast("Server tidak merespons. Item dialihkan ke mode offline.", {
                        duration: 4000,
                        icon: "📴",
                    });
                    return true;
                }

                setLocalCarts(previousCarts);
                toast.error(
                    error?.response?.data?.message || "Gagal menambahkan produk"
                );
                return false;
            })
            .finally(() => {
                setPendingCartMutations((count) => Math.max(0, count - 1));
                setAddingProductId(null);
            });
    }, [
        checkoutModalStep,
        isOfflineMode,
        localCarts,
        playAddToCartSound,
        selectedTableItemNote,
    ]);

    const handleAddRewardProducts = useCallback(
        async (rule, options = {}) => {
            if (checkoutModalStep === "preview" || isSubmitting) {
                return;
            }

            if (
                !rule ||
                rule.kind !== "buy_x_get_y" ||
                !Array.isArray(rule?.buy_items) ||
                !Array.isArray(rule?.get_items)
            ) {
                return;
            }

            const buyItems = Array.isArray(rule?.buy_items) ? rule.buy_items : [];
            const rewardItems = Array.isArray(rule?.get_items)
                ? rule.get_items
                : [];

            if (buyItems.length === 0 || rewardItems.length === 0) {
                toast.error("Item bonus untuk promo ini tidak ditemukan.");
                return;
            }

            let addedCount = 0;
            const missingRewards = [];
            const addedRewardProductIds = [];
            const ruleName =
                rule?.name || rule?.label || promoBadgeSummary(rule).title || "Promo";
            const buyAdjustments = Array.isArray(options?.buyAdjustments)
                ? options.buyAdjustments
                : [];
            const buyCartQuantities = localCarts.reduce(
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

                if (productId <= 0 || qty <= 0) {
                    continue;
                }

                buyCartQuantities[productId] =
                    Number(buyCartQuantities[productId] || 0) + qty;
            }
            const existingRewardQuantities = localCarts.reduce(
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
                const requiredQty = Math.max(
                    1,
                    Number(buyItem.quantity || 1)
                );
                const currentQty = Number(buyCartQuantities[productId] || 0);
                const nextCycles = Math.floor(currentQty / requiredQty);

                return currentMin === null
                    ? nextCycles
                    : Math.min(currentMin, nextCycles);
            }, null);

            if (!completedCycles || completedCycles <= 0) {
                return;
            }

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

                const rewardProduct =
                    productsById[rewardProductId] || null;

                if (!rewardProduct) {
                    missingRewards.push(
                        rewardItem.product_title || `Produk #${rewardItem.product_id}`
                    );
                    continue;
                }

                const success = await addProductToCart(rewardProduct, {
                    qty: qtyToAdd,
                    rewardPromoMeta: {
                        rule_name: ruleName,
                        reward_label:
                            rewardItem.product_title || rewardProduct.title,
                    },
                });

                if (success) {
                    addedCount += qtyToAdd;
                    existingRewardQuantities[rewardProductId] =
                        currentQty + qtyToAdd;
                    addedRewardProductIds.push(Number(rewardProduct.id));
                }
            }

            if (addedCount > 0) {
                setRecentRewardProductIds((current) => [
                    ...new Set([...addedRewardProductIds, ...current]),
                ]);
                toast.success(`Item bonus berhasil ditambahkan ke keranjang.`);
            }

            if (missingRewards.length > 0) {
                toast.error(
                    `Bonus belum bisa ditambahkan: ${missingRewards.join(", ")}`
                );
            }
        },
        [addProductToCart, checkoutModalStep, isSubmitting, localCarts, productsById]
    );

    const collectActiveBuyGetRules = useCallback((cartItems = localCarts) => {
        const seenRuleNames = new Set();
        const rules = [];
        const productCandidates = [
            ...Object.values(productsById || {}),
            ...cartItems
                .map((item) => item?.product)
                .filter(Boolean),
        ];

        for (const product of productCandidates) {
            const rule = product?.pricing_badge?.pricing_rule;

            if (!rule || rule.kind !== "buy_x_get_y") {
                continue;
            }

            const ruleName = rule?.name || rule?.label || promoBadgeSummary(rule).title;

            if (!ruleName || seenRuleNames.has(ruleName)) {
                continue;
            }

            seenRuleNames.add(ruleName);
            rules.push(rule);
        }

        return rules;
    }, [localCarts, productsById]);

    const syncRewardProducts = useCallback(async (cartItems = localCarts) => {
        if (isRewardSyncingRef.current) {
            return;
        }

        const rules = collectActiveBuyGetRules(cartItems);
        if (rules.length === 0) {
            return;
        }

        const operations = [];

        for (const rule of rules) {
            const buyItems = Array.isArray(rule?.buy_items) ? rule.buy_items : [];
            const rewardItems = Array.isArray(rule?.get_items)
                ? rule.get_items
                : [];
            const ruleName =
                rule?.name || rule?.label || promoBadgeSummary(rule).title || "Promo";

            if (buyItems.length === 0 || rewardItems.length === 0) {
                continue;
            }

            const buyCartQuantities = cartItems.reduce((accumulator, item) => {
                if (item.promo_reward_meta) {
                    return accumulator;
                }

                const productId = Number(item.product_id || 0);
                accumulator[productId] =
                    (accumulator[productId] || 0) + Number(item.qty || 0);

                return accumulator;
            }, {});

            const completedCycles = buyItems.reduce((currentMin, buyItem) => {
                const productId = Number(buyItem.product_id || 0);
                const requiredQty = Math.max(1, Number(buyItem.quantity || 1));
                const currentQty = Number(buyCartQuantities[productId] || 0);
                const nextCycles = Math.floor(currentQty / requiredQty);

                return currentMin === null
                    ? nextCycles
                    : Math.min(currentMin, nextCycles);
            }, null);

            for (const rewardItem of rewardItems) {
                const rewardProductId = Number(rewardItem.product_id || 0);
                const desiredQty =
                    Math.max(0, Number(completedCycles || 0)) *
                    Math.max(1, Number(rewardItem.quantity || 1));
                const rewardRows = cartItems
                    .filter(
                        (item) =>
                            item.promo_reward_meta?.rule_name === ruleName &&
                            Number(item.product_id || 0) === rewardProductId
                    )
                    .sort((left, right) => Number(right.qty || 0) - Number(left.qty || 0));
                const currentQty = rewardRows.reduce(
                    (sum, item) => sum + Number(item.qty || 0),
                    0
                );

                if (currentQty < desiredQty) {
                    operations.push({
                        type: "add",
                        rule,
                        productId: rewardProductId,
                        qty: desiredQty - currentQty,
                        rewardLabel:
                            rewardItem.product_title ||
                            productsById[rewardProductId]?.title ||
                            "Item bonus",
                    });
                    continue;
                }

                if (currentQty <= desiredQty) {
                    continue;
                }

                let excessQty = currentQty - desiredQty;

                for (const rewardRow of rewardRows) {
                    const rowQty = Number(rewardRow.qty || 0);

                    if (excessQty <= 0) {
                        break;
                    }

                    if (rowQty <= excessQty) {
                        operations.push({
                            type: "remove",
                            cartId: rewardRow.id,
                        });
                        excessQty -= rowQty;
                        continue;
                    }

                    operations.push({
                        type: "update",
                        cartId: rewardRow.id,
                        qty: rowQty - excessQty,
                    });
                    excessQty = 0;
                }
            }
        }

        if (operations.length === 0) {
            return;
        }

        isRewardSyncingRef.current = true;
        setPendingCartMutations((count) => count + 1);

        try {
            for (const operation of operations) {
                if (operation.type === "add") {
                    const rewardProduct =
                        productsById[operation.productId] ||
                        cartItems.find(
                            (item) =>
                                Number(item.product_id || 0) === operation.productId
                        )?.product ||
                        null;

                    if (!rewardProduct) {
                        continue;
                    }

                    await addProductToCart(rewardProduct, {
                        qty: operation.qty,
                        rewardPromoMeta: {
                            rule_name:
                                operation.rule?.name ||
                                operation.rule?.label ||
                                promoBadgeSummary(operation.rule).title ||
                                "Promo",
                            reward_label: operation.rewardLabel,
                        },
                    });

                    continue;
                }

                if (operation.type === "remove") {
                    setLocalCarts((currentCarts) =>
                        currentCarts.filter((item) => item.id !== operation.cartId)
                    );

                    if (!isOfflineMode) {
                        await axios.delete(route("transactions.destroyCart", operation.cartId));
                    }

                    continue;
                }

                if (operation.type === "update" && operation.qty >= 1) {
                    setLocalCarts((currentCarts) =>
                        currentCarts.map((item) =>
                            item.id === operation.cartId
                                ? {
                                      ...item,
                                      qty: operation.qty,
                                      price:
                                          Number(item.product?.sell_price || 0) *
                                          operation.qty,
                                  }
                                : item
                        )
                    );

                    if (!isOfflineMode) {
                        const response = await axios.patch(
                            route("transactions.updateCart", operation.cartId),
                            { qty: operation.qty }
                        );
                        const serverCart = response.data?.data?.cart;

                        if (serverCart) {
                            setLocalCarts((currentCarts) =>
                                currentCarts.map((item) =>
                                    item.id === operation.cartId ? serverCart : item
                                )
                            );
                        }
                    }
                }
            }

            setCartSyncVersion((version) => version + 1);
        } catch (error) {
            if (error?.response) {
                toast.error(
                    error?.response?.data?.message ||
                        "Sinkronisasi bonus promo gagal."
                );
            }
        } finally {
            setPendingCartMutations((count) => Math.max(0, count - 1));
            isRewardSyncingRef.current = false;
        }
    }, [
        addProductToCart,
        collectActiveBuyGetRules,
        isOfflineMode,
        localCarts,
        productsById,
        scheduleCartReconcile,
    ]);

    const handleAddAllMissingRewards = useCallback(async () => {
        if (checkoutModalStep === "preview" || isSubmitting) {
            return;
        }

        if (unmetRewardWarnings.length === 0) {
            return;
        }

        setIsAddingMissingRewards(true);

        try {
            for (const warning of unmetRewardWarnings) {
                await handleAddRewardProducts(warning.rule);
            }

            setCheckoutWarning(
                "Item bonus sedang ditambahkan ke keranjang. Periksa ulang preview setelah proses selesai."
            );
        } finally {
            setIsAddingMissingRewards(false);
        }
    }, [checkoutModalStep, handleAddRewardProducts, isSubmitting, unmetRewardWarnings]);

    // Handle add product to cart
    const handleAddToCart = useCallback(
        async (product) => {
            if (checkoutModalStep === "preview" || isSubmitting) {
                return;
            }

            openProductSelection(product);
        },
        [checkoutModalStep, isSubmitting, openProductSelection]
    );

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

    const closeModifierModal = useCallback(() => {
        if (isModifierModalSubmitting) {
            return;
        }

        setModifierModalProduct(null);
        setModifierModalCartTargetId(null);
        setModifierModalQuantity(1);
        setModifierModalNotes("");
        setIsModifierPromoDetailOpen(false);
        setSelectedModifierOptionIds([]);
    }, [isModifierModalSubmitting]);

    const openCartModifierModal = useCallback((item) => {
        if (checkoutModalStep === "preview" || isSubmitting) {
            return;
        }

        if (
            !item?.id ||
            !item?.product?.supports_modifiers ||
            !Array.isArray(item?.product?.modifier_options) ||
            item.product.modifier_options.length === 0
        ) {
            return;
        }

        const activeOptionIds = (item.modifiers || [])
            .map((modifier) =>
                item.product.modifier_options.find(
                    (option) =>
                        option.name === modifier.name &&
                        Number(option.price || 0) ===
                            Number(modifier.unit_price || 0)
                )?.id
            )
            .filter(Boolean);

        setModifierModalProduct(item.product);
        setModifierModalCartTargetId(item.id);
        setModifierModalQuantity(Math.max(1, Number(item.qty || 1)));
        setModifierModalNotes(item.notes || "");
        setIsModifierPromoDetailOpen(false);
        setSelectedModifierOptionIds(activeOptionIds);
    }, [checkoutModalStep, isSubmitting]);

    const submitModifierModal = useCallback(
        async (includeModifiers) => {
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

            const selectedModifiers = includeModifiers
                ? modifierOptions.filter((option) =>
                      selectedOptionIdSet.has(Number(option.id || 0))
                  )
                : [];
            const normalizedNotes = modifierModalNotes.trim() || null;

            setIsModifierModalSubmitting(true);

            try {
                let success = false;

                if (isOfflineMode && modifierModalCartTargetId) {
                    const selectedModifierMap = new Map(
                        selectedModifiers.map((option) => [
                            `${option.name}:${Number(option.price || 0)}`,
                            {
                                id: `${modifierModalCartTargetId}-${option.id}`,
                                name: option.name,
                                qty: 1,
                                unit_price: Math.max(
                                    0,
                                    Number(option.price || 0)
                                ),
                                total_price: Math.max(
                                    0,
                                    Number(option.price || 0)
                                ),
                            },
                        ])
                    );

                    setLocalCarts((currentCarts) =>
                        currentCarts.map((item) =>
                            item.id === modifierModalCartTargetId
                                ? {
                                      ...item,
                                      notes: normalizedNotes,
                                      modifiers: Array.from(
                                          selectedModifierMap.values()
                                      ),
                                  }
                                : item
                        )
                    );

                    success = true;
                } else

                if (modifierModalCartTargetId) {
                    const response = await axios.put(
                        route(
                            "transactions.syncCartModifiers",
                            modifierModalCartTargetId
                        ),
                        {
                            notes: normalizedNotes,
                            modifiers: selectedModifiers.map((option) => ({
                                name: option.name,
                                qty: 1,
                                unit_price: Math.max(
                                    0,
                                    Number(option.price || 0)
                                ),
                                base_price: Math.max(0, Number(option.base_price || 0)),
                                markup_price: Math.max(0, Number(option.markup_price || 0)),
                            })),
                        }
                    );

                    let updatedCart = response.data?.data?.cart || null;
                    if (updatedCart) {
                        setLocalCarts((currentCarts) =>
                            currentCarts.map((item) =>
                                item.id === modifierModalCartTargetId
                                    ? updatedCart
                                    : item
                            )
                        );
                        setCartSyncVersion((version) => version + 1);
                    }

                    success = true;
                } else {
                    success = await addProductToCart(modifierModalProduct, {
                        qty: modifierModalQuantity,
                        modifiers: selectedModifiers,
                        notes: normalizedNotes,
                    });

                    if (success) {
                        await handleAddRewardProducts(
                            modifierModalProduct?.pricing_badge?.pricing_rule ||
                                null,
                            {
                                buyAdjustments: [
                                    {
                                        product_id:
                                            modifierModalProduct?.id,
                                        qty: modifierModalQuantity,
                                    },
                                ],
                            }
                        );
                    }
                }

                if (success) {
                    setModifierModalProduct(null);
                    setModifierModalCartTargetId(null);
                    setModifierModalQuantity(1);
                    setModifierModalNotes("");
                    setIsModifierPromoDetailOpen(false);
                    setSelectedModifierOptionIds([]);
                }
            } catch (error) {
                toast.error(
                    error?.response?.data?.message ||
                        "Gagal menyimpan topping item"
                );
            } finally {
                setIsModifierModalSubmitting(false);
            }
        },
        [
            addProductToCart,
            handleAddRewardProducts,
            isOfflineMode,
            localCarts,
            modifierModalCartTargetId,
            modifierModalNotes,
            modifierModalProduct,
            modifierModalQuantity,
            selectedModifierOptionIds,
        ]
    );

    // Handle update cart quantity
    const [updatingCartId, setUpdatingCartId] = useState(null);
    const [updatingTenantCartId, setUpdatingTenantCartId] = useState(null);

    const handleUpdateQty = (cartId, newQty) => {
        if (newQty < 1) return;
        if (isSubmitting) return;

        if (isOfflineMode) {
            const nextCarts = localCarts.map((item) =>
                    item.id === cartId
                        ? {
                              ...item,
                              qty: newQty,
                          }
                        : item
            );
            setLocalCarts(nextCarts);
            window.setTimeout(() => {
                syncRewardProducts(nextCarts);
            }, 0);
            return;
        }

        setUpdatingCartId(cartId);
        setPendingCartMutations((count) => count + 1);
        const previousCarts = localCarts;

        const nextCarts = localCarts.map((item) =>
                item.id === cartId
                    ? {
                          ...item,
                          qty: newQty,
                          price:
                              Number(
                                  item.product?.sell_price ||
                                      item.product?.pricing_badge
                                          ?.promo_price ||
                                      0
                              ) * newQty,
                      }
                    : item
        );
        setLocalCarts(nextCarts);

        const requestChain =
            checkoutModalStep === "preview"
                ? releaseCheckoutReservationSilently()
                : Promise.resolve();

        requestChain
            .then(() =>
                axios.patch(route("transactions.updateCart", cartId), {
                    qty: newQty,
                })
            )
            .then((response) => {
                const serverCart = response.data?.data?.cart;

                if (serverCart) {
                    const syncedCarts = nextCarts.map((item) =>
                        item.id === cartId ? serverCart : item
                    );
                    setLocalCarts(syncedCarts);
                    window.setTimeout(() => {
                        syncRewardProducts(syncedCarts);
                    }, 0);
                } else {
                    window.setTimeout(() => {
                        syncRewardProducts(nextCarts);
                    }, 0);
                }

                setCartSyncVersion((version) => version + 1);
            })
            .catch((error) => {
                if (!error?.response) {
                    setIsServerReachable(false);
                    toast("Perubahan qty disimpan lokal karena server tidak merespons.", {
                        duration: 4000,
                        icon: "📴",
                    });
                    return;
                }

                setLocalCarts(previousCarts);
                toast.error(
                    error?.response?.data?.message || "Gagal update quantity"
                );
            })
            .finally(() => {
                setPendingCartMutations((count) => Math.max(0, count - 1));
                setUpdatingCartId(null);
            });
    };

    const handleUpdateTenantOutlet = (cartId, tenantOutletId) => {
        if (checkoutModalStep === "preview" || isSubmitting) {
            return;
        }

        if (!tenantOutletId) return;

        if (isOfflineMode) {
            setLocalCarts((currentCarts) =>
                currentCarts.map((item) =>
                    item.id === cartId
                        ? {
                              ...item,
                              tenant_outlet_id: Number(tenantOutletId),
                          }
                        : item
                )
            );
            toast.success("Tenant item diperbarui (offline)");
            return;
        }

        setUpdatingTenantCartId(cartId);

        axios
            .patch(route("transactions.updateCartTenant", cartId), {
                tenant_outlet_id: Number(tenantOutletId),
            })
            .then(() => {
                toast.success("Tenant item diperbarui");
                router.reload({
                    only: ["carts", "initialPricingPreview"],
                    preserveScroll: true,
                    preserveState: true,
                });
            })
            .catch((error) => {
                toast.error(
                    error?.response?.data?.errors?.tenant_outlet_id?.[0] ||
                        error?.response?.data?.message ||
                        "Gagal mengubah tenant item"
                );
            })
            .finally(() => {
                setUpdatingTenantCartId(null);
            });
    };

    const handleLocalCartNotesChange = useCallback((cartId, notes) => {
        if (checkoutModalStep === "preview" || isSubmitting) {
            return;
        }

        setLocalCarts((currentCarts) =>
            currentCarts.map((item) =>
                item.id === cartId
                    ? {
                          ...item,
                          notes,
                      }
                    : item
            )
        );
    }, [checkoutModalStep, isSubmitting]);

    const handleSaveCartNotes = useCallback(
        (cartId, notes) => {
            if (checkoutModalStep === "preview" || isSubmitting) {
                return;
            }

            if (!cartId) {
                return;
            }

            if (isOfflineMode || String(cartId).startsWith("temp-")) {
                return;
            }

            const previousCarts = localCarts;
            const normalizedNotes = notes?.trim() || "";

            setSavingNoteCartId(cartId);

            axios
                .patch(route("transactions.updateCartNotes", cartId), {
                    notes: normalizedNotes || null,
                })
                .then((response) => {
                    const serverCart = response.data?.data?.cart;

                    if (serverCart) {
                        setLocalCarts((currentCarts) =>
                            currentCarts.map((item) =>
                                item.id === cartId ? serverCart : item
                            )
                        );
                    }
                })
                .catch((error) => {
                    setLocalCarts(previousCarts);
                    toast.error(
                        error?.response?.data?.message ||
                            "Gagal menyimpan catatan item"
                    );
                })
                .finally(() => {
                    setSavingNoteCartId(null);
                });
        },
        [checkoutModalStep, isOfflineMode, isSubmitting, localCarts]
    );

    const handleRemoveModifier = useCallback((cartId, modifierId) => {
        if (checkoutModalStep === "preview" || isSubmitting) {
            return;
        }

        if (isOfflineMode) {
            setLocalCarts((currentCarts) =>
                currentCarts.map((item) =>
                    item.id === cartId
                        ? {
                              ...item,
                              modifiers: (item.modifiers || []).filter(
                                  (modifier) => modifier.id !== modifierId
                              ),
                          }
                        : item
                )
            );
            return;
        }

        setSavingModifierCartId(cartId);

        axios
            .delete(
                route("transactions.destroyCartModifier", {
                    cart_id: cartId,
                    modifier: modifierId,
                })
            )
            .then((response) => {
                const serverCart = response.data?.data?.cart;

                if (serverCart) {
                    setLocalCarts((currentCarts) =>
                        currentCarts.map((item) =>
                            item.id === cartId ? serverCart : item
                        )
                    );
                    setCartSyncVersion((version) => version + 1);
                }
            })
            .catch((error) => {
                toast.error(
                    error?.response?.data?.message ||
                        "Gagal menghapus tambahan item"
                );
            })
            .finally(() => {
                setSavingModifierCartId(null);
            });
    }, [checkoutModalStep, isOfflineMode, isSubmitting]);

    // Handle numpad confirm for cash input
    const handleNumpadConfirm = useCallback((value) => {
        setCashInput(String(value));
    }, []);

    // Handle hold transaction
    const [isHolding, setIsHolding] = useState(false);

    const handleHoldCart = async (label = null) => {
        if (localCarts.length === 0) {
            toast.error("Keranjang kosong");
            return;
        }

        if (isOfflineMode) {
            toast.error("Tahan transaksi tidak tersedia saat offline");
            return;
        }

        setIsHolding(true);

        router.post(
            route("transactions.hold"),
            { label },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Transaksi ditahan");
                    setIsHolding(false);
                },
                onError: (errors) => {
                    toast.error(errors?.message || "Gagal menahan transaksi");
                    setIsHolding(false);
                },
            }
        );
    };

    const resetTransactionForm = useCallback(() => {
        setLocalCarts([]);
        setPricingPreview({
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
        });
        setRedeemPointsInput("");
        setCashInput("");
        setSelectedCustomer(WALK_IN_CUSTOMER);
        setOrderType("dine_in");
        setSelectedTableId("");
        setOrderReferenceName("");
        setDraftOrderReferenceName("");
        setSelectedBankAccount(null);
        setSelectedVoucherId("");
        setPaymentMethod(defaultPaymentGateway ?? "cash");
        setPayLater(false);
        setDueDate("");
    }, [defaultPaymentGateway]);

    const validateTransactionSubmission = useCallback(() => {
        if (pendingCartMutations > 0) {
            toast("Perubahan keranjang masih disinkronkan. Coba lagi sesaat.", {
                icon: "⏳",
                duration: 2500,
                id: "pos-cart-sync-pending",
            });
            return false;
        }

        if (localCarts.length === 0) {
            toast.error("Keranjang masih kosong");
            return false;
        }

        if (hasCartStockIssue) {
            const firstIssue = cartStockIssues[0];
            toast.error(
                `${firstIssue.productTitle} melebihi stok. Qty di keranjang ${firstIssue.qty}, stok tersedia ${firstIssue.availableStock}.`
            );
            return false;
        }

        if (isOfflineMode) {
            if (payLater) {
                toast.error("Nota barang tidak tersedia saat offline");
                return false;
            }

            if (paymentMethod !== "cash") {
                toast.error("Saat offline hanya transaksi tunai yang diizinkan");
                return false;
            }

            if (selectedVoucherId || Number(redeemPointsInput || 0) > 0) {
                toast.error("Voucher dan redeem poin tidak tersedia saat offline");
                return false;
            }
        }

        if (payLater && selectedCustomer?.is_walk_in) {
            toast.error("Nota barang wajib memakai pelanggan terdaftar");
            return false;
        }

        if (payLater && !dueDate) {
            toast.error("Isi tanggal jatuh tempo untuk nota barang");
            return false;
        }

        if (!payLater && isCashPayment && cash < payable) {
            toast.error("Jumlah pembayaran kurang dari total");
            return false;
        }

        if (orderType === "dine_in" && !selectedTableId) {
            toast.error("Pilih meja untuk transaksi dine in");
            return false;
        }

        if (paymentMethod === "bank_transfer" && !selectedBankAccount) {
            toast.error("Pilih rekening bank tujuan");
            return false;
        }

        return true;
    }, [
        cash,
        dueDate,
        isCashPayment,
        isOfflineMode,
        localCarts.length,
        orderType,
        payLater,
        payable,
        paymentMethod,
        pendingCartMutations,
        redeemPointsInput,
        selectedBankAccount,
        hasCartStockIssue,
        cartStockIssues,
        selectedCustomer?.is_walk_in,
        selectedTableId,
        selectedVoucherId,
    ]);

    const buildTransactionPayload = useCallback(
        () => ({
            customer_id: selectedCustomer?.is_walk_in
                ? null
                : selectedCustomer?.id ?? null,
            order_type: orderType,
            order_reference_name: String(
                orderReferenceName ||
                    (selectedCustomer?.is_walk_in
                        ? ""
                        : selectedCustomer?.name || "")
            ).trim(),
            table_id:
                orderType === "dine_in" && selectedTableId
                    ? Number(selectedTableId)
                    : null,
            discount,
            redeem_points: Number(redeemPointsInput || 0),
            customer_voucher_id: selectedVoucherId || null,
            shipping_cost: shipping,
            grand_total: payable,
            cash: isCashPayment ? cash : payable,
            change: isCashPayment ? Math.max(cash - payable, 0) : 0,
            payment_gateway: payLater ? null : isCashPayment ? null : paymentMethod,
            bank_account_id:
                paymentMethod === "bank_transfer"
                    ? selectedBankAccount?.id
                    : null,
            reward_cart_meta: localCarts
                .filter((item) => item.promo_reward_meta)
                .map((item) => ({
                    cart_id: String(item.id),
                    rule_name: item.promo_reward_meta?.rule_name || null,
                    reward_label: item.promo_reward_meta?.reward_label || null,
                })),
            cart_snapshot: localCarts.map((item) => ({
                cart_id: String(item.id),
                product_id: Number(item.product_id || 0),
                tenant_outlet_id: item.tenant_outlet_id
                    ? Number(item.tenant_outlet_id)
                    : null,
                qty: Number(item.qty || 0),
                price: Number(item.price || 0),
                notes: item.notes || null,
                promo_reward_rule_name:
                    item.promo_reward_meta?.rule_name || null,
                promo_reward_label:
                    item.promo_reward_meta?.reward_label || null,
                modifiers: (item.modifiers || []).map((modifier) => ({
                    product_modifier_option_id: Number(
                        modifier.product_modifier_option_id || 0
                    ),
                    name: modifier.name,
                    qty: Number(modifier.qty || 1),
                    unit_price: Number(modifier.unit_price || 0),
                    base_price: Number(
                        modifier.base_price ?? modifier.unit_price ?? 0
                    ),
                    markup_price: Number(modifier.markup_price || 0),
                })),
            })),
            pay_later: payLater,
            due_date: dueDate,
        }),
        [
            cash,
            dueDate,
            isCashPayment,
            localCarts,
            orderType,
            orderReferenceName,
            payLater,
            payable,
            paymentMethod,
            redeemPointsInput,
            selectedBankAccount,
            selectedCustomer?.id,
            selectedCustomer?.is_walk_in,
            selectedTableId,
            selectedVoucherId,
        ]
    );

    const releaseCheckoutReservationSilently = useCallback(async () => {
        try {
            await axios.post(route("transactions.checkout-release"));
        } catch {
            // Ignore release failures; backend also releases on cart mutations.
        } finally {
            setCheckoutModalStep(null);
            setCheckoutWarning("");
            setIsReceiptFrameReady(false);
        }
    }, []);

    const openCheckoutPreview = useCallback(async () => {
        if (isPreparingCheckoutPreview) {
            return;
        }

        if (!validateTransactionSubmission()) {
            return;
        }

        try {
            setIsPreparingCheckoutPreview(true);

            if (!isOfflineMode) {
                const activeCartResponse = await axios.get(
                    route("transactions.active-cart"),
                    {
                        headers: {
                            Accept: "application/json",
                        },
                        timeout: 10000,
                    }
                );
                const serverCarts = Array.isArray(
                    activeCartResponse.data?.data?.carts
                )
                    ? activeCartResponse.data.data.carts
                    : [];
                const localSignature =
                    buildCartConsistencySignature(localCarts);
                const serverSignature =
                    buildCartConsistencySignature(serverCarts);

                if (serverCarts.length === 0) {
                    setLocalCarts([]);
                    setCartSyncVersion((version) => version + 1);
                    toast.error(
                        "Keranjang di server sudah kosong. Tambahkan item lagi sebelum checkout."
                    );
                    return;
                }

                if (localSignature !== serverSignature) {
                    setLocalCarts(serverCarts);
                    setCartSyncVersion((version) => version + 1);
                    toast.error(
                        "Keranjang berubah di server. Data keranjang disinkronkan dulu, periksa lagi sebelum checkout."
                    );
                    return;
                }
            }

            await axios.post(route("transactions.checkout-reserve"));
        } catch (error) {
            if (!isOfflineMode && error?.response?.status === 422) {
                try {
                    const activeCartResponse = await axios.get(
                        route("transactions.active-cart"),
                        {
                            headers: {
                                Accept: "application/json",
                            },
                            timeout: 10000,
                        }
                    );
                    const serverCarts = Array.isArray(
                        activeCartResponse.data?.data?.carts
                    )
                        ? activeCartResponse.data.data.carts
                        : [];
                    const localSignature =
                        buildCartConsistencySignature(localCarts);
                    const serverSignature =
                        buildCartConsistencySignature(serverCarts);

                    if (localSignature !== serverSignature) {
                        setLocalCarts(serverCarts);
                        setCartSyncVersion((version) => version + 1);
                    }
                } catch {
                    // Keep the original checkout error message if resync fails.
                }
            }

            toast.error(
                formatApiErrorMessage(
                    error,
                    "Stok gagal dikunci untuk checkout"
                )
            );
            return;
        } finally {
            setIsPreparingCheckoutPreview(false);
        }

        if (unmetRewardWarnings.length > 0) {
            setCheckoutWarning(
                unmetRewardWarnings
                    .map(
                        (warning) =>
                            `${warning.ruleName}: bonus ${warning.missingRewards} belum ada di keranjang.`
                    )
                    .join(" ")
            );
        } else {
            setCheckoutWarning("");
        }
        setCompletedTransaction(null);
        setIsReceiptFrameReady(false);
        setCheckoutModalStep("preview");
    }, [
        isOfflineMode,
        isPreparingCheckoutPreview,
        localCarts,
        router,
        unmetRewardWarnings,
        validateTransactionSubmission,
    ]);

    const closeCheckoutModal = useCallback(() => {
        if (isSubmitting) {
            return;
        }

        if (checkoutModalStep === "preview") {
            void releaseCheckoutReservationSilently();
            setCompletedTransaction(null);
            return;
        }

        setCheckoutModalStep(null);
        setCompletedTransaction(null);
        setCheckoutWarning("");
        setIsReceiptFrameReady(false);
    }, [checkoutModalStep, isSubmitting, releaseCheckoutReservationSilently]);

    const openReceiptDocument = useCallback((url) => {
        if (!url) {
            return false;
        }

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.click();

        return true;
    }, []);

    const refreshPosData = useCallback(() => {
        router.reload({
            only: [
                "products",
                "carts",
                "initialPricingPreview",
                "pendingTableOrders",
                "activeCashierShift",
                "shiftSummary",
                "outletOpenShift",
                "lowStockNotifications",
            ],
            preserveScroll: true,
            preserveState: true,
        });
    }, []);

    const openOfflineReceiptPrint = useCallback((receiptSource = null) => {
        const source = receiptSource || completedTransaction;

        if (!source?.is_offline_pending && !source?.offline_reference) {
            return false;
        }

        const receiptWindow = window.open("", "_blank", "noopener");

        if (!receiptWindow) {
            return false;
        }

        const invoiceNumber =
            source?.transaction?.invoice ||
            source?.offline_reference ||
            "Draft Offline";
        const createdAt = source?.transaction?.created_at || source?.created_at;
        const cashierName =
            source?.cashier_name || auth?.user?.name || "Kasir";
        const customerName = source?.customer_name || "Pelanggan Umum";
        const details = source?.details || [];
        const totalAmount =
            source?.transaction?.grand_total || source?.grand_total || 0;
        const cashAmount = source?.cash || 0;
        const changeAmount = source?.change || 0;

        const lines = details
            .map((item) => {
                const modifierLines = (item.modifiers || [])
                    .map(
                        (modifier) =>
                            `+ ${modifier.name} ${formatPrice(
                                modifier.total_price || 0
                            )}`
                    )
                    .join("<br />");

                return `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;gap:8px;">
                            <span>${item.qty}x ${item.product_title || item.title || "Produk"}</span>
                            <span>${formatPrice(item.price || 0)}</span>
                        </div>
                        ${modifierLines ? `<div style="font-size:11px;color:#475569;margin-top:4px;">${modifierLines}</div>` : ""}
                    </div>
                `;
            })
            .join("");

        receiptWindow.document.write(`
            <html>
                <head>
                    <title>${completedTransaction.transaction.invoice}</title>
                    <style>
                        body { font-family: monospace; padding: 16px; color: #0f172a; }
                        .receipt { width: 280px; margin: 0 auto; }
                        .divider { border-top: 1px dashed #94a3b8; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="receipt">
                        <div style="text-align:center;font-weight:bold;margin-bottom:8px;">
                            ${storeProfile?.name || "GTC KASIR"}
                        </div>
                        <div>No: ${invoiceNumber}</div>
                        <div>Tgl: ${createdAt ? new Date(createdAt).toLocaleString("id-ID") : "-"}</div>
                        <div>Kasir: ${cashierName}</div>
                        <div>Pelanggan: ${customerName}</div>
                        ${source?.table_label ? `<div>Meja: ${source.table_label}</div>` : ""}
                        <div class="divider"></div>
                        ${lines}
                        <div class="divider"></div>
                        <div style="display:flex;justify-content:space-between;"><span>Total</span><strong>${formatPrice(totalAmount)}</strong></div>
                        <div style="display:flex;justify-content:space-between;"><span>Tunai</span><strong>${formatPrice(cashAmount)}</strong></div>
                        <div style="display:flex;justify-content:space-between;"><span>Kembalian</span><strong>${formatPrice(changeAmount)}</strong></div>
                        <div class="divider"></div>
                        <div style="font-size:11px;color:#475569;">
                            Draft offline. Akan disinkronkan otomatis saat koneksi kembali normal.
                        </div>
                    </div>
                </body>
            </html>
        `);
        receiptWindow.document.close();
        receiptWindow.focus();
        receiptWindow.print();

        return true;
    }, [auth?.user?.name, completedTransaction, storeProfile?.name]);

    const handlePrintOfflineQueueItem = useCallback(
        (offlineTransaction) => {
            const opened = openOfflineReceiptPrint(offlineTransaction);

            if (!opened) {
                toast.error("Gagal membuka draft cetak offline");
            }
        },
        [openOfflineReceiptPrint]
    );

    const handlePrintReceipt = useCallback(() => {
        if (completedTransaction?.is_offline_pending) {
            const opened = openOfflineReceiptPrint();

            if (!opened) {
                toast.error("Gagal membuka draft cetak offline");
                return;
            }

            closeCheckoutModal();
            return;
        }

        const receiptPrintUrl = completedTransaction?.receipt_print_url;

        if (!receiptPrintUrl) {
            toast.error("Halaman cetak struk belum siap");
            return;
        }

        const opened = openReceiptDocument(receiptPrintUrl);

        if (!opened) {
            toast.error("Gagal membuka halaman cetak");
            return;
        }

        closeCheckoutModal();
    }, [
        closeCheckoutModal,
        completedTransaction,
        openOfflineReceiptPrint,
        openReceiptDocument,
    ]);

    const handleOpenReceiptPdf = useCallback(() => {
        const receiptPdfUrl = completedTransaction?.receipt_pdf_url;

        if (!receiptPdfUrl) {
            toast.error("PDF struk belum siap");
            return;
        }

        const opened = openReceiptDocument(receiptPdfUrl);

        if (!opened) {
            toast.error("Gagal membuka PDF struk");
            return;
        }

        closeCheckoutModal();
    }, [closeCheckoutModal, completedTransaction, openReceiptDocument]);

    const handlePrintSyncedReceipt = useCallback(
        (historyItem) => {
            const receiptUrl =
                historyItem?.receipt_print_url || historyItem?.receipt_pdf_url;

            if (!receiptUrl) {
                toast.error("Struk server untuk transaksi ini belum tersedia");
                return;
            }

            const opened = openReceiptDocument(receiptUrl);

            if (!opened) {
                toast.error("Gagal membuka struk server");
            }
        },
        [openReceiptDocument]
    );

    const closeHistoryModal = useCallback(() => {
        if (isConfirmingHistoryPayment) {
            return;
        }

        setIsHistoryModalOpen(false);
    }, [isConfirmingHistoryPayment]);

    const openThermalPreview = useCallback((transaction) => {
        if (!transaction) return;
        setIsThermalPreviewOpen(true);
    }, []);

    const updateHistoryFilter = useCallback((field, value) => {
        setHistoryFilters((current) => ({
            ...current,
            [field]: value,
            page: field === "page" ? value : 1,
        }));
    }, []);

    const resetHistoryFilters = useCallback(() => {
        setHistoryFilters({
            q: "",
            start_date: "",
            end_date: "",
            customer_scope: "",
            payment_status: "",
            payment_method: "",
            per_page: 10,
            page: 1,
        });
    }, []);

    const handleConfirmHistoryPayment = useCallback((transactionId) => {
        if (!transactionId) {
            return;
        }

        setIsConfirmingHistoryPayment(true);

        router.patch(
            route("transactions.confirm-payment", transactionId),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    playPaymentSuccessSound();
                },
                onFinish: () => {
                    setIsConfirmingHistoryPayment(false);
                },
            }
        );
    }, [playPaymentSuccessSound]);

    const handleOpenHistoryReceipt = useCallback((invoice) => {
        if (!invoice) {
            return;
        }

        const opened = openReceiptDocument(route("transactions.print", invoice));

        if (!opened) {
            toast.error("Gagal membuka halaman cetak");
        }
    }, [openReceiptDocument]);

    const handleRequeueHistoryReceipt = useCallback(async (transactionId) => {
        if (!transactionId) {
            return;
        }

        setIsRequeueingHistoryReceipt(true);

        try {
            const response = await axios.post(
                route("transactions.requeue-receipt", transactionId)
            );

            toast.success(
                response.data?.message ||
                    "Struk berhasil dimasukkan ke antrean print."
            );
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Gagal memasukkan struk ke antrean print."
            );
        } finally {
            setIsRequeueingHistoryReceipt(false);
        }
    }, []);

    const buildOfflineTransactionPayload = useCallback(() => {
        const offlineReference = buildOfflineInvoice();
        const normalizedItems = localCarts.map((item) => {
            const pricingItem = pricingItemsByCartId[item.id];
            const resolvedLine = resolveCartPricingLine(item, pricingItem);
            const modifiers = (item.modifiers || []).map((modifier) => ({
                product_modifier_option_id: Number(
                    modifier.product_modifier_option_id || 0
                ),
                name: modifier.name,
                qty: Number(modifier.qty || 1),
                unit_price: Number(modifier.unit_price || 0),
                base_price: Number(
                    modifier.base_price ?? modifier.unit_price ?? 0
                ),
                markup_price: Number(modifier.markup_price || 0),
                total_price: Number(
                    modifier.total_price ||
                        Number(modifier.unit_price || 0) *
                            Number(modifier.qty || 1)
                ),
            }));
            const modifierTotal = modifiers.reduce(
                (sum, modifier) => sum + Number(modifier.total_price || 0),
                0
            );
            const lineTotal = Number(
                pricingItem?.line_total ??
                    resolvedLine.effectiveUnitPrice * Number(item.qty || 1) +
                        modifierTotal
            );

            return {
                product_id: item.product_id,
                product_title: item.product?.title || "Produk",
                tenant_outlet_id: item.tenant_outlet_id || null,
                qty: Number(item.qty || 1),
                base_unit_price: resolvedLine.baseUnitPrice,
                unit_price: resolvedLine.effectiveUnitPrice,
                price: lineTotal,
                notes: item.notes || null,
                discount_total: resolvedLine.discountTotal,
                pricing_rule_name:
                    pricingItem?.pricing_rule?.name ||
                    pricingItem?.pricing_rule?.label ||
                    null,
                pricing_rule_kind: pricingItem?.pricing_rule?.kind || null,
                pricing_group_key: pricingItem?.pricing_group_key || null,
                pricing_group_label:
                    pricingItem?.pricing_group_label ||
                    pricingItem?.pricing_rule?.label ||
                    null,
                is_promo_reward: Boolean(item.promo_reward_meta),
                promo_reward_rule_name:
                    item.promo_reward_meta?.rule_name || null,
                promo_reward_label:
                    item.promo_reward_meta?.reward_label || null,
                modifiers,
            };
        });

        const payload = {
            offline_reference: offlineReference,
            status: "pending",
            sync_attempts: 0,
            last_error: null,
            last_attempt_at: null,
            customer_id: selectedCustomer?.is_walk_in
                ? null
                : selectedCustomer?.id ?? null,
            customer_name: selectedCustomer?.name || "Pelanggan Umum",
            order_type: orderType,
            order_reference_name: String(
                orderReferenceName ||
                    (selectedCustomer?.is_walk_in
                        ? ""
                        : selectedCustomer?.name || "")
            ).trim(),
            table_id:
                orderType === "dine_in" && selectedTableId
                    ? Number(selectedTableId)
                    : null,
            table_label: selectedDiningTable
                ? selectedDiningTable.code
                    ? `${selectedDiningTable.code} - ${selectedDiningTable.name}`
                    : selectedDiningTable.name
                : null,
            cash: Number(cash),
            change: Math.max(0, Number(cash) - Number(payable)),
            shipping_cost: 0,
            grand_total: Number(payable),
            created_at: new Date().toISOString(),
            outlet_id: activeOutlet?.id ?? null,
            outlet_name: activeOutlet?.name || storeProfile?.name || "GTC KASIR",
            cashier_name: auth?.user?.name || "Kasir",
            details: normalizedItems,
        };

        return {
            ...payload,
            offline_signature: buildOfflineTransactionSignature(payload),
        };
    }, [
        activeOutlet?.id,
        activeOutlet?.name,
        auth?.user?.name,
        cash,
        localCarts,
        orderType,
        orderReferenceName,
        payable,
        pricingItemsByCartId,
        selectedCustomer?.id,
        selectedCustomer?.is_walk_in,
        selectedCustomer?.name,
        selectedDiningTable,
        selectedTableId,
        storeProfile?.name,
    ]);

    const syncOfflineQueue = useCallback(async () => {
        if (
            offlineSyncInFlightRef.current ||
            isSyncingOfflineQueue ||
            offlineQueue.length === 0 ||
            isOfflineMode
        ) {
            return;
        }

        offlineSyncInFlightRef.current = true;
        setIsSyncingOfflineQueue(true);
        const currentQueue = [...offlineQueue];
        const remainingQueue = [];
        const historyEntries = [...offlineHistory];
        let syncedCount = 0;
        let lockRejected = false;

        try {
            for (let index = 0; index < currentQueue.length; index += 1) {
                const offlineTransaction = currentQueue[index];

                try {
                    const response = await axios.post(
                        route("transactions.sync-offline"),
                        offlineTransaction,
                        {
                            headers: {
                                Accept: "application/json",
                            },
                            timeout: 15000,
                        }
                    );
                    syncedCount += 1;
                    historyEntries.unshift({
                        offline_reference: offlineTransaction.offline_reference,
                        status: "synced",
                        customer_name: offlineTransaction.customer_name,
                        grand_total: offlineTransaction.grand_total,
                        synced_at: new Date().toISOString(),
                        server_invoice:
                            response.data?.data?.transaction?.invoice || null,
                        receipt_print_url:
                            response.data?.data?.receipt_print_url || null,
                        receipt_pdf_url:
                            response.data?.data?.receipt_pdf_url || null,
                        last_error: null,
                    });
                } catch (error) {
                    if (error?.response?.status === 429) {
                        lockRejected = true;
                        remainingQueue.push(
                            {
                                ...offlineTransaction,
                                status: "pending",
                                last_error:
                                    error?.response?.data?.message ||
                                    "Sinkronisasi lain masih berjalan",
                            },
                            ...currentQueue.slice(index + 1)
                        );
                        break;
                    }

                    const failedItem = {
                        ...offlineTransaction,
                        status:
                            error?.response?.status === 422 ? "failed" : "pending",
                        sync_attempts:
                            Number(offlineTransaction.sync_attempts || 0) + 1,
                        last_attempt_at: new Date().toISOString(),
                        last_error:
                            error?.response?.data?.message ||
                            "Server belum merespons",
                    };

                    remainingQueue.push(failedItem);

                    if (error?.response?.status === 422) {
                        toast.error(
                            formatApiErrorMessage(
                                error,
                                `Sync offline gagal untuk ${offlineTransaction.offline_reference}`
                            )
                        );
                    }
                }
            }
        } finally {
            saveOfflineTransactionQueue(remainingQueue);
            saveOfflineTransactionHistory(historyEntries);
            setOfflineQueue(remainingQueue);
            setOfflineHistory(historyEntries);
            setIsSyncingOfflineQueue(false);
            offlineSyncInFlightRef.current = false;
        }

        if (syncedCount > 0) {
            setIsOfflineHistoryOpen(true);
            toast.success(
                `${syncedCount} transaksi offline berhasil disinkronkan`
            );
        }

        if (lockRejected) {
            return;
        }
    }, [isSyncingOfflineQueue, offlineHistory, offlineQueue, isOfflineMode]);

    const retrySingleOfflineTransaction = useCallback(
        async (offlineReference) => {
            if (
                isOfflineMode ||
                isSyncingOfflineQueue ||
                offlineSyncInFlightRef.current
            ) {
                return;
            }

            const offlineTransaction = offlineQueue.find(
                (item) => item.offline_reference === offlineReference
            );

            if (!offlineTransaction) {
                toast.error("Antrean offline tidak ditemukan");
                return;
            }

            offlineSyncInFlightRef.current = true;
            setIsSyncingOfflineQueue(true);

            try {
                const response = await axios.post(
                    route("transactions.sync-offline"),
                    offlineTransaction,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                        timeout: 15000,
                    }
                );

                const nextQueue = offlineQueue.filter(
                    (item) => item.offline_reference !== offlineReference
                );
                const nextHistory = [
                    {
                        offline_reference: offlineTransaction.offline_reference,
                        status: "synced",
                        customer_name: offlineTransaction.customer_name,
                        grand_total: offlineTransaction.grand_total,
                        synced_at: new Date().toISOString(),
                        server_invoice:
                            response.data?.data?.transaction?.invoice || null,
                        receipt_print_url:
                            response.data?.data?.receipt_print_url || null,
                        receipt_pdf_url:
                            response.data?.data?.receipt_pdf_url || null,
                        last_error: null,
                    },
                    ...offlineHistory,
                ];

                setOfflineQueue(nextQueue);
                setOfflineHistory(nextHistory);
                saveOfflineTransactionQueue(nextQueue);
                saveOfflineTransactionHistory(nextHistory);
                toast.success(
                    `${offlineTransaction.offline_reference} berhasil disinkronkan`
                );
            } catch (error) {
                if (error?.response?.status === 429) {
                    return;
                }

                const nextQueue = offlineQueue.map((item) =>
                    item.offline_reference === offlineReference
                        ? {
                              ...item,
                              status:
                                  error?.response?.status === 422
                                      ? "failed"
                                      : "pending",
                              sync_attempts:
                                  Number(item.sync_attempts || 0) + 1,
                              last_attempt_at: new Date().toISOString(),
                              last_error:
                                  error?.response?.data?.message ||
                                  "Server belum merespons",
                          }
                        : item
                );

                setOfflineQueue(nextQueue);
                saveOfflineTransactionQueue(nextQueue);
                toast.error(
                    formatApiErrorMessage(
                        error,
                        "Sinkronisasi transaksi offline gagal"
                    )
                );
            } finally {
                setIsSyncingOfflineQueue(false);
                offlineSyncInFlightRef.current = false;
            }
        },
        [isOfflineMode, isSyncingOfflineQueue, offlineHistory, offlineQueue]
    );

    const removeOfflineQueueItem = useCallback((offlineReference) => {
        const queueItem = offlineQueue.find(
            (item) => item.offline_reference === offlineReference
        );

        if (!queueItem) {
            return;
        }

        const confirmed = window.confirm(
            `Hapus antrean lokal ${offlineReference}? Transaksi ini tidak akan ikut sinkron otomatis.`
        );

        if (!confirmed) {
            return;
        }

        const nextQueue = offlineQueue.filter(
            (item) => item.offline_reference !== offlineReference
        );

        setOfflineQueue(nextQueue);
        saveOfflineTransactionQueue(nextQueue);
        toast.success(`${offlineReference} dihapus dari antrean offline`);
    }, [offlineQueue]);

    useEffect(() => {
        if (!isOfflineMode && offlineQueue.length > 0) {
            syncOfflineQueue();
        }
    }, [isOfflineMode, offlineQueue.length, syncOfflineQueue]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if user is typing in an input
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
                return;

            switch (e.key) {
                case "/":
                case "F5":
                    e.preventDefault();
                    // Focus search input
                    if (searchInputRef.current) {
                        searchInputRef.current.focus();
                    }
                    break;
                case "F1":
                    e.preventDefault();
                    setNumpadOpen(true);
                    break;
                case "F2":
                    e.preventDefault();
                    if (localCarts.length > 0 && !isPreparingCheckoutPreview) {
                        openCheckoutPreview();
                    }
                    break;
                case "F3":
                    e.preventDefault();
                    setMobileView(
                        mobileView === "products" ? "cart" : "products"
                    );
                    break;
                case "F4":
                    e.preventDefault();
                    setShowShortcuts(!showShortcuts);
                    break;
                case "Escape":
                    setNumpadOpen(false);
                    setShowShortcuts(false);
                    setSearchQuery("");
                    closeCheckoutModal();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        closeCheckoutModal,
        localCarts.length,
        mobileView,
        openCheckoutPreview,
        showShortcuts,
    ]);

    // Handle remove from cart
    const handleRemoveFromCart = (cartId) => {
        if (isSubmitting) {
            return;
        }

        if (isOfflineMode) {
            const nextCarts = localCarts.filter((item) => item.id !== cartId);
            setLocalCarts(nextCarts);
            window.setTimeout(() => {
                syncRewardProducts(nextCarts);
            }, 0);
            return;
        }

        setRemovingItemId(cartId);
        setPendingCartMutations((count) => count + 1);
        const previousCarts = localCarts;

        const nextCarts = localCarts.filter((item) => item.id !== cartId);
        setLocalCarts(nextCarts);

        const requestChain =
            checkoutModalStep === "preview"
                ? releaseCheckoutReservationSilently()
                : Promise.resolve();

        requestChain
            .then(() => axios.delete(route("transactions.destroyCart", cartId)))
            .then(() => {
                window.setTimeout(() => {
                    syncRewardProducts(nextCarts);
                }, 0);
                setCartSyncVersion((version) => version + 1);
                toast.success("Item dihapus dari keranjang");
            })
            .catch((error) => {
                if (!error?.response) {
                    setIsServerReachable(false);
                    toast("Server tidak merespons. Item dihapus dari keranjang lokal.", {
                        duration: 4000,
                        icon: "📴",
                    });
                    return;
                }

                if (error?.response?.status === 404) {
                    window.setTimeout(() => {
                        syncRewardProducts(nextCarts);
                    }, 0);
                    setCartSyncVersion((version) => version + 1);
                    scheduleCartReconcile(180);
                    toast.success("Item sudah tidak ada di server dan dibersihkan dari keranjang");
                    return;
                }

                setLocalCarts(previousCarts);
                toast.error(
                    error?.response?.data?.message || "Gagal menghapus item"
                );
            })
            .finally(() => {
                setPendingCartMutations((count) => Math.max(0, count - 1));
                setRemovingItemId(null);
            });
    };

    // Handle submit transaction
    const handleSubmitTransaction = async () => {
        if (!validateTransactionSubmission()) {
            return;
        }

        if (paymentMethod === "qris" && !payLater) {
            const result = await confirmQrisPayment();

            if (!result.isConfirmed) {
                return;
            }
        }

        if (paymentMethod === "cash" && !payLater) {
            const result = await confirmCashPayment({
                total: payable,
                paid: cash,
            });

            if (!result.isConfirmed) {
                return;
            }
        }

        setIsSubmitting(true);

        if (isOfflineMode) {
            try {
                const offlinePayload = buildOfflineTransactionPayload();
                const duplicateQueueItem = offlineQueue.find(
                    (item) =>
                        item.offline_signature &&
                        item.offline_signature ===
                            offlinePayload.offline_signature &&
                        item.status !== "synced"
                );

                if (duplicateQueueItem) {
                    toast.error(
                        "Transaksi offline yang sama sudah ada di antrean sinkronisasi."
                    );
                    setIsSubmitting(false);
                    return;
                }
                const nextQueue = [...offlineQueue, offlinePayload];

                saveOfflineTransactionQueue(nextQueue);
                setOfflineQueue(nextQueue);
                setCompletedTransaction({
                    transaction: {
                        invoice: offlinePayload.offline_reference,
                        grand_total: offlinePayload.grand_total,
                        payment_method: "cash",
                        payment_status: "paid",
                        created_at: offlinePayload.created_at,
                    },
                    customer_name: offlinePayload.customer_name,
                    table_label: offlinePayload.table_label,
                    cash: offlinePayload.cash,
                    change: offlinePayload.change,
                    details: offlinePayload.details,
                    offline_reference: offlinePayload.offline_reference,
                    is_offline_pending: true,
                });
                setCheckoutWarning(
                    "Transaksi disimpan offline. Sinkronisasi otomatis akan berjalan saat server kembali normal."
                );
                setCheckoutModalStep("receipt");
                resetTransactionForm();
                toast.success("Transaksi tunai disimpan offline");
                playPaymentSuccessSound();
                setMobileView("products");
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        try {
            if (pendingCartMutations > 0) {
                toast.error(
                    "Perubahan keranjang masih diproses. Tunggu sebentar lalu konfirmasi lagi."
                );
                setIsSubmitting(false);
                return;
            }

            const activeCartResponse = await axios.get(
                route("transactions.active-cart"),
                {
                    headers: {
                        Accept: "application/json",
                    },
                    timeout: 10000,
                }
            );
            const serverCarts = Array.isArray(activeCartResponse.data?.data?.carts)
                ? activeCartResponse.data.data.carts
                : [];
            const localSignature = buildCartConsistencySignature(localCarts);
            const serverSignature = buildCartConsistencySignature(serverCarts);

            if (localSignature !== serverSignature) {
                setLocalCarts(serverCarts);
                setCartSyncVersion((version) => version + 1);
                toast.error(
                    "Keranjang berubah di server. Data keranjang disinkronkan dulu, periksa lagi sebelum submit."
                );
                setIsSubmitting(false);
                return;
            }

            const response = await axios.post(
                route("transactions.store"),
                buildTransactionPayload(),
                {
                    headers: {
                        Accept: "application/json",
                    },
                    timeout: 25000,
                }
            );

            const receiptData = response.data?.data || null;
            const usedReservedStock = Boolean(
                response.data?.meta?.used_reserved_stock
            );
            setCompletedTransaction(receiptData);
            setCheckoutWarning(
                response.data?.warning ||
                    (usedReservedStock
                        ? "Stok checkout sudah dikunci dan transaksi berhasil diteruskan ke dapur."
                        : "")
            );
            setCheckoutModalStep(null);
            setIsReceiptFrameReady(false);
            resetTransactionForm();
            refreshPosData();
            toast.success("Transaksi berhasil! Struk masuk antrian cetak.");
            playPaymentSuccessSound();
            setMobileView("products");
        } catch (error) {
            if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
                toast.error("Koneksi timeout. Cek koneksi internet dan coba lagi.");
            } else if (!error?.response) {
                toast.error("Tidak dapat terhubung ke server. Cek koneksi internet.");
            } else {
                toast.error(formatApiErrorMessage(error, "Gagal menyimpan transaksi"));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Map tenant ID → jam operasional { open_time, close_time } untuk label "Belum Buka"
    const tenantHoursMap = useMemo(
        () => Object.fromEntries(
            tenantOutlets.map((t) => [Number(t.id), { open_time: t.open_time || null, close_time: t.close_time || null }])
        ),
        [tenantOutlets]
    );

    // Filter products including out of stock
    const allProducts = useMemo(() => {
        const base = shouldUseRemoteProductSearch
            ? remoteProducts
            : catalogProducts.filter((product) => {
                  const matchesCategory =
                      normalizedSelectedCategory === null ||
                      Number(product.category_id) === normalizedSelectedCategory;
                  const matchesSearch =
                      !normalizedSearchQuery ||
                      product.title
                          .toLowerCase()
                          .includes(normalizedSearchQuery.toLowerCase()) ||
                      product.barcode
                          ?.toLowerCase()
                          .includes(normalizedSearchQuery.toLowerCase());
                  return matchesCategory && matchesSearch;
              });

        // Inject tenant_store_hours so ProductGrid can show hours in "Belum Buka" label
        return base.map((product) => {
            const tenantId = product.tenant_outlet?.id ?? product.tenant_outlet_id ?? null;
            if (!tenantId) return product;
            const hours = tenantHoursMap[Number(tenantId)] ?? null;
            if (!hours) return product;
            return { ...product, tenant_store_hours: hours };
        });
    }, [
        normalizedSearchQuery,
        normalizedSelectedCategory,
        catalogProducts,
        remoteProducts,
        shouldUseRemoteProductSearch,
        tenantHoursMap,
    ]);

    // Permanently closed gate — outlet.is_active = false
    const outletIsPermanentlyClosed = operationalSettings !== null && operationalSettings?.outlet_is_active === false;
    if (outletIsPermanentlyClosed) {
        return (
            <>
                <Head title="Outlet Tidak Beroperasi" />
                <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
                    <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <IconX size={28} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Outlet tidak beroperasi
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Outlet ini dinonaktifkan secara permanen. POS tidak bisa digunakan. Hubungi pengelola untuk mengaktifkan kembali.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <a
                                href={route("settings.kitchen-devices.index")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Aktifkan outlet di pengaturan
                            </a>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Store hours gate — block POS when outlet is manually marked closed
    const storeIsOpen = operationalSettings === null || operationalSettings?.is_open !== false;
    if (!storeIsOpen) {
        const openTime = operationalSettings?.open_time || "08:00";
        const closeTime = operationalSettings?.close_time || "22:00";
        const notes = operationalSettings?.notes || "";
        return (
            <>
                <Head title="Toko Tutup" />
                <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
                    <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                            <IconX size={28} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Toko sedang tutup
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Outlet ini ditandai tutup hari ini oleh pengelola. POS tidak bisa digunakan sampai outlet dibuka kembali.
                        </p>
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="grid gap-2 text-sm">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 dark:text-slate-400">Jam buka</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{openTime}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 dark:text-slate-400">Jam tutup</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{closeTime}</span>
                                </div>
                                {notes && (
                                    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <a
                                href={route("settings.kitchen-devices.index")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Ubah pengaturan operasional
                            </a>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (!activeCashierShift) {
        return (
            <>
                <Head title="Buka Shift Kasir" />

                <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
                    <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <IconWallet size={28} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {outletOpenShift
                                ? "Shift drawer outlet sudah aktif"
                                : "Shift kasir belum dibuka"}
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {outletOpenShift
                                ? "Kasir lain sudah membuka drawer di outlet ini. Gabung ke shift aktif agar transaksi dan keranjang Anda bisa diproses."
                                : "Buka shift terlebih dulu untuk mengaktifkan transaksi, keranjang, dan cash closing."}
                        </p>

                        {outletOpenShift && (
                            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                    Shift aktif: {outletOpenShift.user?.name || "-"}
                                </p>
                                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                                    Modal awal {formatPrice(outletOpenShift.opening_cash)} • Expected cash {formatPrice(outletOpenShift.expected_cash)}
                                </p>
                                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                                    Operator: {(outletOpenShift.operators || []).map((operator) => operator.name).join(", ") || "-"}
                                </p>
                            </div>
                        )}

                        {!outletOpenShift && (
                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Modal Awal
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={openingCashInput}
                                        onChange={(event) => setOpeningCashInput(event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="0"
                                    />
                                    {openingCashHelper && !errors?.opening_cash && (
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Nilai terbaca: <span className="font-semibold text-slate-700 dark:text-slate-200">{openingCashHelper}</span>
                                        </p>
                                    )}
                                    {errors?.opening_cash && (
                                        <p className="mt-2 text-xs text-rose-500">{errors.opening_cash}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Catatan
                                    </label>
                                    <input
                                        type="text"
                                        value={shiftNotesInput}
                                        onChange={(event) => setShiftNotesInput(event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="Opsional"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            {outletOpenShift ? (
                                <button
                                    type="button"
                                    onClick={handleJoinShift}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                                >
                                    <IconWallet size={18} />
                                    <span>Gabung Shift Aktif</span>
                                </button>
                            ) : canOpenShift && (
                                <button
                                    type="button"
                                    onClick={handleOpenShift}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                                >
                                    <IconWallet size={18} />
                                    <span>Buka Shift Sekarang</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => router.visit(route("cashier-shifts.index"))}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span>Lihat Histori Shift</span>
                            </button>
                        </div>
                        {errors?.shift && (
                            <p className="mt-3 text-xs text-rose-500">{errors.shift}</p>
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Transaksi" />

            <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
                <div className="grid grid-cols-3 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => setMobileView("products")}
                        className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                            mobileView === "products"
                                ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-300"
                                : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                        <IconShoppingCart size={18} />
                        <span>Produk</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (localCarts.length === 0) {
                                toast("Keranjang masih kosong, tambahkan produk terlebih dahulu", {
                                    icon: "🛒",
                                    duration: 2000,
                                });
                                setMobileView("products");
                                return;
                            }
                            if (mobileView !== "cart") {
                                playCartTabSound();
                            }
                            setMobileView("cart");
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                            mobileView === "cart"
                                ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-300"
                                : "text-slate-500 dark:text-slate-400"
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
                                ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-300"
                                : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                        <IconCash size={18} />
                        <span className="truncate">Info Pembayaran</span>
                    </button>
                </div>

                {(isOfflineMode || offlineQueueCount > 0) && (
                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 lg:px-4 lg:py-3 max-h-[40vh] overflow-y-auto">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-xs sm:text-sm">
                                    {offlineModeReason.label}
                                </p>
                                {isOfflineBannerExpanded && (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                    {offlineModeReason.detail}
                                </p>
                                )}
                                {isOfflineBannerExpanded && (
                                <>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                    <span
                                        className={`rounded-full px-2.5 py-1 font-semibold ${
                                            isPreparingOfflineSnapshot ||
                                            isCheckingOfflineDevice
                                                ? "bg-white text-amber-700 dark:bg-slate-900 dark:text-amber-300"
                                                : isOfflineDeviceReady
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                : "bg-white text-amber-700 dark:bg-slate-900 dark:text-amber-300"
                                        }`}
                                    >
                                        {isPreparingOfflineSnapshot ||
                                        isCheckingOfflineDevice
                                            ? "Persiapan offline..."
                                            : isOfflineDeviceReady
                                            ? "Siap offline"
                                            : "Belum siap offline"}
                                    </span>
                                    <span className="text-amber-700/90 dark:text-amber-300/90">
                                        {isPreparingOfflineSnapshot
                                            ? "Menyimpan data POS terakhir ke perangkat"
                                            : hasOfflineSnapshot
                                            ? "Snapshot POS tersimpan"
                                            : "Buka halaman ini saat online untuk menyimpan snapshot POS"}
                                    </span>
                                    <span className="text-amber-700/90 dark:text-amber-300/90">
                                        {isCheckingOfflineDevice
                                            ? "Memeriksa service worker"
                                            : offlineDeviceStatus.serviceWorkerReady
                                            ? "Service worker aktif"
                                            : "Service worker belum aktif"}
                                    </span>
                                    {offlineDeviceStatus.likelyTablet && (
                                        <span className="text-amber-700/90 dark:text-amber-300/90">
                                            {offlineDeviceStatus.standalone
                                                ? "Mode tablet/PWA aktif"
                                                : "Tablet terdeteksi, lebih stabil jika dibuka sebagai PWA"}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                    <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold text-amber-800 dark:bg-slate-900/70 dark:text-amber-200">
                                        Persiapan {offlinePreparationProgress}%
                                    </span>
                                    <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold text-amber-800 dark:bg-slate-900/70 dark:text-amber-200">
                                        Snapshot {offlineSnapshotFreshness.label}
                                    </span>
                                    <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold text-amber-800 dark:bg-slate-900/70 dark:text-amber-200">
                                        Perangkat {offlineDeviceCheckFreshness.label}
                                    </span>
                                </div>
                                </>
                                )}
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                {isOfflineBannerExpanded && (
                                <button
                                    type="button"
                                    onClick={refreshOfflinePreparation}
                                    disabled={isRefreshingOfflinePreparation}
                                    className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 disabled:opacity-60 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300"
                                >
                                    {isRefreshingOfflinePreparation
                                        ? "Menyegarkan..."
                                        : "Segarkan"}
                                </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsOfflineBannerExpanded(
                                            (current) => !current
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300"
                                >
                                    {isOfflineBannerExpanded ? (
                                        <>
                                            Ringkas
                                            <IconChevronUp size={14} />
                                        </>
                                    ) : (
                                        <>
                                            Detail
                                            <IconChevronDown size={14} />
                                        </>
                                    )}
                                </button>
                                {offlineQueueCount > 0 && (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-slate-900 dark:text-amber-300">
                                        {offlineQueueCount} antrean
                                        {offlineQueue[0] && (
                                            <> • {offlineQueue[0].customer_name || 'Tunai'} • Rp {(offlineQueue[0].grand_total || 0).toLocaleString('id-ID')}</>
                                        )}
                                    </span>
                                )}
                                {isOfflineBannerExpanded && !isOfflineMode && offlineQueueCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={syncOfflineQueue}
                                        disabled={isSyncingOfflineQueue}
                                        className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                                    >
                                        Sync Sekarang
                                    </button>
                                )}
                                {isOfflineBannerExpanded && (offlineQueueCount > 0 ||
                                    offlineHistory.length > 0) && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsOfflineHistoryOpen(true)
                                        }
                                        className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300"
                                    >
                                        Riwayat Sync
                                    </button>
                                )}
                                {isSyncingOfflineQueue && (
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                        Sinkronisasi...
                                    </span>
                                )}
                            </div>
                        </div>

                        {isOfflineBannerExpanded && (
                            <div className="mt-3 rounded-2xl border border-amber-200/70 bg-white/70 px-3 py-3 dark:border-amber-900/30 dark:bg-slate-900/60">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                        Persiapan Offline
                                    </p>
                                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                                        {offlinePreparationProgress}%
                                    </span>
                                </div>
                                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-950/40">
                                    <div
                                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                                        style={{
                                            width: `${offlinePreparationProgress}%`,
                                        }}
                                    />
                                </div>
                                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-amber-800/90 dark:text-amber-200/90">
                                    <span className="inline-flex items-center gap-2">
                                        <span>
                                            Snapshot:{" "}
                                            {formattedOfflineSnapshotAt || "-"}
                                        </span>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${offlineSnapshotFreshness.className}`}
                                        >
                                            {offlineSnapshotFreshness.label}
                                        </span>
                                    </span>
                                    <span className="inline-flex items-center gap-2">
                                        <span>
                                            Cek perangkat:{" "}
                                            {formattedOfflineDeviceCheckAt || "-"}
                                        </span>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${offlineDeviceCheckFreshness.className}`}
                                        >
                                            {offlineDeviceCheckFreshness.label}
                                        </span>
                                    </span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {offlinePreparationSteps.map((step, index) => (
                                        <div key={step.key} className="relative">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                                        step.status === "ready"
                                                            ? "bg-emerald-500 text-white"
                                                            : step.status ===
                                                              "loading"
                                                            ? "animate-pulse bg-amber-500 text-white"
                                                            : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {index + 1}
                                                </span>
                                                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                                                    {step.label}
                                                </p>
                                            </div>
                                            <p className="mt-1 pl-8 text-[10px] leading-tight text-amber-800/90 dark:text-amber-200/90">
                                                {step.helper}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="min-h-0 flex flex-1 flex-col">
                <div
                    className={`min-h-0 flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden ${
                        mobileView !== "products" ? "hidden" : "flex flex-col"
                    } ${(isOfflineMode || offlineQueueCount > 0)}`}
                >
                        <ProductGrid
                            products={allProducts}
                            tenantOutlets={tenantOutlets}
                            categories={categories}
                            selectedCategory={selectedCategory}
                            onCategoryChange={(categoryId) =>
                                setSelectedCategory(
                                    categoryId === null ? null : Number(categoryId)
                                )
                            }
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            isSearching={isSearching}
                            onAddToCart={handleAddToCart}
                            addingProductId={addingProductId}
                            searchInputRef={searchInputRef}
                            onBarcodeDetected={handleBarcodeScan}
                            hasMoreProducts={
                                !shouldUseRemoteProductSearch &&
                                Boolean(productCatalogMeta?.has_more)
                            }
                            onLoadMoreProducts={loadMoreProducts}
                            isLoadingMoreProducts={isLoadingMoreProducts}
                        />
                    </div>

                    {/* Cart Tab */}
                    <div
                        className={`flex h-full flex-col overflow-hidden bg-white dark:bg-slate-900 ${
                            mobileView !== "cart" ? "hidden" : "flex"
                        } ${(isOfflineMode || offlineQueueCount > 0)}`}
                    >
                        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800 lg:px-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Keranjang
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {isCartSyncing
                                            ? "Item sedang dikirim ke server. Keranjang akan terbarui otomatis."
                                            : "Fokus ke daftar item yang sedang dipesan."}
                                    </p>
                                </div>
                                {isCartSyncing ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                        <IconLoader2
                                            size={12}
                                            className="animate-spin"
                                        />
                                        Menyimpan...
                                    </span>
                                ) : null}
                                {localCarts.length > 0 && (
                                    <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                                        {cartCount} item
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {localCarts.length > 0 && (
                                <div
                                    ref={cartSectionRef}
                                    className="border-b border-slate-200 p-2.5 dark:border-slate-800 lg:p-3"
                                >
                                    <HoldButton
                                        hasItems={localCarts.length > 0}
                                        onHold={handleHoldCart}
                                        isHolding={isHolding}
                                    />
                                </div>
                            )}

                            <div className="p-2.5 dark:border-slate-800 lg:p-3">
                                {localCarts.length > 0 ? (
                                    <div className="space-y-2 pr-1">
                                        {hasCartStockIssue ? (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                                                <p className="font-semibold">
                                                    Ada item yang stoknya berubah
                                                </p>
                                                <p className="mt-1">
                                                    Keranjang tetap disimpan, tetapi qty item yang melebihi stok harus dikurangi sebelum checkout.
                                                </p>
                                            </div>
                                        ) : null}
                                        {localCarts.map((item) => {
                                            const fallbackProduct =
                                                productsById[
                                                    Number(item.product_id || 0)
                                                ] || item.product;
                                            const pricingItem =
                                                pricingItemsByCartId[item.id];
                                            const promoState =
                                                buildCartPromoState({
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
                                                    onOpenModifierModal={
                                                        openCartModifierModal
                                                    }
                                                    onRemoveModifier={
                                                        handleRemoveModifier
                                                    }
                                                    onNotesChange={
                                                        handleLocalCartNotesChange
                                                    }
                                                    onNotesBlur={
                                                        handleSaveCartNotes
                                                    }
                                                    onQtyChange={handleUpdateQty}
                                                    onRemoveItem={
                                                        handleRemoveFromCart
                                                    }
                                                    noteSaving={
                                                        savingNoteCartId ===
                                                        item.id
                                                    }
                                                    modifierSaving={
                                                        savingModifierCartId ===
                                                        item.id
                                                    }
                                                    qtyUpdating={
                                                        updatingCartId ===
                                                        item.id
                                                    }
                                                    itemRemoving={
                                                        removingItemId ===
                                                        item.id
                                                    }
                                                    isLocked={
                                                        checkoutModalStep ===
                                                            "preview" ||
                                                        isSubmitting
                                                    }
                                                    stockIssue={
                                                        cartStockIssues.find(
                                                            (issue) =>
                                                                Number(
                                                                    issue.cartId
                                                                ) ===
                                                                Number(item.id)
                                                        ) || null
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
                                        {isCartSyncing ? (
                                            <>
                                                <IconLoader2
                                                    size={36}
                                                    className="mx-auto mb-3 animate-spin text-primary-500"
                                                />
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                    Menambahkan item ke keranjang...
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                    Permintaan sedang diproses server. Mohon tunggu sebentar.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <IconShoppingCart
                                                    size={36}
                                                    className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
                                                />
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    Keranjang kosong
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                    Tambahkan produk dari tab Produk.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/80">
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={openCustomerInfoModal}
                                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-800 dark:hover:bg-primary-950/20"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Info Pelanggan
                                        </p>
                                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            {isCustomerInfoConfirmed
                                                ? orderReferenceName ||
                                                  selectedCustomer?.name ||
                                                  "Pelanggan Umum"
                                                : "Atur pelanggan dan pesanan"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                            {orderType === "dine_in"
                                                ? selectedDiningTable
                                                    ? `Makan di tempat • ${
                                                          selectedDiningTable.code
                                                              ? `${selectedDiningTable.code} - ${selectedDiningTable.name}`
                                                              : selectedDiningTable.name
                                                      }`
                                                    : "Makan di tempat • meja belum dipilih"
                                                : "Bawa pulang"}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {isCustomerInfoConfirmed
                                            ? "Ubah"
                                            : "Lengkapi"}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={openPaymentInfoTab}
                                    className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
                                        isCustomerInfoConfirmed &&
                                        customerInfoReady &&
                                        !hasCartStockIssue
                                            ? "bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700"
                                            : "bg-slate-400 hover:bg-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600"
                                    }`}
                                >
                                    <span className="flex flex-col items-center text-center">
                                        <span className="block text-sm font-semibold">
                                            Lanjut pembayaran
                                        </span>
                                        <span className="block text-[11px] font-medium text-white/85">
                                            Total bayar {formatPrice(payable)}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Payment Tab */}
                <div
                    className={`flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 ${
                        mobileView !== "payment" ? "hidden" : "flex"
                    } ${(isOfflineMode || offlineQueueCount > 0)}`}
                >
                    <div className="border-b border-slate-200 p-3 dark:border-slate-800 lg:p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    Info Pelanggan
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Data pesanan diambil dari form pelanggan sebelum masuk pembayaran.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openCustomerInfoModal}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                                Ubah
                            </button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    Nama Order
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {orderReferenceName ||
                                        selectedCustomer?.name ||
                                        "-"}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    Jenis Pesanan
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {orderType === "dine_in"
                                        ? "Makan di Tempat"
                                        : "Bawa Pulang"}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    Meja
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {orderType === "dine_in"
                                        ? selectedDiningTable
                                            ? selectedDiningTable.code
                                                ? `${selectedDiningTable.code} - ${selectedDiningTable.name}`
                                                : selectedDiningTable.name
                                            : "Belum dipilih"
                                        : "-"}
                                </p>
                            </div>
                        </div>
                        <div
                            className={`mt-3 rounded-xl px-3 py-3 ${
                                hasLowStockCartWarning
                                    ? "border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                                    : "border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p
                                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                                            hasLowStockCartWarning
                                                ? "text-amber-700 dark:text-amber-300"
                                                : "text-emerald-700 dark:text-emerald-300"
                                        }`}
                                    >
                                        Konfirmasi Dapur
                                    </p>
                                    <p
                                        className={`mt-1 text-xs ${
                                            hasLowStockCartWarning
                                                ? "text-amber-700/80 dark:text-amber-300/80"
                                                : "text-emerald-700/80 dark:text-emerald-300/80"
                                        }`}
                                    >
                                        {hasLowStockCartWarning
                                            ? "Ada item stok tipis di keranjang. Pastikan kasir benar-benar konfirmasi pesanan ke dapur sebelum pembayaran akhir."
                                            : "Keranjang siap dikonfirmasi. Lanjutkan checkout lalu kirim pesanan ke dapur setelah pembayaran dikonfirmasi."}
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                                        hasLowStockCartWarning
                                            ? "bg-white text-amber-700 ring-amber-200 dark:bg-slate-900 dark:text-amber-300 dark:ring-amber-900/40"
                                            : "bg-white text-emerald-700 ring-emerald-200 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-900/40"
                                    }`}
                                >
                                    {hasLowStockCartWarning
                                        ? `${lowStockCartWarnings.length} item stok tipis`
                                        : `${cartCount} item siap diproses`}
                                </span>
                            </div>

                            {hasLowStockCartWarning ? (
                                <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
                                    {lowStockCartWarnings.map((warning) => (
                                        <div
                                            key={warning.productId}
                                            className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-slate-900"
                                        >
                                            <p className="font-semibold text-amber-800 dark:text-amber-200">
                                                {warning.productTitle}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                                                Stok tersisa {warning.availableStock}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
                                    Tidak ada item stok tipis. Keranjang aman untuk dilanjutkan ke checkout dan konfirmasi dapur.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Held Transactions & Alerts */}
                    {heldCarts.length > 0 && (
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <HeldTransactions
                                heldCarts={heldCarts}
                                hasActiveCart={localCarts.length > 0}
                            />
                        </div>
                    )}

                    {/* Summary & Submit - Fixed at bottom, 2 columns */}
                    <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {/* Left Column - Payment Controls */}
                            <div className="space-y-2">
                                {/* Pay later toggle */}
                                <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-800 dark:text-white">
                                            Bayar Belakangan (Nota Barang)
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                            Catat sebagai piutang.
                                        </p>
                                    </div>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={payLater}
                                            onChange={(e) => {
                                                if (isOfflineMode) {
                                                    toast.error(
                                                        "Nota barang tidak tersedia saat offline"
                                                    );
                                                    return;
                                                }

                                                if (
                                                    e.target.checked &&
                                                    selectedCustomer?.is_walk_in
                                                ) {
                                                    toast.error(
                                                        "Pilih pelanggan terdaftar sebelum memakai nota barang"
                                                    );
                                                    setOpenAddCustomerModalSignal(
                                                        (value) => value + 1
                                                    );
                                                    return;
                                                }

                                                setPayLater(e.target.checked);
                                                if (e.target.checked) {
                                                    setSelectedBankAccount(null);
                                                    setPaymentMethod("cash");
                                                }
                                            }}
                                        />
                                        <span
                                            className={`w-11 h-6 flex items-center bg-slate-300 rounded-full p-1 transition ${
                                                payLater ? "bg-primary-500" : ""
                                            }`}
                                        >
                                            <span
                                                className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                                                    payLater ? "translate-x-5" : ""
                                                }`}
                                            />
                                        </span>
                                    </label>
                                </div>

                                {payLater && (
                                    <div>
                                        <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                            Tanggal Jatuh Tempo
                                        </label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        />
                                    </div>
                                )}

                                {/* Payment Method */}
                                <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                                            {activePaymentOption.value === "cash" ? (
                                                <IconCash size={14} />
                                            ) : activePaymentOption.value ===
                                              "bank_transfer" ? (
                                                <IconBuildingBank size={14} />
                                            ) : (
                                                <IconCreditCard size={14} />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Metode Pembayaran
                                            </label>
                                            <div className="relative mt-1">
                                                <select
                                                    value={paymentMethod}
                                                    disabled={payLater}
                                                    onChange={(e) => {
                                                        const nextMethod =
                                                            e.target.value;

                                                        if (
                                                            isOfflineMode &&
                                                            nextMethod !== "cash"
                                                        ) {
                                                            toast.error(
                                                                "Saat offline hanya pembayaran tunai yang tersedia"
                                                            );
                                                            return;
                                                        }

                                                        setPaymentMethod(
                                                            nextMethod
                                                        );

                                                        if (
                                                            nextMethod !==
                                                            "bank_transfer"
                                                        ) {
                                                            setSelectedBankAccount(
                                                                null
                                                            );
                                                        }

                                                        if (
                                                            nextMethod === "cash"
                                                        ) {
                                                            setIsCashPaymentModalOpen(
                                                                true
                                                            );
                                                        }
                                                    }}
                                                    className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-2 pr-8 text-xs font-medium text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                >
                                                    {paymentOptions.map(
                                                        (method) => (
                                                            <option
                                                                key={method.value}
                                                                value={
                                                                    method.value
                                                                }
                                                                disabled={
                                                                    isOfflineMode &&
                                                                    method.value !==
                                                                        "cash"
                                                                }
                                                            >
                                                                {method.label}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                                <IconChevronDown
                                                    size={12}
                                                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                        {payLater
                                            ? "Pembayaran dicatat sebagai nota barang."
                                            : isOfflineMode && activePaymentOption.value !== "cash"
                                            ? "Metode ini butuh koneksi server."
                                            : activePaymentOption.description}
                                    </p>
                                </div>

                                {/* Bank Selector */}
                                {paymentMethod === "bank_transfer" &&
                                    bankAccounts.length > 0 &&
                                    !payLater && (
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                Rekening Tujuan
                                            </label>
                                            <div className="grid grid-cols-1 gap-1">
                                                {bankAccounts.map((bank) => {
                                                    const isActive =
                                                        selectedBankAccount?.id ===
                                                        bank.id;
                                                    return (
                                                        <button
                                                            key={bank.id}
                                                            onClick={() =>
                                                                setSelectedBankAccount(
                                                                    bank
                                                                )
                                                            }
                                                            className={`p-2 rounded-lg border-2 transition-colors flex items-center gap-2 text-left ${
                                                                isActive
                                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                                    : "border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800"
                                                            }`}
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                                {bank.logo_url ? (
                                                                    <img
                                                                        src={
                                                                            bank.logo_url
                                                                        }
                                                                        alt={
                                                                            bank.bank_name
                                                                        }
                                                                        className="max-w-full max-h-full object-contain"
                                                                    />
                                                                ) : (
                                                                    <IconBuildingBank
                                                                        size={14}
                                                                        className="text-slate-500"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                                    {bank.bank_name}
                                                                </p>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                                    {bank.account_number} • a.n. {bank.account_name}
                                                                </p>
                                                            </div>
                                                            {isActive && (
                                                                <IconCheck size={14} className="text-primary-600 shrink-0" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                {/* Cash Payment */}
                                {paymentMethod === "cash" && !payLater && (
                                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-800 dark:text-white">
                                                Pembayaran Tunai
                                            </p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                {cash > 0
                                                    ? `Diterima ${formatPrice(cash)}`
                                                    : "Atur nominal di pop-up"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsCashPaymentModalOpen(true)
                                            }
                                            className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-100 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300"
                                        >
                                            Atur nominal bayar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Promo, Customer Info, Summary & Button */}
                            <div className="flex flex-col">
                                <div className="space-y-1.5">
                                    {promoDiscount > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500">
                                                {PROMO_TOTAL_LABEL}
                                            </span>
                                            <span className="font-medium text-emerald-600">
                                                -{formatPrice(promoDiscount)}
                                            </span>
                                        </div>
                                    )}
                                    {appliedPromoGroups.length > 0 && (
                                        <div className="rounded-lg border border-slate-200 bg-white/70 p-1.5 dark:border-slate-700 dark:bg-slate-900/60">
                                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Promo yang sedang bekerja
                                            </div>
                                            <div className="max-h-16 space-y-0.5 overflow-y-auto pr-1">
                                                {appliedPromoGroups.map((group) => (
                                                    <div
                                                        key={group.key}
                                                        className="flex items-start justify-between gap-2 text-[10px]"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <span className="block break-words text-slate-600 dark:text-slate-300">
                                                                {group.label}
                                                            </span>
                                                        </div>
                                                        <span className="font-medium text-emerald-600 whitespace-nowrap">
                                                            -{formatPrice(group.discount_total)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedCustomer?.is_walk_in && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                                Pelanggan Umum
                                            </p>
                                            <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80">
                                                Poin & voucher tidak berlaku.
                                            </p>
                                        </div>
                                    )}
                                    {selectedCustomer &&
                                        !selectedCustomer?.is_walk_in &&
                                        !selectedCustomer?.is_loyalty_member && (
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/50">
                                                <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                                                    Pelanggan Non-member
                                                </p>
                                                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                                    Upgrade ke member.
                                                </p>
                                            </div>
                                        )}
                                    {selectedCustomer?.is_loyalty_member && (
                                        <div className="rounded-lg border border-primary-200 bg-primary-50 p-1.5 dark:border-primary-900/40 dark:bg-primary-950/20">
                                            <p className="text-[10px] font-semibold text-primary-700 dark:text-primary-300">
                                                Member: {selectedCustomer.loyalty_tier}
                                            </p>
                                            <p className="text-[9px] text-primary-600/80 dark:text-primary-400/80">
                                                Saldo {resolvedPricingPreview?.summary?.available_loyalty_points ?? 0} poin
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 border-t border-dashed border-slate-200 dark:border-slate-700 pt-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Subtotal Dasar</span>
                                        <span className="font-medium">
                                            {formatPrice(baseSubtotal)}
                                        </span>
                                    </div>
                                    {voucherDiscount > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500">Voucher</span>
                                            <span className="text-primary-600">
                                                -{formatPrice(voucherDiscount)}
                                            </span>
                                        </div>
                                    )}
                                    {loyaltyDiscount > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500">Redeem Poin</span>
                                            <span className="text-primary-600">
                                                -{formatPrice(loyaltyDiscount)}
                                            </span>
                                        </div>
                                    )}
                                    {shipping > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500">Ongkir</span>
                                            <span className="font-medium">
                                                +{formatPrice(shipping)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="font-semibold text-sm text-slate-800 dark:text-white">
                                            Total
                                        </span>
                                        <span className="text-base font-bold text-primary-600 dark:text-primary-400">
                                            {formatPrice(payable)}
                                        </span>
                                    </div>

                                    {paymentMethod === "cash" &&
                                        !payLater &&
                                        cash >= payable &&
                                        payable > 0 && (
                                            <div className="flex justify-between items-center mt-1 p-1 rounded bg-success-50 dark:bg-success-950/30 text-xs">
                                                <span className="text-success-700 dark:text-success-400">
                                                    Kembalian
                                                </span>
                                                <span className="font-bold text-success-600">
                                                    {formatPrice(cash - payable)}
                                                </span>
                                            </div>
                                        )}
                                </div>

                                {/* Submit Button */}
                                <div className="sticky bottom-0 z-10 -mx-3 mt-2 border-t border-slate-200 bg-slate-50/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85 dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                !localCarts.length ||
                                                isLoadingPricing ||
                                                isSubmitting ||
                                                isPreparingCheckoutPreview
                                            ) {
                                                return;
                                            }

                                            if (needsCashAdjustment) {
                                                setIsCashPaymentModalOpen(true);
                                                return;
                                            }

                                            openCheckoutPreview();
                                        }}
                                        disabled={
                                            !localCarts.length ||
                                            isLoadingPricing ||
                                            isSubmitting ||
                                            isPreparingCheckoutPreview
                                        }
                                        className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                                            !localCarts.length ||
                                            isLoadingPricing ||
                                            isSubmitting ||
                                            isPreparingCheckoutPreview
                                                ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800"
                                                : needsCashAdjustment
                                                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600"
                                                : "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700"
                                        }`}
                                    >
                                        {isSubmitting ||
                                        isLoadingPricing ||
                                        isPreparingCheckoutPreview ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <IconReceipt size={16} />
                                                <span>
                                                    {!localCarts.length
                                                        ? "Pilih menu dulu"
                                                        : needsCashAdjustment
                                                        ? "Atur nominal bayar"
                                                        : isLoadingPricing
                                                        ? "Menyiapkan total terbaik..."
                                                        : "Lanjutkan pembayaran"}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {checkoutModalStep && (
                <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
                        onClick={closeCheckoutModal}
                    />
                    <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                        {checkoutModalStep === "preview" ? (
                            <>
                                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                        Konfirmasi Transaksi
                                    </p>
                                    <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                        Periksa sebelum kirim transaksi
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Setelah dikonfirmasi, transaksi langsung disimpan, order diteruskan ke dapur, dan resi tampil di modal yang sama.
                                    </p>
                                </div>

                                <div className="overflow-y-auto px-5 py-4">
                                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                        Stok untuk item di konfirmasi transaksi ini sudah dikunci oleh POS kasir. Perubahan stok live dari dapur atau layar lain tidak akan membatalkan checkout ini selama keranjang tidak diubah lagi.
                                    </div>
                                    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Pelanggan
                                            </p>
                                            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                {selectedCustomer?.name ||
                                                    "Pelanggan Umum"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Jenis Pesanan
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                                {orderType === "dine_in"
                                                    ? "Makan di Tempat"
                                                    : "Bawa Pulang"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Pembayaran
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                                {paymentMethodLabel}
                                            </p>
                                            {payLater && dueDate && (
                                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                                                    Jatuh tempo {dueDate}
                                                </p>
                                            )}
                                        </div>
                                        <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-900/40 dark:bg-primary-950/20">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                                Total
                                            </p>
                                            <p className="mt-1 text-xl font-bold text-primary-700 dark:text-primary-300">
                                                {formatPrice(payable)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        Ringkasan Item
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {cartCount} item di keranjang
                                                    </p>
                                                </div>
                                                {selectedDiningTable && (
                                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                        {selectedDiningTable.code
                                                            ? `${selectedDiningTable.code} - ${selectedDiningTable.name}`
                                                            : selectedDiningTable.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="max-h-[44vh] space-y-2 overflow-y-auto px-4 py-4">
                                                {localCarts.map((item) => {
                                                    const pricingItem =
                                                        pricingItemsByCartId[
                                                            item.id
                                                        ];
                                                    const resolvedLine =
                                                        resolveCartPricingLine(
                                                            item,
                                                            pricingItem
                                                        );
                                                    const promoLabel =
                                                        pricingItem?.pricing_rule
                                                            ?.label ||
                                                        pricingItem?.pricing_group_label ||
                                                        pricingItem?.pricing_rule_name;
                                                    const promoDetail =
                                                        pricingItem?.pricing_rule
                                                            ?.detail || null;
                                                    const baseUnitPrice =
                                                        resolvedLine.baseUnitPrice;
                                                    const buyGetBreakdown =
                                                        resolveBuyGetBreakdown(
                                                            {
                                                                rule: pricingItem?.pricing_rule,
                                                                ruleKind:
                                                                    pricingItem?.pricing_rule
                                                                        ?.kind ||
                                                                    null,
                                                                quantity: Number(
                                                                    item.qty || 1
                                                                ),
                                                                baseUnitPrice,
                                                                discountTotal:
                                                                    resolvedLine.discountTotal,
                                                                productId:
                                                                    item.product_id,
                                                            }
                                                        );
                                                    const lineTotal =
                                                        resolvedLine.effectiveLineTotal;

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`rounded-2xl px-4 py-3 transition-all ${
                                                                recentRewardProductIds.includes(
                                                                    Number(
                                                                        item.product_id ||
                                                                            0
                                                                    )
                                                                )
                                                                    ? "bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900/40"
                                                                    : "bg-slate-50 dark:bg-slate-950/40"
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="mt-0.5 inline-flex min-w-[28px] justify-center rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                                            {Number(
                                                                                item.qty
                                                                            )}x
                                                                        </span>
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                                        {
                                                                            item
                                                                                .product
                                                                                ?.title
                                                                        }
                                                                            </p>
                                                                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                                                {buyGetBreakdown ? (
                                                                                    <>
                                                                                        {buyGetBreakdown.payableQty >
                                                                                        0
                                                                                            ? `${buyGetBreakdown.payableQty}x @ ${formatPrice(
                                                                                                  buyGetBreakdown.paidUnitPrice
                                                                                              )}`
                                                                                            : "0 item bayar"}
                                                                                        {` • Bonus ${buyGetBreakdown.bonusQty}x @ ${formatPrice(
                                                                                            0
                                                                                        )}`}
                                                                                        {promoLabel
                                                                                            ? ` • ${promoLabel}`
                                                                                            : ""}
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        @{" "}
                                                                                        {formatPrice(
                                                                                            resolvedLine.effectiveUnitPrice
                                                                                        )}
                                                                                        {promoLabel
                                                                                            ? ` • ${promoLabel}`
                                                                                            : ""}
                                                                                    </>
                                                                                )}
                                                                            </p>
                                                                            {promoDetail ? (
                                                                                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                                                                                    {
                                                                                        promoDetail
                                                                                    }
                                                                                </p>
                                                                            ) : null}
                                                                            {item.promo_reward_meta ? (
                                                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                                        {REWARD_ITEM_LABEL}
                                                                                    </span>
                                                                                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                                                        {item.promo_reward_meta
                                                                                            ?.rule_name ||
                                                                                            "promo aktif"}
                                                                                    </span>
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                                                    {formatPrice(
                                                                        lineTotal
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {(item.modifiers ||
                                                                []).length >
                                                                0 && (
                                                                <div className="mt-2 ml-10 flex flex-wrap gap-2">
                                                                    {item.modifiers.map(
                                                                        (
                                                                            modifier
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    modifier.id
                                                                                }
                                                                                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                                                            >
                                                                                {
                                                                                    modifier.name
                                                                                }
                                                                            </span>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                        <div className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        Subtotal Dasar
                                                    </span>
                                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                                        {formatPrice(baseSubtotal)}
                                                    </span>
                                                </div>
                                                {promoDiscount > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            Promo
                                                        </span>
                                                        <span className="font-medium text-primary-600">
                                                            -{formatPrice(promoDiscount)}
                                                        </span>
                                                    </div>
                                                )}
                                                {voucherDiscount > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            Voucher
                                                        </span>
                                                        <span className="font-medium text-primary-600">
                                                            -{formatPrice(voucherDiscount)}
                                                        </span>
                                                    </div>
                                                )}
                                                {loyaltyDiscount > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            Redeem Poin
                                                        </span>
                                                        <span className="font-medium text-primary-600">
                                                            -{formatPrice(loyaltyDiscount)}
                                                        </span>
                                                    </div>
                                                )}
                                                {shipping > 0 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            Ongkir
                                                        </span>
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                                            +{formatPrice(shipping)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                                                    <span className="font-semibold text-slate-800 dark:text-white">
                                                        Total
                                                    </span>
                                                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                                        {formatPrice(payable)}
                                                    </span>
                                                </div>
                                                {!payLater && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            Dibayar
                                                        </span>
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                                            {formatPrice(
                                                                isCashPayment
                                                                    ? cash
                                                                    : payable
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                                {isCashPayment && cash >= payable && (
                                                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/20">
                                                        <span className="text-emerald-700 dark:text-emerald-300">
                                                            Kembalian
                                                        </span>
                                                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                                            {formatPrice(
                                                                Math.max(
                                                                    0,
                                                                    cash - payable
                                                                )
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                            {paymentMethod ===
                                                "bank_transfer" &&
                                                selectedBankAccount && (
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Rekening Tujuan
                                                    </p>
                                                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                                        {
                                                            selectedBankAccount.bank_name
                                                        }
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {
                                                            selectedBankAccount.account_number
                                                        }
                                                    </p>
                                                </div>
                                            )}

                                            {paymentMethod === "qris" &&
                                                qrisPaymentImageUrl && (
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                                                    <div className="flex items-center gap-2">
                                                        <IconQrcode
                                                            size={18}
                                                            className="text-slate-500 dark:text-slate-300"
                                                        />
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            Konfirmasi QRIS
                                                        </p>
                                                    </div>
                                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                                        Tunjukkan QRIS ini ke pelanggan sebelum transaksi disimpan.
                                                    </p>
                                                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                                        <img
                                                            src={qrisPaymentImageUrl}
                                                            alt="QRIS"
                                                            className="mx-auto h-48 w-48 object-contain"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:grid-cols-[1fr,1.1fr]">
                                    <button
                                        type="button"
                                        onClick={closeCheckoutModal}
                                        disabled={isSubmitting}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        Kembali
                                    </button>
                                    <div className="grid gap-3 sm:grid-cols-[1fr,1.2fr]">
                                        <div className="rounded-2xl bg-white px-4 py-3 text-center dark:bg-slate-900">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Bayar
                                            </p>
                                            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                                {formatPrice(
                                                    isCashPayment
                                                        ? cash
                                                        : payable
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSubmitTransaction}
                                            disabled={isSubmitting}
                                            className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                                        >
                                            {isSubmitting
                                                ? "Menyimpan..."
                                                : "Konfirmasi & Kirim ke Dapur"}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                            Resi Transaksi
                                        </p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                            {completedTransaction?.transaction?.invoice ||
                                                "Preview Struk"}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Resi sudah siap. Cetak langsung dari modal lalu lanjut transaksi berikutnya.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeCheckoutModal}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        <IconX size={18} />
                                    </button>
                                </div>

                                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                                    {checkoutWarning && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                            {checkoutWarning}
                                        </div>
                                    )}
                                    {unmetRewardWarnings.length > 0 && (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                            <p className="font-semibold">
                                                Bonus promo lintas produk belum lengkap
                                            </p>
                                            <div className="mt-2 space-y-1 text-xs">
                                                {unmetRewardWarnings.map((warning) => (
                                                    <p key={warning.ruleId}>
                                                        {warning.ruleName}: tambahkan{" "}
                                                        {warning.missingRewards}.
                                                    </p>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddAllMissingRewards}
                                                disabled={isAddingMissingRewards}
                                                className="mt-3 inline-flex items-center rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-slate-800"
                                            >
                                                {isAddingMissingRewards
                                                    ? "Menambahkan item bonus..."
                                                    : "Tambah semua item bonus sekarang"}
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
                                        <div className="space-y-3">
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Status
                                                </p>
                                                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                                    <IconReceipt size={18} />
                                                    {completedTransaction?.transaction
                                                        ?.payment_method ===
                                                    "pay_later"
                                                        ? "Piutang tercatat"
                                                        : "Transaksi tersimpan"}
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                    Total{" "}
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {formatPrice(
                                                            completedTransaction
                                                                ?.transaction
                                                                ?.grand_total || 0
                                                        )}
                                                    </span>
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-900/40 dark:bg-primary-950/20">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                                    Cetak
                                                </p>
                                                <p className="mt-2 text-sm text-primary-700 dark:text-primary-300">
                                                    {prefersPrintOpenLabel
                                                        ? "Di tablet, struk dibuka dulu di halaman khusus lalu dialog print muncul."
                                                        : "Tombol cetak akan membuka halaman struk khusus lalu langsung memanggil print."}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleOpenReceiptPdf}
                                                    disabled={
                                                        !completedTransaction?.receipt_pdf_url
                                                    }
                                                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60 dark:border-primary-800 dark:bg-slate-900 dark:text-primary-300 dark:hover:bg-slate-800"
                                                >
                                                    <IconReceipt size={16} />
                                                    Buka PDF Struk
                                                </button>
                                            </div>

                                            {completedTransaction?.transaction
                                                ?.payment_url && (
                                                <a
                                                    href={
                                                        completedTransaction.transaction
                                                            .payment_url
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-between rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                                                >
                                                    <span>
                                                        Buka link pembayaran
                                                    </span>
                                                    <IconCreditCard size={18} />
                                                </a>
                                            )}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60">
                                            {completedTransaction?.is_offline_pending ? (
                                                <div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
                                                    <IconReceipt
                                                        size={42}
                                                        className="mb-3 text-amber-500"
                                                    />
                                                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                                                        Draft resi offline siap dicetak
                                                    </p>
                                                    <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                                                        Gunakan tombol cetak untuk mencetak draft lokal. Setelah server kembali normal, transaksi ini akan tersinkron otomatis.
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    {!isReceiptFrameReady && (
                                                        <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                                            Memuat preview struk...
                                                        </div>
                                                    )}
                                                    {completedTransaction?.print_url && (
                                                        <iframe
                                                            ref={receiptFrameRef}
                                                            src={completedTransaction.print_url}
                                                            title="Preview Struk"
                                                            onLoad={() =>
                                                                setIsReceiptFrameReady(
                                                                    true
                                                                )
                                                            }
                                                            className={`h-[60vh] w-full bg-white ${
                                                                isReceiptFrameReady
                                                                    ? "block"
                                                                    : "hidden"
                                                            }`}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:grid-cols-[0.9fr,1.1fr]">
                                    <button
                                        type="button"
                                        onClick={closeCheckoutModal}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        Tutup
                                    </button>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={handleOpenReceiptPdf}
                                            disabled={
                                                !completedTransaction?.receipt_pdf_url
                                            }
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <IconReceipt size={18} />
                                            PDF Struk
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePrintReceipt}
                                            disabled={
                                                !completedTransaction?.receipt_print_url
                                            }
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                                        >
                                            <IconPrinter size={18} />
                                            {prefersPrintOpenLabel
                                                ? "Buka & Cetak Struk"
                                                : "Cetak Struk"}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            </div>

            {tableOrderApprovalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeTableOrderApproval}
                    />
                    <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b8572f]">
                                Pembayaran QR Meja
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                {tableOrderApprovalTarget.order_number}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Meja {tableOrderApprovalTarget.table?.code || tableOrderApprovalTarget.table?.name}
                                {tableOrderApprovalTarget.customer_name
                                    ? ` • ${tableOrderApprovalTarget.customer_name}`
                                    : ""}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                    {tableOrderPaymentStateLabel(tableOrderApprovalTarget)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {tableOrderPaymentMethodLabel(tableOrderApprovalTarget)}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                            Atas Nama
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                            {tableOrderApprovalTarget.customer_name || "Pelanggan"}
                                        </p>
                                        {tableOrderApprovalTarget.customer_phone ? (
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {tableOrderApprovalTarget.customer_phone}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                            Order Dibuat
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                            {tableOrderApprovalTarget.created_at_label || "-"}
                                        </p>
                                    </div>
                                </div>
                                {tableOrderApprovalTarget.notes ? (
                                    <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                                            Catatan order:
                                        </span>{" "}
                                        {tableOrderApprovalTarget.notes}
                                    </div>
                                ) : null}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Preview Order
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {(tableOrderApprovalTarget.items || []).length} item
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {(tableOrderApprovalTarget.items || []).map((item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950/70"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {item.product_title} x{item.qty}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            {formatPrice(item.unit_price)} / porsi
                                                        </span>
                                                        {Number(item.discount_total || 0) > 0 ? (
                                                            <>
                                                                <span className="text-slate-400 line-through dark:text-slate-500">
                                                                    {formatPrice(item.base_unit_price)} / porsi
                                                                </span>
                                                                <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                                                    Hemat {formatPrice(item.discount_total)}
                                                                </span>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                    {hasPromoApplied(item) ? (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                                                {promoTitleText(item)}
                                                            </span>
                                                            {item.pricing_rule_kind ? (
                                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                    {item.pricing_rule_kind}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                    {promoDetailText(item) ? (
                                                        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">
                                                            {promoDetailText(item)}
                                                        </p>
                                                    ) : null}
                                                    {item.modifiers?.length ? (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {item.modifiers.map((modifier) => (
                                                                <span
                                                                    key={modifier.id}
                                                                    className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                                >
                                                                    {modifier.name} x{modifier.qty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                    {item.notes ? (
                                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                            {item.notes}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                                    {formatPrice(item.line_total)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Total order</span>
                                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                                        {formatPrice(tableOrderApprovalTarget.grand_total)}
                                    </span>
                                </div>
                                {tableOrderApprovalTarget.transaction?.invoice ? (
                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Invoice</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                                            {tableOrderApprovalTarget.transaction.invoice}
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            {isTableOrderOnlinePayment(tableOrderApprovalTarget) ? (
                                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                                    <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                                        Pembayaran online dipantau otomatis
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-sky-800 dark:text-sky-200">
                                        Order ini tidak perlu ditagih lagi di kasir. Tunggu webhook atau sinkronisasi status pembayaran dari gateway.
                                    </p>
                                    {tableOrderApprovalTarget.transaction?.payment_url ? (
                                        <a
                                            href={tableOrderApprovalTarget.transaction.payment_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-3 inline-flex items-center justify-center rounded-2xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-slate-950 dark:text-sky-200"
                                        >
                                            Buka Link Pembayaran
                                        </a>
                                    ) : null}
                                </div>
                            ) : (
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Metode Pembayaran
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            {
                                                value: "cash",
                                                label: "Tunai",
                                                description:
                                                    "Pembayaran tunai langsung di kasir.",
                                            },
                                            {
                                                value: "qris",
                                                label: "QRIS",
                                                description:
                                                    "Konfirmasi setelah pembayaran QRIS diterima.",
                                            },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => {
                                                    setTableOrderPaymentMethod(option.value);
                                                    setTableOrderCashInput(
                                                        String(
                                                            tableOrderApprovalTarget.grand_total || 0
                                                        )
                                                    );
                                                }}
                                                className={`rounded-2xl border px-4 py-3 text-left transition ${
                                                    tableOrderPaymentMethod === option.value
                                                        ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-200"
                                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                }`}
                                            >
                                                <p className="text-sm font-semibold">
                                                    {option.label}
                                                </p>
                                                <p className="mt-1 text-xs opacity-80">
                                                    {option.description}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {tableOrderPaymentMethod === "qris" &&
                            !isTableOrderOnlinePayment(tableOrderApprovalTarget) &&
                            qrisPaymentImageUrl ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        QRIS Pembayaran
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Tunjukkan QRIS ini ke pelanggan, lalu lanjutkan hanya setelah pembayaran benar-benar diterima.
                                    </p>
                                    <div className="mt-4 flex justify-center">
                                        <img
                                            src={qrisPaymentImageUrl}
                                            alt="QRIS pembayaran"
                                            className="h-52 w-52 rounded-2xl border border-slate-200 object-contain p-3 dark:border-slate-700"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {!isTableOrderOnlinePayment(tableOrderApprovalTarget) ? (
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                        {tableOrderPaymentMethod === "cash"
                                            ? "Jumlah Bayar Tunai"
                                            : "Nominal Pembayaran"}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={tableOrderCashInput}
                                        onChange={(event) =>
                                            tableOrderPaymentMethod === "cash"
                                                ? setTableOrderCashInput(
                                                      event.target.value.replace(
                                                          /[^\d]/g,
                                                          ""
                                                      )
                                                  )
                                                : undefined
                                        }
                                        placeholder="0"
                                        readOnly={tableOrderPaymentMethod !== "cash"}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                    />
                                </div>
                            ) : null}

                            {tableOrderPaymentMethod === "cash" &&
                            !isTableOrderOnlinePayment(tableOrderApprovalTarget) ? (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            Number(tableOrderApprovalTarget.grand_total || 0),
                                            Math.ceil(Number(tableOrderApprovalTarget.grand_total || 0) / 10000) * 10000,
                                            Math.ceil(Number(tableOrderApprovalTarget.grand_total || 0) / 50000) * 50000,
                                        ]
                                            .filter((value, index, array) => value > 0 && array.indexOf(value) === index)
                                            .map((amount) => (
                                                <button
                                                    key={amount}
                                                    type="button"
                                                    onClick={() => setTableOrderCashInput(String(amount))}
                                                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                                        tableOrderCashAmount === amount
                                                            ? "bg-primary-500 text-white"
                                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {formatPrice(amount)}
                                                </button>
                                            ))}
                                    </div>

                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-emerald-700 dark:text-emerald-300">
                                                Kembalian
                                            </span>
                                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                                {formatPrice(tableOrderChangeAmount)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={() =>
                                    closeTableOrderApproval({
                                        reopenQrList: true,
                                    })
                                }
                                disabled={isApprovingTableOrder}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    closeTableOrderApproval();
                                    openTableOrderCancel(tableOrderApprovalTarget);
                                }}
                                disabled={isApprovingTableOrder}
                                className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                                Batalkan Pesanan
                            </button>
                            <button
                                type="button"
                                onClick={() => openTableOrderEdit(tableOrderApprovalTarget)}
                                disabled={isApprovingTableOrder}
                                className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/30"
                            >
                                Edit Pesanan
                            </button>
                            <button
                                type="button"
                                onClick={submitTableOrderApproval}
                                disabled={
                                    isApprovingTableOrder ||
                                    isTableOrderOnlinePayment(
                                        tableOrderApprovalTarget
                                    ) ||
                                    tableOrderCashAmount <
                                        Number(tableOrderApprovalTarget.grand_total || 0)
                                }
                                className="rounded-2xl bg-[#b8572f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isTableOrderOnlinePayment(tableOrderApprovalTarget)
                                    ? "Menunggu Pembayaran Online"
                                    : isApprovingTableOrder
                                      ? "Memproses..."
                                      : "Approve Pembayaran"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            

            {isEditingTableOrder && tableOrderApprovalTarget && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeTableOrderEdit}
                    />
                    <div className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                                Edit Pesanan
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                {tableOrderApprovalTarget.order_number}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Ubah jumlah item atau hapus item yang tidak jadi dipesan
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-3">
                                {tableOrderEditItems.map((item, index) => (
                                    <div
                                        key={`${item.product_id}-${index}`}
                                        className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/70"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {item.product_title}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {formatPrice(item.unit_price)} / porsi
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeTableOrderItem(index)}
                                                className="rounded-full p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                            >
                                                <IconX size={16} />
                                            </button>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateTableOrderItemQty(index, Math.max(0, item.qty - 1))}
                                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                <IconMinus size={14} />
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.qty}
                                                onChange={(e) => updateTableOrderItemQty(index, Math.max(0, parseInt(e.target.value) || 0))}
                                                className="h-8 w-16 rounded-lg border border-slate-200 bg-white text-center text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateTableOrderItemQty(index, item.qty + 1)}
                                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                <IconPlus size={14} />
                                            </button>
                                            <span className="ml-auto text-sm font-bold text-slate-900 dark:text-white">
                                                {formatPrice(item.line_total)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Total</span>
                                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                                        {formatPrice(tableOrderEditItems.reduce((sum, item) => sum + item.line_total, 0))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={closeTableOrderEdit}
                                disabled={isUpdatingTableOrder}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={submitTableOrderEdit}
                                disabled={isUpdatingTableOrder}
                                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isUpdatingTableOrder
                                    ? "Menyimpan..."
                                    : tableOrderEditItems.some((item) => item.qty > 0)
                                      ? "Simpan Perubahan"
                                      : "Hapus Semua & Batalkan Order"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

{tableOrderCancelTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeTableOrderCancel}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
                                Batalkan Pesanan QR
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                {tableOrderCancelTarget.order_number}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Meja {tableOrderCancelTarget.table?.code || tableOrderCancelTarget.table?.name}
                                {tableOrderCancelTarget.customer_name
                                    ? ` • ${tableOrderCancelTarget.customer_name}`
                                    : ""}
                            </p>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                Order akan dibatalkan dan tidak bisa lagi dibayar dari kasir.
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Alasan pembatalan
                                </label>
                                <textarea
                                    rows={3}
                                    value={tableOrderCancelReason}
                                    onChange={(event) => setTableOrderCancelReason(event.target.value)}
                                    placeholder="Opsional, mis. pelanggan membatalkan order"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={closeTableOrderCancel}
                                disabled={isCancellingTableOrder}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={submitTableOrderCancel}
                                disabled={isCancellingTableOrder}
                                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isCancellingTableOrder ? "Membatalkan..." : "Batalkan Order"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ModifierOptionsModal
                product={modifierModalProduct}
                cartTargetId={modifierModalCartTargetId}
                quantity={modifierModalQuantity}
                notesValue={modifierModalNotes}
                onNotesChange={setModifierModalNotes}
                onQuantityChange={handleModifierModalQuantityChange}
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

            {isCustomerInfoModalOpen && (
                <div className="fixed inset-0 z-[72] flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setIsCustomerInfoModalOpen(false)}
                    />
                    <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                Info Pelanggan
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                Atur pelanggan dan jenis pesanan
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Tab pembayaran baru bisa dibuka setelah data ini lengkap.
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-4 pb-2">
                            <CustomerSelect
                                customers={customers}
                                selected={draftCustomer}
                                onSelect={setDraftCustomer}
                                placeholder="Pilih pelanggan umum atau terdaftar..."
                                error={errors?.customer_id}
                                tierOptions={loyaltyTierOptions}
                                openAddModalSignal={openAddCustomerModalSignal}
                            />

                            <div>
                                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Jenis Pesanan
                                </p>
                                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                                    {[
                                        {
                                            value: "take_away",
                                            label: "Bawa Pulang",
                                        },
                                        {
                                            value: "dine_in",
                                            label: "Makan di Tempat",
                                        },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setDraftOrderType(
                                                    option.value
                                                );
                                                if (
                                                    option.value ===
                                                    "take_away"
                                                ) {
                                                    setDraftSelectedTableId(
                                                        ""
                                                    );
                                                }
                                            }}
                                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                                draftOrderType === option.value
                                                    ? "bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300"
                                                    : "text-slate-600 dark:text-slate-300"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-rose-50 px-4 py-4 shadow-sm dark:border-amber-700/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-rose-950/20">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Nama untuk keterangan order
                                    </label>
                                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                        Wajib
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={draftOrderReferenceName}
                                    onChange={(event) =>
                                        setDraftOrderReferenceName(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Wajib isi nama order, contoh: Diah / Pak Budi / Rina"
                                    className="h-13 w-full rounded-2xl border-2 border-amber-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-amber-200/60 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-amber-900/30"
                                />
                                <p className="mt-3 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                                    Jangan dikosongkan. Catatan item otomatis menjadi{" "}
                                    {draftOrderType === "dine_in"
                                        ? "Meja ... - Nama"
                                        : "Take Away - Nama"}
                                    .
                                </p>
                                {draftCustomer?.is_walk_in && (
                                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                                        Untuk pelanggan umum, kasir harus mengisi nama ini secara manual.
                                    </p>
                                )}
                            </div>

                            {draftOrderType === "dine_in" && (
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Pilih Meja
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTablePickerContext("draft");
                                            setIsTablePickerModalOpen(true);
                                        }}
                                        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 transition hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                Meja
                                            </p>
                                            <p className="truncate font-medium">
                                                {draftSelectedDiningTable
                                                    ? draftSelectedDiningTable.code
                                                        ? `${draftSelectedDiningTable.code} - ${draftSelectedDiningTable.name}`
                                                        : draftSelectedDiningTable.name
                                                    : "Pilih meja"}
                                            </p>
                                        </div>
                                        <span className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                                            Pilih
                                        </span>
                                    </button>
                                    {diningTables.length === 0 ? (
                                        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">
                                            Belum ada meja aktif untuk outlet ini.
                                        </p>
                                    ) : null}
                                    {draftSelectedDiningTable ? (
                                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            Meja terpilih:{" "}
                                            {draftSelectedDiningTable.code
                                                ? `${draftSelectedDiningTable.code} - ${draftSelectedDiningTable.name}`
                                                : draftSelectedDiningTable.name}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <button
                                type="button"
                                onClick={() =>
                                    setIsCustomerInfoModalOpen(false)
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCustomerInfo}
                                className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600"
                            >
                                Simpan info pelanggan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isTablePickerModalOpen &&
                (isDraftTablePicker
                    ? draftOrderType === "dine_in"
                    : orderType === "dine_in") && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setIsTablePickerModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                    Dine In
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    Pilih Meja
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Pilih meja aktif untuk transaksi makan di tempat.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsTablePickerModalOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
                            {diningTables.length > 0 ? (
                                diningTables.map((table) => {
                                    const isActive =
                                        String(
                                            isDraftTablePicker
                                                ? draftSelectedTableId
                                                : selectedTableId
                                        ) ===
                                        String(table.id);

                                    // Calculate minutes since last transaction
                                    const minutesSinceLastTransaction = table.latest_transaction_at
                                        ? Math.max(0, Math.round((Date.now() - new Date(table.latest_transaction_at).getTime()) / 60000))
                                        : null;
                                    let lastTxLabel = null;
                                    let lastTxClass = "";
                                    let statusBadge = null;
                                    let statusClass = "";
                                    if (minutesSinceLastTransaction === null) {
                                        // Belum pernah transaksi — TERSEDIA
                                        statusBadge = "TERSEDIA";
                                        statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
                                        lastTxClass = "text-slate-400 dark:text-slate-500";
                                    } else if (minutesSinceLastTransaction <= 15) {
                                        // Baru transaksi — DIPESAN
                                        statusBadge = "DIPESAN";
                                        statusClass = "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300";
                                        lastTxLabel = `${minutesSinceLastTransaction} menit yang lalu`;
                                        lastTxClass = "text-rose-600 dark:text-rose-400";
                                    } else if (minutesSinceLastTransaction <= 60) {
                                        // Mungkin masih ditempati — KEMUNGKINAN KOSONG
                                        statusBadge = "KEMUNGKINAN KOSONG";
                                        statusClass = "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
                                        lastTxLabel = `${minutesSinceLastTransaction} menit yang lalu`;
                                        lastTxClass = "text-amber-600 dark:text-amber-400";
                                    } else if (minutesSinceLastTransaction < 1440) {
                                        // Antara 1-23 jam — KEMUNGKINAN KOSONG
                                        statusBadge = "KEMUNGKINAN KOSONG";
                                        statusClass = "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300";
                                        const hours = Math.floor(minutesSinceLastTransaction / 60);
                                        const mins = minutesSinceLastTransaction % 60;
                                        lastTxLabel = hours > 0
                                            ? `${hours} jam${mins > 0 ? ` ${mins} menit` : ""} yang lalu`
                                            : `${minutesSinceLastTransaction} menit yang lalu`;
                                        lastTxClass = "text-orange-600 dark:text-orange-400";
                                    } else {
                                        // Lebih dari 24 jam — TERSEDIA
                                        statusBadge = "TERSEDIA";
                                        statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
                                        const days = Math.floor(minutesSinceLastTransaction / 1440);
                                        const remainingHours = Math.floor((minutesSinceLastTransaction % 1440) / 60);
                                        if (days === 1) {
                                            lastTxLabel = remainingHours > 0
                                                ? `1 hari ${remainingHours} jam yang lalu`
                                                : `1 hari yang lalu`;
                                        } else {
                                            lastTxLabel = remainingHours > 0
                                                ? `${days} hari ${remainingHours} jam yang lalu`
                                                : `${days} hari yang lalu`;
                                        }
                                        lastTxClass = "text-slate-400 dark:text-slate-500";
                                    }

                                    return (
                                        <button
                                            key={table.id}
                                            type="button"
                                            onClick={() => {
                                                if (isDraftTablePicker) {
                                                    setDraftSelectedTableId(
                                                        String(table.id)
                                                    );
                                                } else {
                                                    setSelectedTableId(
                                                        String(table.id)
                                                    );
                                                }
                                                setIsTablePickerModalOpen(
                                                    false
                                                );
                                            }}
                                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                                isActive
                                                    ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30"
                                                    : statusBadge === "DIPESAN"
                                                    ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20"
                                                    : statusBadge === "KEMUNGKINAN KOSONG"
                                                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                                                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {table.code
                                                            ? `${table.code} - ${table.name}`
                                                            : table.name}
                                                    </p>
                                                    {statusBadge && (
                                                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>
                                                            {statusBadge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                    Kapasitas {table.capacity} orang
                                                </p>
                                                {lastTxLabel && (
                                                    <p className={`mt-0.5 text-[11px] font-medium ${lastTxClass}`}>
                                                        {lastTxLabel}
                                                    </p>
                                                )}
                                            </div>
                                            <div
                                                className={`ml-3 h-5 w-5 shrink-0 rounded-md border ${
                                                    isActive
                                                        ? "border-primary-500 bg-primary-500"
                                                        : "border-slate-300 dark:border-slate-600"
                                                }`}
                                            />
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                                    Belum ada meja aktif untuk outlet ini.
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={() => setIsTablePickerModalOpen(false)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Numpad Modal */}
            <NumpadModal
                isOpen={numpadOpen}
                onClose={() => setNumpadOpen(false)}
                onConfirm={handleNumpadConfirm}
                title="Jumlah Bayar"
                initialValue={Number(cashInput) || 0}
                isCurrency={true}
            />

            {isCashPaymentModalOpen && !payLater && paymentMethod === "cash" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setIsCashPaymentModalOpen(false)}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                Pembayaran Tunai
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                Atur Nominal Bayar
                            </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Pilih nominal cepat atau isi jumlah pembayaran pelanggan.
                                </p>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Nominal Cepat
                                </label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {quickCashAmounts.map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() =>
                                                setCashInput(String(amt))
                                            }
                                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                                                Number(cashInput) === amt
                                                    ? "bg-primary-500 text-white"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                            }`}
                                        >
                                            {formatPrice(amt)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Jumlah Bayar (Rp)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                        Rp
                                    </span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={cashInput}
                                        onChange={(e) =>
                                            setCashInput(
                                                e.target.value.replace(
                                                    /[^\d]/g,
                                                    ""
                                                )
                                            )
                                        }
                                        placeholder="0"
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-base font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-emerald-700 dark:text-emerald-300">
                                        Kembalian
                                    </span>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                        {formatPrice(
                                            Math.max(0, cash - payable)
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={() => setIsCashPaymentModalOpen(false)}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Tutup
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCashPaymentModalOpen(false)}
                                className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600"
                            >
                                Simpan Nominal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isOfflineHistoryOpen && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setIsOfflineHistoryOpen(false)}
                    />
                    <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
                                    Offline Sync
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    Riwayat Sinkronisasi Offline
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Pantau transaksi tunai yang masih pending, gagal, atau sudah berhasil disinkronkan.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOfflineHistoryOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Pending
                                </p>
                                <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-300">
                                    {offlinePendingItems.length}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Gagal
                                </p>
                                <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-300">
                                    {offlineFailedItems.length}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Tersinkron
                                </p>
                                <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-300">
                                    {offlineSyncedItems.length}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-5">
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        ["all", "Semua"],
                                        ["pending", "Pending"],
                                        ["failed", "Gagal"],
                                        ["synced", "Tersinkron"],
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() =>
                                                setOfflineHistoryFilter(value)
                                            }
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                offlineHistoryFilter === value
                                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                                    : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Antrean Aktif
                                    </p>
                                    <div className="space-y-2">
                                        {(offlineHistoryFilter === "all" ||
                                            offlineHistoryFilter === "pending" ||
                                            offlineHistoryFilter === "failed") &&
                                        offlineQueue.filter((item) => {
                                            if (offlineHistoryFilter === "pending") {
                                                return item.status !== "failed";
                                            }

                                            if (offlineHistoryFilter === "failed") {
                                                return item.status === "failed";
                                            }

                                            return true;
                                        }).length > 0 ? (
                                            offlineQueue
                                                .filter((item) => {
                                                    if (
                                                        offlineHistoryFilter ===
                                                        "pending"
                                                    ) {
                                                        return (
                                                            item.status !==
                                                            "failed"
                                                        );
                                                    }

                                                    if (
                                                        offlineHistoryFilter ===
                                                        "failed"
                                                    ) {
                                                        return (
                                                            item.status ===
                                                            "failed"
                                                        );
                                                    }

                                                    return (
                                                        offlineHistoryFilter !==
                                                        "synced"
                                                    );
                                                })
                                                .map((item) => (
                                                <div
                                                    key={item.offline_reference}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                                {item.offline_reference}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {item.customer_name || "Pelanggan Umum"} • {formatPrice(item.grand_total || 0)}
                                                            </p>
                                                            {item.last_error && (
                                                                <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                                                                    {item.last_error}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                    item.status === "failed"
                                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                                }`}
                                                            >
                                                                {item.status === "failed" ? "Gagal" : "Pending"}
                                                            </span>
                                                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                                Attempt {Number(item.sync_attempts || 0)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handlePrintOfflineQueueItem(
                                                                    item
                                                                )
                                                            }
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                        >
                                                            Cetak Draft
                                                        </button>
                                                        {!isOfflineMode && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    retrySingleOfflineTransaction(
                                                                        item.offline_reference
                                                                    )
                                                                }
                                                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                            >
                                                                Sync Ulang
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeOfflineQueueItem(
                                                                    item.offline_reference
                                                                )
                                                            }
                                                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                                                        >
                                                            Hapus Antrean
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                {offlineHistoryFilter === "synced"
                                                    ? "Filter saat ini hanya menampilkan transaksi yang sudah tersinkron."
                                                    : "Tidak ada antrean offline aktif."}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Riwayat Tersinkron Terakhir
                                    </p>
                                    <div className="space-y-2">
                                        {(offlineHistoryFilter === "all" ||
                                            offlineHistoryFilter === "synced") &&
                                        offlineSyncedItems.length > 0 ? (
                                            offlineSyncedItems.slice(0, 10).map((item) => (
                                                <div
                                                    key={`${item.offline_reference}-${item.synced_at || item.server_invoice || "history"}`}
                                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                                {item.offline_reference}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                Invoice server: {item.server_invoice || "-"}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                Synced
                                                            </span>
                                                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                                {item.synced_at
                                                                    ? new Date(item.synced_at).toLocaleString("id-ID")
                                                                    : "-"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handlePrintSyncedReceipt(
                                                                    item
                                                                )
                                                            }
                                                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-200"
                                                        >
                                                            Cetak Struk Server
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                {offlineHistoryFilter === "pending" ||
                                                offlineHistoryFilter === "failed"
                                                    ? "Filter saat ini hanya menampilkan antrean aktif."
                                                    : "Belum ada riwayat sinkronisasi."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setIsOfflineHistoryOpen(false)}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Tutup
                            </button>
                            <button
                                type="button"
                                onClick={syncOfflineQueue}
                                disabled={isOfflineMode || isSyncingOfflineQueue || offlineQueue.length === 0}
                                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                            >
                                {isSyncingOfflineQueue ? "Menyinkronkan..." : "Sinkronkan Pending"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeHistoryModal}
                    />
                    <div className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900 sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
                                    Riwayat Kasir
                                </p>
                                <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                                    <IconHistory size={18} />
                                    <span className="sm:hidden">Riwayat transaksi</span>
                                    <span className="hidden sm:inline">
                                        Perjalanan transaksi pelanggan
                                    </span>
                                </h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                                    Detail, status bayar, dan cetak struk.
                                </p>
                                <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                                    Pantau detail belanja, status pembayaran, dan cetak struk tanpa pindah halaman.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeHistoryModal}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="grid min-h-0 flex-1 lg:grid-cols-[360px,1fr]">
                            <div className="flex min-h-0 flex-col border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
                                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
                                    <div className="grid gap-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={historyFilters.q}
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "q",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Cari invoice, pelanggan, kasir..."
                                                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIsHistoryFilterExpanded(
                                                        (current) => !current
                                                    )
                                                }
                                                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            >
                                                Filter
                                                {isHistoryFilterExpanded ? (
                                                    <IconChevronUp size={16} />
                                                ) : (
                                                    <IconChevronDown size={16} />
                                                )}
                                            </button>
                                        </div>
                                        {isHistoryFilterExpanded && (
                                            <>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="date"
                                                        value={
                                                            historyFilters.start_date
                                                        }
                                                        onChange={(event) =>
                                                            updateHistoryFilter(
                                                                "start_date",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={historyFilters.end_date}
                                                        onChange={(event) =>
                                                            updateHistoryFilter(
                                                                "end_date",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        value={
                                                            historyFilters.payment_status
                                                        }
                                                        onChange={(event) =>
                                                            updateHistoryFilter(
                                                                "payment_status",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                    >
                                                        <option value="">
                                                            Semua status
                                                        </option>
                                                        <option value="paid">
                                                            Lunas
                                                        </option>
                                                        <option value="pending">
                                                            Pending
                                                        </option>
                                                        <option value="failed">
                                                            Gagal
                                                        </option>
                                                        <option value="expired">
                                                            Kedaluwarsa
                                                        </option>
                                                    </select>
                                                    <select
                                                        value={
                                                            historyFilters.customer_scope
                                                        }
                                                        onChange={(event) =>
                                                            updateHistoryFilter(
                                                                "customer_scope",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                    >
                                                        <option value="">
                                                            Semua pelanggan
                                                        </option>
                                                        <option value="walk_in">
                                                            Umum
                                                        </option>
                                                        <option value="registered">
                                                            Terdaftar
                                                        </option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-[1fr,110px,90px] gap-2">
                                                    <select
                                                        value={
                                                            historyFilters.payment_method
                                                        }
                                                        onChange={(event) =>
                                                            updateHistoryFilter(
                                                                "payment_method",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                    >
                                                        <option value="">
                                                            Semua metode
                                                        </option>
                                                        <option value="cash">
                                                            Tunai
                                                        </option>
                                                        <option value="bank_transfer">
                                                            Transfer
                                                        </option>
                                                        <option value="midtrans">
                                                            Midtrans
                                                        </option>
                                                        <option value="xendit">
                                                            Xendit
                                                        </option>
                                                        <option value="pay_later">
                                                            Piutang
                                                        </option>
                                                    </select>
                                                    <select
                                                        value={historyFilters.per_page}
                                                        onChange={(event) =>
                                                            updateHistoryFilter(
                                                                "per_page",
                                                                Number(
                                                                    event.target.value
                                                                )
                                                            )
                                                        }
                                                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                                    >
                                                        {[10, 15, 20, 30].map(
                                                            (option) => (
                                                                <option
                                                                    key={option}
                                                                    value={option}
                                                                >
                                                                    {option}/hal
                                                                </option>
                                                            )
                                                        )}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={resetHistoryFilters}
                                                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                    >
                                                        Reset
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span>
                                                {historyMeta.total || 0} transaksi
                                            </span>
                                            {isHistoryLoading ? (
                                                <span>Memuat...</span>
                                            ) : historyMeta.from ? (
                                                <span>
                                                    {historyMeta.from}-{historyMeta.to}
                                                </span>
                                            ) : (
                                                <span>0 hasil</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="min-h-0 max-h-[26vh] flex-1 overflow-y-auto px-3 py-3 sm:max-h-none">
                                    <div className="space-y-2">
                                        {historyTransactions.length > 0 ? (
                                            historyTransactions.map(
                                                (transaction) => {
                                                    const isSelected =
                                                        Number(
                                                            transaction.id
                                                        ) ===
                                                        Number(
                                                            selectedHistoryTransaction?.id
                                                        );
                                                    const isPaid =
                                                        transaction.payment_status ===
                                                        "paid";

                                                    return (
                                                        <button
                                                            key={
                                                                transaction.id
                                                            }
                                                            type="button"
                                                            onClick={() =>
                                                                setSelectedHistoryTransactionId(
                                                                    transaction.id
                                                                )
                                                            }
                                                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                                                isSelected
                                                                    ? "border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/30"
                                                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-950/40"
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                                        {
                                                                            transaction.invoice
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                        {
                                                                            transaction.created_at_label
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <span
                                                                    className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                                                        isPaid
                                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                                    }`}
                                                                >
                                                                    {isPaid
                                                                        ? "Lunas"
                                                                        : "Pending"}
                                                                </span>
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                                                                        {transaction.customer
                                                                            ?.name ||
                                                                            "Pelanggan Umum"}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                        {transaction.total_items} item
                                                                    </p>
                                                                </div>
                                                                <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                                                    {formatPrice(
                                                                        transaction.grand_total
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    );
                                                }
                                            )
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                {isHistoryLoading
                                                    ? "Memuat riwayat transaksi..."
                                                    : "Tidak ada transaksi yang cocok dengan pencarian ini."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800 sm:px-4 sm:py-3">
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateHistoryFilter(
                                                    "page",
                                                    Math.max(
                                                        1,
                                                        Number(
                                                            historyMeta.current_page || 1
                                                        ) - 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                isHistoryLoading ||
                                                Number(
                                                    historyMeta.current_page || 1
                                                ) <= 1
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:px-3 sm:text-xs"
                                        >
                                            <span className="sm:hidden">Prev</span>
                                            <span className="hidden sm:inline">Sebelumnya</span>
                                        </button>
                                        <span className="text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                                            {historyMeta.current_page || 1} /{" "}
                                            {historyMeta.last_page || 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateHistoryFilter(
                                                    "page",
                                                    Math.min(
                                                        Number(
                                                            historyMeta.last_page || 1
                                                        ),
                                                        Number(
                                                            historyMeta.current_page || 1
                                                        ) + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                isHistoryLoading ||
                                                Number(
                                                    historyMeta.current_page || 1
                                                ) >=
                                                    Number(
                                                        historyMeta.last_page || 1
                                                    )
                                            }
                                            className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:px-3 sm:text-xs"
                                        >
                                            <span className="sm:hidden">Next</span>
                                            <span className="hidden sm:inline">Berikutnya</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="min-h-0 overflow-y-auto border-t border-slate-200 dark:border-slate-800 lg:border-t-0">
                                {selectedHistoryTransaction ? (
                                    <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                                    Detail Transaksi
                                                </p>
                                                <h4 className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                                                    {
                                                        selectedHistoryTransaction.invoice
                                                    }
                                                </h4>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {
                                                        selectedHistoryTransaction.created_at_label
                                                    }
                                                </p>
                                            </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                                    selectedHistoryTransaction.payment_status ===
                                                    "paid"
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                    }`}
                                                >
                                                    {selectedHistoryTransaction.payment_status ===
                                                    "paid"
                                                        ? "Sudah Dibayar"
                                                        : "Menunggu Pembayaran"}
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                    {selectedHistoryTransaction.payment_method ||
                                                        "cash"}
                                                </span>
                                                {selectedHistoryTransaction.sales_return_summary
                                                    ?.status !== "none" && (
                                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                        {selectedHistoryTransaction
                                                            .sales_return_summary
                                                            ?.status === "full"
                                                            ? "Retur penuh"
                                                            : "Retur sebagian"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Pelanggan
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                                    {selectedHistoryTransaction.customer
                                                        ?.name ||
                                                        "Pelanggan Umum"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {selectedHistoryTransaction.customer
                                                        ?.phone || "-"}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Kasir
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                                    {selectedHistoryTransaction.cashier
                                                        ?.name || "-"}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Item
                                                </p>
                                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                                    {
                                                        selectedHistoryTransaction.total_items
                                                    }{" "}
                                                    item
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Total
                                                </p>
                                                <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                                    {formatPrice(
                                                        selectedHistoryTransaction.grand_total
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {(selectedHistoryTransaction
                                            .tenant_allocations || []).length >
                                            0 && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/20">
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                                    Tenant Terkait
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {selectedHistoryTransaction.tenant_allocations.map(
                                                        (allocation) => (
                                                            <span
                                                                key={
                                                                    allocation.id
                                                                }
                                                                className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300"
                                                            >
                                                                {allocation
                                                                    .tenant_outlet
                                                                    ?.name ||
                                                                    allocation
                                                                        .tenant_outlet
                                                                        ?.code ||
                                                                    `Tenant ${allocation.tenant_outlet_id}`}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/20">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                                        Item Transaksi
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                        Ringkasan item yang sudah masuk ke transaksi ini.
                                                    </p>
                                                </div>
                                                {Number(
                                                    selectedHistoryTransaction.total_discount ||
                                                        0
                                                ) > 0 && (
                                                    <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                                                        {PROMO_TOTAL_LABEL}{" "}
                                                        {formatPrice(
                                                            selectedHistoryTransaction.total_discount
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-4 space-y-3">
                                                {selectedHistoryTransaction.details.map(
                                                    (detail) => (
                                                        <div
                                                            key={detail.id}
                                                            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                    {
                                                                        detail.product_name
                                                                    }
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                    {detail.qty} x{" "}
                                                                    {formatPrice(
                                                                        detail.price
                                                                    )}
                                                                </p>
                                                                {promoTitleText(
                                                                    detail
                                                                ) ? (
                                                                    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                                                                        {promoTitleText(
                                                                            detail
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {detail.is_promo_reward ? (
                                                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                            {REWARD_ITEM_LABEL}
                                                                        </span>
                                                                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                                            {detail.promo_reward_rule_name ||
                                                                                "Promo aktif"}
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                                {promoDetailText(
                                                                    detail
                                                                ) ? (
                                                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                        {promoDetailText(
                                                                            detail
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {Number(
                                                                    detail.discount_total ||
                                                                        0
                                                                ) > 0 && (
                                                                    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                                                                        Diskon item{" "}
                                                                        {formatPrice(
                                                                            detail.discount_total
                                                                        )}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                                                {formatPrice(
                                                                    detail.total
                                                                )}
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                        Pilih transaksi di sisi kiri untuk melihat detailnya.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/80 md:grid-cols-3 xl:grid-cols-[1fr,1fr,1fr,1fr,1.2fr]">
                            <button
                                type="button"
                                onClick={closeHistoryModal}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Tutup
                            </button>
                            {selectedHistoryTransaction &&
                            canCreateSalesReturn &&
                            selectedHistoryTransaction.can_create_sales_return ? (
                                <Link
                                    href={route(
                                        "sales-returns.create",
                                        selectedHistoryTransaction.id
                                    )}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                                >
                                    <IconReceipt size={16} />
                                    Buat Retur
                                </Link>
                            ) : (
                                <div className="hidden md:block" />
                            )}
                            {selectedHistoryTransaction ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleOpenHistoryReceipt(
                                            selectedHistoryTransaction.invoice
                                        )
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <IconPrinter size={16} />
                                    Cetak Struk
                                </button>
                            ) : (
                                <div />
                            )}
                            {selectedHistoryTransaction ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        openThermalPreview(selectedHistoryTransaction)
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                                >
                                    <IconReceipt size={16} />
                                    Preview Thermal
                                </button>
                            ) : (
                                <div />
                            )}
                            {selectedHistoryTransaction ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleRequeueHistoryReceipt(
                                            selectedHistoryTransaction.id
                                        )
                                    }
                                    disabled={
                                        isRequeueingHistoryReceipt ||
                                        selectedHistoryTransaction.payment_status !==
                                            "paid"
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 disabled:opacity-60 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                                >
                                    <IconPrinter size={16} />
                                    {isRequeueingHistoryReceipt
                                        ? "Mengirim ke Queue..."
                                        : "Print Ulang ke Queue"}
                                </button>
                            ) : (
                                <div className="hidden xl:block" />
                            )}
                            {selectedHistoryTransaction &&
                            canConfirmPayment &&
                            selectedHistoryTransaction.payment_status !==
                                "paid" ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleConfirmHistoryPayment(
                                            selectedHistoryTransaction.id
                                        )
                                    }
                                    disabled={isConfirmingHistoryPayment}
                                    className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 xl:col-span-1"
                                >
                                    <IconCheck size={16} />
                                    {isConfirmingHistoryPayment
                                        ? "Memproses..."
                                        : "Konfirmasi Lunas"}
                                </button>
                            ) : (
                                <div className="hidden xl:block" />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Thermal Preview Modal */}
            {isThermalPreviewOpen && selectedHistoryTransaction && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                        onClick={() => setIsThermalPreviewOpen(false)}
                    />
                    <div className="relative z-10 flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                    Preview Thermal
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    Struk {selectedHistoryTransaction.invoice}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Tampilan real di printer thermal 58mm.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsThermalPreviewOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            <div className="mx-auto max-w-[280px] rounded-lg bg-white px-3 py-4 shadow-inner ring-1 ring-slate-200">
                                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-tight text-black">
                                    {(selectedHistoryTransaction.receiptPreview?.lines ||
                                        []
                                    ).join("\n")}
                                </pre>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={() => setIsThermalPreviewOpen(false)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Help */}
            {showShortcuts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60"
                        onClick={() => setShowShortcuts(false)}
                    />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <IconKeyboard size={24} />
                            Keyboard Shortcuts
                        </h3>
                        <div className="space-y-3">
                            {[
                                ["F1", "Buka Numpad"],
                                ["F2", "Selesaikan Transaksi"],
                                ["F3", "Toggle Produk/Keranjang"],
                                ["F4", "Tampilkan Bantuan"],
                                ["Esc", "Tutup Modal"],
                            ].map(([key, desc]) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between"
                                >
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {desc}
                                    </span>
                                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowShortcuts(false)}
                            className="mt-6 w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

Index.layout = (page) => <POSLayout children={page} />;
