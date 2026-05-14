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
import POSLayout from "@/Layouts/POSLayout";
import ProductGrid from "@/Components/POS/ProductGrid";
import CartPanel from "@/Components/POS/CartPanel";
import PaymentPanel from "@/Components/POS/PaymentPanel";
import CustomerSelect from "@/Components/POS/CustomerSelect";
import NumpadModal from "@/Components/POS/NumpadModal";
import HeldTransactions, {
    HoldButton,
} from "@/Components/POS/HeldTransactions";
import useBarcodeScanner from "@/Hooks/useBarcodeScanner";
import { getProductImageUrl } from "@/Utils/imageUrl";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconUser,
    IconShoppingCart,
    IconReceipt,
    IconPrinter,
    IconKeyboard,
    IconBarcode,
    IconTrash,
    IconCash,
    IconCreditCard,
    IconBuildingBank,
    IconAlertTriangle,
    IconWallet,
    IconX,
} from "@tabler/icons-react";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

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

export default function Index({
    carts = [],
    carts_total = 0,
    heldCarts = [],
    customers = [],
    diningTables = [],
    products = [],
    categories = [],
    initialPricingPreview = { items: [], summary: {} },
    paymentGateways = [],
    defaultPaymentGateway = "cash",
    bankAccounts = [],
    pendingTableOrders = [],
    loyaltyTierOptions = [],
    tenantOutlets = [],
}) {
    const {
        auth,
        errors,
        lowStockNotifications = [],
        activeCashierShift,
    } = usePage().props;
    const { can } = useAuthorization();
    const canOpenShift = can("cashier-shifts-open");

    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
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
    const [selectedModifierOptionIds, setSelectedModifierOptionIds] = useState(
        []
    );
    const [isModifierModalSubmitting, setIsModifierModalSubmitting] =
        useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(WALK_IN_CUSTOMER);
    const [openAddCustomerModalSignal, setOpenAddCustomerModalSignal] =
        useState(0);
    const [orderType, setOrderType] = useState("take_away");
    const [selectedTableId, setSelectedTableId] = useState("");
    const [isTablePickerModalOpen, setIsTablePickerModalOpen] =
        useState(false);
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
    const [checkoutModalStep, setCheckoutModalStep] = useState(null);
    const [completedTransaction, setCompletedTransaction] = useState(null);
    const [checkoutWarning, setCheckoutWarning] = useState("");
    const [isReceiptFrameReady, setIsReceiptFrameReady] = useState(false);
    const [mobileView, setMobileView] = useState("products"); // 'products' | 'cart'
    const [numpadOpen, setNumpadOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [selectedBankAccount, setSelectedBankAccount] = useState(null);
    const [selectedVoucherId, setSelectedVoucherId] = useState("");
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [shiftNotesInput, setShiftNotesInput] = useState("");
    const [tableOrderApprovalTarget, setTableOrderApprovalTarget] = useState(null);
    const [tableOrderCashInput, setTableOrderCashInput] = useState("");
    const [isApprovingTableOrder, setIsApprovingTableOrder] = useState(false);
    const [tableOrderCancelTarget, setTableOrderCancelTarget] = useState(null);
    const [tableOrderCancelReason, setTableOrderCancelReason] = useState("");
    const [isCancellingTableOrder, setIsCancellingTableOrder] = useState(false);
    const normalizedSelectedCategory =
        selectedCategory === null ? null : Number(selectedCategory);
    const pricingItemsByCartId = useMemo(() => {
        const items = pricingPreview?.items || [];

        return items.reduce((accumulator, item) => {
            accumulator[item.cart_id] = item;

            return accumulator;
        }, {});
    }, [pricingPreview]);

    // Ref for search input to enable keyboard focus
    const searchInputRef = useRef(null);
    const receiptFrameRef = useRef(null);

    // Set default payment method
    useEffect(() => {
        setPaymentMethod(defaultPaymentGateway ?? "cash");
    }, [defaultPaymentGateway]);

    useEffect(() => {
        setPricingPreview(initialPricingPreview);
    }, [initialPricingPreview]);

    useEffect(() => {
        setLocalCarts(carts);
    }, [carts]);

    // Barcode scanner integration
    const handleBarcodeScan = useCallback(
        (barcode) => {
            const product = products.find(
                (p) => p.barcode?.toLowerCase() === barcode.toLowerCase()
            );

            if (product) {
                if (product.stock > 0) {
                    handleAddToCart(product);
                    toast.success(`${product.title} ditambahkan (barcode)`);
                } else {
                    toast.error(`${product.title} stok habis`);
                }
            } else {
                toast.error(`Produk tidak ditemukan: ${barcode}`);
            }
        },
        [products]
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
        () => Number(pricingPreview?.summary?.base_subtotal ?? carts_total ?? 0),
        [pricingPreview, carts_total]
    );
    const promoDiscount = useMemo(
        () => Number(pricingPreview?.summary?.promo_discount_total ?? 0),
        [pricingPreview]
    );
    const voucherDiscount = useMemo(
        () => Number(pricingPreview?.summary?.voucher_discount_total ?? 0),
        [pricingPreview]
    );
    const loyaltyDiscount = useMemo(
        () => Number(pricingPreview?.summary?.loyalty_discount_total ?? 0),
        [pricingPreview]
    );
    const subtotal = useMemo(
        () => Number(pricingPreview?.summary?.subtotal_after_promo ?? 0),
        [pricingPreview]
    );
    const payable = useMemo(
        () => Number(pricingPreview?.summary?.grand_total ?? 0),
        [pricingPreview]
    );
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
    const selectedDiningTable = useMemo(
        () =>
            diningTables.find(
                (table) => String(table.id) === String(selectedTableId)
            ) || null,
        [diningTables, selectedTableId]
    );
    const pricingDependency = useMemo(
        () => localCarts.map((item) => `${item.id}:${item.qty}`).join("|"),
        [localCarts]
    );
    const isCartSyncing = pendingCartMutations > 0;
    const tableOrderCashAmount = useMemo(
        () => Math.max(0, Number(tableOrderCashInput) || 0),
        [tableOrderCashInput]
    );
    const tableOrderChangeAmount = useMemo(() => {
        const targetTotal = Number(tableOrderApprovalTarget?.grand_total || 0);

        return Math.max(0, tableOrderCashAmount - targetTotal);
    }, [tableOrderApprovalTarget, tableOrderCashAmount]);

    useEffect(() => {
        if (localCarts.length === 0) {
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

        if (isCartSyncing) {
            setIsLoadingPricing(false);

            return;
        }

        let cancelled = false;
        setIsLoadingPricing(true);

        axios
            .post(route("transactions.pricing-preview"), {
                customer_id: selectedCustomer?.is_walk_in ? null : selectedCustomer?.id ?? null,
                discount,
                shipping_cost: shipping,
                redeem_points: Number(redeemPointsInput || 0),
                customer_voucher_id: selectedVoucherId || null,
            })
            .then((response) => {
                if (!cancelled) {
                    setPricingPreview(response.data?.data ?? initialPricingPreview);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error("Gagal memuat promo aktif");
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingPricing(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        selectedCustomer?.id,
        selectedCustomer?.is_walk_in,
        pricingDependency,
        discount,
        shipping,
        redeemPointsInput,
        selectedVoucherId,
        cartSyncVersion,
        isCartSyncing,
    ]);

    useEffect(() => {
        if (!selectedCustomer?.is_loyalty_member) {
            setRedeemPointsInput("");
            setSelectedVoucherId("");
        }
    }, [selectedCustomer?.id, selectedCustomer?.is_loyalty_member]);

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
        const eligibleVoucherIds = new Set(
            (pricingPreview?.eligible_vouchers || []).map((voucher) =>
                String(voucher.id)
            )
        );

        if (selectedVoucherId && !eligibleVoucherIds.has(selectedVoucherId)) {
            setSelectedVoucherId("");
        }
    }, [pricingPreview?.eligible_vouchers, selectedVoucherId]);

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

        return "Tunai";
    }, [payLater, paymentMethod]);

    // Auto-set cash input for non-cash payment
    useEffect(() => {
        if (!isCashPayment && payable >= 0) {
            setCashInput(String(payable));
        }
    }, [isCashPayment, payable]);

    const handleOpenShift = () => {
        router.post(route("cashier-shifts.store"), {
            opening_cash: Number(openingCashInput || 0),
            notes: shiftNotesInput,
            redirect_to: "transactions",
        });
    };

    const openTableOrderApproval = (order) => {
        setTableOrderApprovalTarget(order);
        setTableOrderCashInput(String(order?.grand_total || 0));
    };

    const closeTableOrderApproval = () => {
        if (isApprovingTableOrder) {
            return;
        }

        setTableOrderApprovalTarget(null);
        setTableOrderCashInput("");
    };

    const submitTableOrderApproval = () => {
        if (!tableOrderApprovalTarget?.id) {
            return;
        }

        if (tableOrderCashAmount < Number(tableOrderApprovalTarget.grand_total || 0)) {
            toast.error("Nominal tunai kurang dari total order.");
            return;
        }

        setIsApprovingTableOrder(true);

        router.post(
            route("table-orders.approve", tableOrderApprovalTarget.id),
            {
                cash: tableOrderCashAmount,
                redirect_to: "print",
            },
            {
                preserveScroll: true,
                onFinish: () => setIsApprovingTableOrder(false),
            }
        );
    };

    const openTableOrderCancel = (order) => {
        setTableOrderCancelTarget(order);
        setTableOrderCancelReason("");
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
                onFinish: () => setIsCancellingTableOrder(false),
            }
        );
    };

    const hasPresetModifiers = useCallback(
        (product) => Array.isArray(product?.modifier_options) && product.modifier_options.length > 0,
        []
    );

    const addProductToCart = useCallback(async (product, options = {}) => {
        if (!product?.id) return;
        const modifiers = Array.isArray(options.modifiers)
            ? options.modifiers.filter((item) => item?.name)
            : [];
        const shouldForceNew = modifiers.length > 0;

        setAddingProductId(product.id);
        setPendingCartMutations((count) => count + 1);
        const previousCarts = localCarts;
        const tempId = `temp-${product.id}-${Date.now()}`;

        if (!shouldForceNew) {
            setLocalCarts((currentCarts) => {
                const existingCart = currentCarts.find(
                    (item) =>
                        item.product_id === product.id &&
                        !(item.notes || "").trim() &&
                        (!item.modifiers || item.modifiers.length === 0)
                );

                if (existingCart) {
                    return currentCarts.map((item) =>
                        item.product_id === product.id
                            ? {
                                  ...item,
                                  qty: Number(item.qty || 0) + 1,
                                  price:
                                      Number(
                                          item.product?.sell_price ||
                                              product.sell_price ||
                                              0
                                      ) *
                                      (Number(item.qty || 0) + 1),
                              }
                            : item
                    );
                }

                return [
                    {
                        id: tempId,
                        product_id: product.id,
                        qty: 1,
                        price: Number(product.sell_price || 0),
                        product: {
                            ...product,
                        },
                        tenant_outlet_id: product.tenant_outlet_id || null,
                        is_optimistic: true,
                    },
                    ...currentCarts,
                ];
            });
        }

        return axios
            .post(route("transactions.addToCart"), {
                product_id: product.id,
                sell_price: product.sell_price,
                qty: 1,
                force_new: shouldForceNew,
            })
            .then(async (response) => {
                let serverCart = response.data?.data?.cart;

                if (serverCart && modifiers.length > 0) {
                    for (const modifier of modifiers) {
                        const modifierResponse = await axios.post(
                            route("transactions.storeCartModifier", serverCart.id),
                            {
                                name: modifier.name,
                                qty: 1,
                                unit_price: Math.max(
                                    0,
                                    Number(modifier.price || 0)
                                ),
                            }
                        );

                        serverCart =
                            modifierResponse.data?.data?.cart || serverCart;
                    }
                }

                if (serverCart) {
                    setLocalCarts((currentCarts) => {
                        const withoutTemp = currentCarts.filter(
                            (item) => item.id !== tempId
                        );
                        const existingIndex = withoutTemp.findIndex(
                            (item) => item.id === serverCart.id
                        );

                        if (existingIndex >= 0) {
                            const nextCarts = [...withoutTemp];
                            nextCarts[existingIndex] = serverCart;

                            return nextCarts;
                        }

                        return [serverCart, ...withoutTemp];
                    });
                }

                setCartSyncVersion((version) => version + 1);
                toast.success(`${product.title} ditambahkan`);
                return true;
            })
            .catch((error) => {
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
    }, [localCarts]);

    // Handle add product to cart
    const handleAddToCart = useCallback(
        (product) => {
            if (!product?.id) return;

            if (hasPresetModifiers(product)) {
                setModifierModalProduct(product);
                setSelectedModifierOptionIds([]);
                return;
            }

            addProductToCart(product);
        },
        [addProductToCart, hasPresetModifiers]
    );

    const handleToggleModifierOption = useCallback((optionId) => {
        setSelectedModifierOptionIds((current) =>
            current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : [...current, optionId]
        );
    }, []);

    const closeModifierModal = useCallback(() => {
        if (isModifierModalSubmitting) {
            return;
        }

        setModifierModalProduct(null);
        setModifierModalCartTargetId(null);
        setSelectedModifierOptionIds([]);
    }, [isModifierModalSubmitting]);

    const openCartModifierModal = useCallback((item) => {
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
        setSelectedModifierOptionIds(activeOptionIds);
    }, []);

    const submitModifierModal = useCallback(
        async (includeModifiers) => {
            if (!modifierModalProduct?.id) {
                return;
            }

            const selectedModifiers = includeModifiers
                ? (modifierModalProduct.modifier_options || []).filter(
                      (option) =>
                          selectedModifierOptionIds.includes(option.id)
                  )
                : [];

            setIsModifierModalSubmitting(true);

            try {
                let success = false;

                if (modifierModalCartTargetId) {
                    const existingModifierKeys = new Set(
                        localCarts
                            .find((item) => item.id === modifierModalCartTargetId)
                            ?.modifiers?.map(
                                (modifier) =>
                                    `${modifier.name}:${Number(
                                        modifier.unit_price || 0
                                    )}`
                            ) || []
                    );
                    const modifiersToAdd = selectedModifiers.filter(
                        (option) =>
                            !existingModifierKeys.has(
                                `${option.name}:${Number(option.price || 0)}`
                            )
                    );

                    let updatedCart = null;

                    for (const option of modifiersToAdd) {
                        const response = await axios.post(
                            route(
                                "transactions.storeCartModifier",
                                modifierModalCartTargetId
                            ),
                            {
                                name: option.name,
                                qty: 1,
                                unit_price: Math.max(
                                    0,
                                    Number(option.price || 0)
                                ),
                            }
                        );

                        updatedCart = response.data?.data?.cart || updatedCart;
                    }

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
                        modifiers: selectedModifiers,
                    });
                }

                if (success) {
                    setModifierModalProduct(null);
                    setModifierModalCartTargetId(null);
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
            localCarts,
            modifierModalCartTargetId,
            modifierModalProduct,
            selectedModifierOptionIds,
        ]
    );

    // Handle update cart quantity
    const [updatingCartId, setUpdatingCartId] = useState(null);
    const [updatingTenantCartId, setUpdatingTenantCartId] = useState(null);

    const handleUpdateQty = (cartId, newQty) => {
        if (newQty < 1) return;
        setUpdatingCartId(cartId);
        setPendingCartMutations((count) => count + 1);
        const previousCarts = localCarts;

        setLocalCarts((currentCarts) =>
            currentCarts.map((item) =>
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
            )
        );

        axios
            .patch(route("transactions.updateCart", cartId), { qty: newQty })
            .then((response) => {
                const serverCart = response.data?.data?.cart;

                if (serverCart) {
                    setLocalCarts((currentCarts) =>
                        currentCarts.map((item) =>
                            item.id === cartId ? serverCart : item
                        )
                    );
                }

                setCartSyncVersion((version) => version + 1);
            })
            .catch((error) => {
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
        if (!tenantOutletId) return;

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
    }, []);

    const handleSaveCartNotes = useCallback(
        (cartId, notes) => {
            if (!cartId || String(cartId).startsWith("temp-")) {
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
        [localCarts]
    );

    const handleRemoveModifier = useCallback((cartId, modifierId) => {
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
    }, []);

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
        setOrderType("take_away");
        setSelectedTableId("");
        setSelectedBankAccount(null);
        setSelectedVoucherId("");
        setPaymentMethod(defaultPaymentGateway ?? "cash");
        setPayLater(false);
        setDueDate("");
    }, [defaultPaymentGateway]);

    const validateTransactionSubmission = useCallback(() => {
        if (localCarts.length === 0) {
            toast.error("Keranjang masih kosong");
            return false;
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
        localCarts.length,
        orderType,
        payLater,
        payable,
        paymentMethod,
        selectedBankAccount,
        selectedCustomer?.is_walk_in,
        selectedTableId,
    ]);

    const buildTransactionPayload = useCallback(
        () => ({
            customer_id: selectedCustomer?.is_walk_in
                ? null
                : selectedCustomer?.id ?? null,
            order_type: orderType,
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
            pay_later: payLater,
            due_date: dueDate,
        }),
        [
            cash,
            dueDate,
            isCashPayment,
            orderType,
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

    const openCheckoutPreview = useCallback(() => {
        if (!validateTransactionSubmission()) {
            return;
        }

        setCheckoutWarning("");
        setCompletedTransaction(null);
        setIsReceiptFrameReady(false);
        setCheckoutModalStep("preview");
    }, [validateTransactionSubmission]);

    const closeCheckoutModal = useCallback(() => {
        if (isSubmitting) {
            return;
        }

        setCheckoutModalStep(null);
        setCompletedTransaction(null);
        setCheckoutWarning("");
        setIsReceiptFrameReady(false);
    }, [isSubmitting]);

    const handlePrintReceipt = useCallback(() => {
        const receiptWindow = receiptFrameRef.current?.contentWindow;

        if (!receiptWindow) {
            toast.error("Preview struk belum siap");
            return;
        }

        receiptWindow.focus();
        receiptWindow.print();
        closeCheckoutModal();
    }, [closeCheckoutModal]);

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
                    if (localCarts.length > 0) openCheckoutPreview();
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
        setRemovingItemId(cartId);
        setPendingCartMutations((count) => count + 1);
        const previousCarts = localCarts;

        setLocalCarts((currentCarts) =>
            currentCarts.filter((item) => item.id !== cartId)
        );

        axios
            .delete(route("transactions.destroyCart", cartId))
            .then(() => {
                setCartSyncVersion((version) => version + 1);
                toast.success("Item dihapus dari keranjang");
            })
            .catch((error) => {
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

        setIsSubmitting(true);

        try {
            const response = await axios.post(
                route("transactions.store"),
                buildTransactionPayload(),
                {
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const receiptData = response.data?.data || null;
            setCompletedTransaction(receiptData);
            setCheckoutWarning(response.data?.warning || "");
            setCheckoutModalStep("receipt");
            setIsReceiptFrameReady(false);
            resetTransactionForm();
            toast.success("Transaksi berhasil!");
        } catch (error) {
            toast.error(
                error?.response?.data?.message || "Gagal menyimpan transaksi"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter products including out of stock
    const allProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesCategory =
                normalizedSelectedCategory === null ||
                Number(product.category_id) === normalizedSelectedCategory;
            const matchesSearch =
                !searchQuery ||
                product.title
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                product.barcode
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, normalizedSelectedCategory, searchQuery]);

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
                            Shift kasir belum dibuka
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Buka shift terlebih dulu untuk mengaktifkan transaksi, keranjang, dan cash closing.
                        </p>

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

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            {canOpenShift && (
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
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Transaksi" />

            <div className="h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col lg:flex-row">
                {/* Mobile Tab Switcher */}
                <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button
                        onClick={() => setMobileView("products")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                            mobileView === "products"
                                ? "text-primary-600 border-b-2 border-primary-500"
                                : "text-slate-500"
                        }`}
                    >
                        <IconShoppingCart size={18} />
                        <span>Produk</span>
                    </button>
                    <button
                        onClick={() => setMobileView("cart")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                            mobileView === "cart"
                                ? "text-primary-600 border-b-2 border-primary-500"
                                : "text-slate-500"
                        }`}
                    >
                        <IconReceipt size={18} />
                        <span className="relative inline-flex items-center gap-1">
                            Keranjang
                            {cartCount > 0 && (
                                <span className="inline-flex items-center justify-center px-1.5 min-w-[20px] h-5 text-[11px] font-bold bg-primary-500 text-white rounded-full">
                                    {cartCount}
                                </span>
                            )}
                        </span>
                    </button>
                </div>

                {/* Left Panel - Products */}
                <div
                    className={`flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden ${
                        mobileView !== "products"
                            ? "hidden lg:flex lg:flex-col"
                            : "flex flex-col"
                    }`}
                >
                    <ProductGrid
                        products={allProducts}
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
                    />
                </div>

                {/* Right Panel - Cart & Payment */}
                <div
                    className={`w-full lg:w-[520px] xl:w-[580px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 min-h-0 overflow-hidden ${
                        mobileView !== "cart" ? "hidden lg:flex" : "flex"
                    }`}
                    style={{ height: "calc(100vh - 4rem)" }}
                >
                    {/* Customer Select - Fixed */}
                    <div className="border-b border-slate-200 p-2.5 dark:border-slate-800 lg:p-3 flex-shrink-0">
                        <div className="space-y-2.5">
                            <CustomerSelect
                                customers={customers}
                                selected={selectedCustomer}
                                onSelect={setSelectedCustomer}
                                placeholder="Pilih pelanggan umum atau terdaftar..."
                                error={errors?.customer_id}
                                tierOptions={loyaltyTierOptions}
                                openAddModalSignal={openAddCustomerModalSignal}
                            />
                            <div className="space-y-2.5">
                                <div>
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
                                                setOrderType(option.value);
                                                if (
                                                    option.value === "dine_in" &&
                                                    !selectedTableId
                                                ) {
                                                    setIsTablePickerModalOpen(
                                                        true
                                                    );
                                                }
                                            }}
                                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                                orderType === option.value
                                                    ? "bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300"
                                                    : "text-slate-600 dark:text-slate-300"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                </div>
                                {orderType === "dine_in" && (
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsTablePickerModalOpen(true)
                                            }
                                            className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 transition hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                    Meja
                                                </p>
                                                <p className="truncate font-medium">
                                                    {selectedDiningTable
                                                        ? selectedDiningTable.code
                                                            ? `${selectedDiningTable.code} - ${selectedDiningTable.name}`
                                                            : selectedDiningTable.name
                                                        : "Pilih meja"}
                                                </p>
                                            </div>
                                            <span className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                                                Ubah
                                            </span>
                                        </button>
                                        {diningTables.length === 0 ? (
                                            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">
                                                Belum ada meja aktif untuk outlet ini.
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </div>
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

                    {/* Cart Items - Scrollable */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Hold Button - at top of cart section */}
                        {localCarts.length > 0 && (
                        <div className="border-b border-slate-200 p-2.5 dark:border-slate-800 lg:p-3">
                            <HoldButton
                                hasItems={localCarts.length > 0}
                                onHold={handleHoldCart}
                                isHolding={isHolding}
                            />
                        </div>
                    )}

                        <div className="border-b border-slate-200 p-2.5 dark:border-slate-800 lg:p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <IconShoppingCart size={16} />
                                    Keranjang
                                </h3>
                                {localCarts.length > 0 && (
                                    <span className="px-2.5 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded-full whitespace-nowrap">
                                        {cartCount} item
                                    </span>
                                )}
                            </div>

                            {localCarts.length > 0 ? (
                                <div className="space-y-2 pr-1">
                                    {localCarts.map((item) => (
                                        (() => {
                                            const pricingItem =
                                                pricingItemsByCartId[item.id];
                                            const baseLineTotal = Number(
                                                pricingItem?.line_base_total ??
                                                    item.price ??
                                                    0
                                            );
                                            const effectiveLineTotal = Number(
                                                pricingItem?.line_total ??
                                                    item.price ??
                                                    0
                                            );
                                            const effectiveUnitPrice = Number(
                                                pricingItem?.effective_unit_price ??
                                                    item.product?.sell_price ??
                                                    0
                                            );
                                            const baseUnitPrice = Number(
                                                pricingItem?.base_unit_price ??
                                                    item.product?.sell_price ??
                                                    0
                                            );
                                            const pricingRule =
                                                pricingItem?.pricing_rule;
                                            const modifierTotal = (
                                                item.modifiers || []
                                            ).reduce(
                                                (sum, modifier) =>
                                                    sum +
                                                    Number(
                                                        modifier.total_price || 0
                                                    ),
                                                0
                                            );

                                            return (
                                        <div
                                            key={item.id}
                                            className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50 group"
                                        >
                                            <div className="mt-0.5 h-11 w-11 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0 self-start">
                                                {item.product?.image ? (
                                                    <img
                                                        src={getProductImageUrl(
                                                            item.product.image,
                                                            item.product.title
                                                        )}
                                                        alt={item.product.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(event) => {
                                                            event.currentTarget.onerror =
                                                                null;
                                                            event.currentTarget.src =
                                                                getProductImageUrl(
                                                                    null,
                                                                    item.product
                                                                        ?.title ||
                                                                        "Produk"
                                                                );
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <IconShoppingCart
                                                            size={14}
                                                            className="text-slate-400"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {item.product?.title ||
                                                        "Produk"}
                                                </p>
                                                <div className="text-xs text-slate-500">
                                                    {pricingRule &&
                                                        effectiveUnitPrice <
                                                            baseUnitPrice && (
                                                            <p className="line-through text-slate-400">
                                                                {formatPrice(
                                                                    baseUnitPrice
                                                                )}{" "}
                                                                × {item.qty}
                                                            </p>
                                                        )}
                                                    <p>
                                                        {formatPrice(
                                                            effectiveUnitPrice
                                                        )}{" "}
                                                        × {item.qty}
                                                    </p>
                                                    {pricingRule && (
                                                        <p className="mt-0.5 text-[11px] font-medium text-rose-500">
                                                            {pricingRule.name}
                                                        </p>
                                                    )}
                                                </div>
                                                {item.product
                                                    ?.supports_modifiers && (
                                                    <div className="mt-1.5">
                                                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                            Tambahan / topping
                                                        </label>
                                                        <div className="space-y-1.5">
                                                            {(item.product
                                                                ?.modifier_options ||
                                                                []
                                                            ).length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openCartModifierModal(
                                                                            item
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        savingModifierCartId ===
                                                                        item.id
                                                                    }
                                                                    className="inline-flex items-center justify-center rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-[11px] font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-100 disabled:opacity-60 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300"
                                                                >
                                                                    Tambah topping / extra
                                                                </button>
                                                            )}
                                                            {(item.modifiers ||
                                                                []
                                                            ).map(
                                                                (modifier) => (
                                                                    <div
                                                                        key={
                                                                            modifier.id
                                                                        }
                                                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                                                                                {
                                                                                    modifier.name
                                                                                }
                                                                            </p>
                                                                            <p className="text-slate-500 dark:text-slate-400">
                                                                                {formatPrice(
                                                                                    modifier.total_price
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    handleRemoveModifier(
                                                                                        item.id,
                                                                                        modifier.id
                                                                                    )
                                                                                }
                                                                                className="rounded p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500 dark:hover:bg-danger-950/40"
                                                                            >
                                                                                <IconTrash
                                                                                    size={
                                                                                        12
                                                                                    }
                                                                                />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )}
                                                            {modifierTotal >
                                                            0 ? (
                                                                <p className="text-[10px] font-medium text-primary-500">
                                                                    Total
                                                                    tambahan:{" "}
                                                                    {formatPrice(
                                                                        modifierTotal
                                                                    )}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="mt-1.5">
                                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                        Catatan item
                                                    </label>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={
                                                                item.notes || ""
                                                            }
                                                            onChange={(e) =>
                                                                handleLocalCartNotesChange(
                                                                    item.id,
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            onBlur={(e) =>
                                                                handleSaveCartNotes(
                                                                    item.id,
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            disabled={String(
                                                                item.id
                                                            ).startsWith(
                                                                "temp-"
                                                            )}
                                                            placeholder="Contoh: es dipisah"
                                                            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                        />
                                                        {savingNoteCartId ===
                                                        item.id ? (
                                                            <p className="mt-1 text-[10px] text-primary-500">
                                                                Menyimpan...
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() =>
                                                        handleUpdateQty(
                                                            item.id,
                                                            Math.max(
                                                                1,
                                                                item.qty - 1
                                                            )
                                                        )
                                                    }
                                                    disabled={item.qty <= 1}
                                                    className="h-7 w-7 rounded-lg flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 disabled:opacity-50 text-xs"
                                                >
                                                    -
                                                </button>
                                                <span className="w-7 text-center text-sm font-medium">
                                                    {item.qty}
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        handleUpdateQty(
                                                            item.id,
                                                            item.qty + 1
                                                        )
                                                    }
                                                    className="h-7 w-7 rounded-lg flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 text-xs"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleRemoveFromCart(
                                                            item.id
                                                        )
                                                    }
                                                    className="ml-1 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/50"
                                                >
                                                    <IconTrash size={12} />
                                                </button>
                                            </div>
                                            <p className="w-20 text-right text-sm font-semibold text-primary-600 dark:text-primary-400">
                                                {formatPrice(
                                                    effectiveLineTotal
                                                )}
                                            </p>
                                        </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <IconShoppingCart
                                        size={32}
                                        className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
                                    />
                                    <p className="text-sm text-slate-400">
                                        Keranjang kosong
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Payment Details - Scrollable */}
                        <div className="p-3 space-y-4">
                            {/* Pay later toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                        Bayar Belakangan (Nota Barang)
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Tidak perlu bayar sekarang, catat sebagai piutang.
                                    </p>
                                </div>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={payLater}
                                        onChange={(e) => {
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
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Tanggal Jatuh Tempo
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                            )}

                            {/* Payment Method Selection */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Metode Pembayaran
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentOptions.map((method) => (
                                        <button
                                            key={method.value}
                                            onClick={() => {
                                                if (payLater) {
                                                    return;
                                                }

                                                setPaymentMethod(method.value);

                                                if (method.value === "cash") {
                                                    setIsCashPaymentModalOpen(
                                                        true
                                                    );
                                                }
                                            }}
                                            disabled={payLater}
                                            className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                                                paymentMethod === method.value && !payLater
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                            } ${payLater ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    paymentMethod ===
                                                        method.value &&
                                                    !payLater
                                                        ? "bg-primary-500 text-white"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                }`}
                                            >
                                                {method.value === "cash" ? (
                                                    <IconCash size={16} />
                                                ) : method.value ===
                                                  "bank_transfer" ? (
                                                    <IconBuildingBank
                                                        size={16}
                                                    />
                                                ) : (
                                                    <IconCreditCard size={16} />
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <p
                                                    className={`text-sm font-semibold ${
                                                        paymentMethod ===
                                                        method.value
                                                            ? "text-primary-700 dark:text-primary-300"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {method.label}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bank Selector - Only for bank_transfer */}
                            {paymentMethod === "bank_transfer" &&
                                bankAccounts.length > 0 &&
                                !payLater && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                            Rekening Tujuan
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                                        className={`p-3 rounded-xl border-2 transition-colors flex items-center gap-3 text-left ${
                                                            isActive
                                                                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                                : "border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800"
                                                        }`}
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
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
                                                                    size={18}
                                                                    className="text-slate-500"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                {
                                                                    bank.bank_name
                                                                }
                                                            </p>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                {
                                                                    bank.account_number
                                                                }
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-500">
                                                                a.n.{" "}
                                                                {
                                                                    bank.account_name
                                                                }
                                                            </p>
                                                        </div>
                                                        {isActive && (
                                                            <span className="text-[11px] font-semibold text-primary-600">
                                                                Dipilih
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            {paymentMethod === "cash" && !payLater && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                Pembayaran Tunai
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {cash > 0
                                                    ? `Tunai diterima ${formatPrice(
                                                          cash
                                                      )}`
                                                    : "Atur nominal cepat dan jumlah bayar di pop-up"}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsCashPaymentModalOpen(true)
                                            }
                                            className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-100 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300"
                                        >
                                            Atur Tunai
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Discount Input */}
                            {promoDiscount > 0 && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                                Promo otomatis aktif
                                            </p>
                                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                                                Harga item sudah disesuaikan berdasarkan rule promo yang berlaku.
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                            -{formatPrice(promoDiscount)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {selectedCustomer?.is_walk_in && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                                Transaksi Pelanggan Umum
                                            </p>
                                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                                                Poin, voucher pelanggan, dan manfaat member tidak berlaku karena transaksi ini tidak terhubung ke pelanggan terdaftar.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCustomer &&
                                !selectedCustomer?.is_walk_in &&
                                !selectedCustomer?.is_loyalty_member && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    Pelanggan Non-member
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Transaksi tetap bisa diproses, tetapi penukaran poin dan voucher pelanggan belum tersedia sampai pelanggan di-upgrade menjadi member.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            {selectedCustomer?.is_loyalty_member && (
                                <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-900/40 dark:bg-primary-950/20">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                                                Member Loyalty
                                            </p>
                                            <p className="text-xs text-primary-600/80 dark:text-primary-400/80">
                                                Tier {selectedCustomer.loyalty_tier} | saldo{" "}
                                                {pricingPreview?.summary
                                                    ?.available_loyalty_points ??
                                                    0}{" "}
                                                poin
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCustomer?.is_loyalty_member && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Redeem Poin
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={redeemPointsInput}
                                        onChange={(e) =>
                                            setRedeemPointsInput(
                                                e.target.value.replace(
                                                    /[^\d]/g,
                                                    ""
                                                )
                                            )
                                        }
                                        placeholder={`Maks ${
                                            pricingPreview?.summary
                                                ?.available_loyalty_points ?? 0
                                        } poin`}
                                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                            )}

                            {selectedCustomer?.is_loyalty_member &&
                                (pricingPreview?.eligible_vouchers || [])
                                    .length > 0 && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                            Voucher Customer
                                        </label>
                                        <select
                                            value={selectedVoucherId}
                                            onChange={(e) =>
                                                setSelectedVoucherId(
                                                    e.target.value
                                                )
                                            }
                                            className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        >
                                            <option value="">
                                                Tanpa voucher
                                            </option>
                                            {(
                                                pricingPreview?.eligible_vouchers ||
                                                []
                                            ).map((voucher) => (
                                                <option
                                                    key={voucher.id}
                                                    value={voucher.id}
                                                >
                                                    {voucher.code} -{" "}
                                                    {voucher.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                        </div>
                    </div>

                    {/* Summary & Submit - Fixed at bottom */}
                    <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3">
                        {/* Summary Row */}
                        <div className="flex justify-between items-center mb-2 text-sm">
                            <span className="text-slate-500">Subtotal Dasar</span>
                            <span className="font-medium">
                                {formatPrice(baseSubtotal)}
                            </span>
                        </div>
                        {promoDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">
                                    Promo Otomatis
                                </span>
                                <span className="text-emerald-600">
                                    -{formatPrice(promoDiscount)}
                                </span>
                            </div>
                        )}
                        {(pricingPreview?.applied_groups || []).length > 0 && (
                            <div className="mb-3 rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Grup Promo Aktif
                                </div>
                                <div className="space-y-1.5">
                                    {(pricingPreview?.applied_groups || []).map(
                                        (group) => (
                                            <div
                                                key={group.key}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="truncate pr-3 text-slate-600 dark:text-slate-300">
                                                    {group.label}
                                                </span>
                                                <span className="font-medium text-emerald-600">
                                                    -{formatPrice(group.discount_total)}
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                        {voucherDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Voucher</span>
                                <span className="text-primary-600">
                                    -{formatPrice(voucherDiscount)}
                                </span>
                            </div>
                        )}
                        {loyaltyDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">
                                    Redeem Poin
                                </span>
                                <span className="text-primary-600">
                                    -{formatPrice(loyaltyDiscount)}
                                </span>
                            </div>
                        )}
                        {shipping > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Ongkir</span>
                                <span className="font-medium">
                                    +{formatPrice(shipping)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-semibold text-slate-800 dark:text-white">
                                Total
                            </span>
                            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                {formatPrice(payable)}
                            </span>
                        </div>

                        {paymentMethod === "cash" &&
                            !payLater &&
                            cash >= payable &&
                            payable > 0 && (
                                <div className="flex justify-between items-center mb-3 p-2 rounded-lg bg-success-50 dark:bg-success-950/30">
                                    <span className="text-sm text-success-700 dark:text-success-400">
                                        Kembalian
                                    </span>
                                    <span className="font-bold text-success-600">
                                        {formatPrice(cash - payable)}
                                    </span>
                                </div>
                            )}

                        {/* Submit Button - Always visible */}
                        <button
                            onClick={openCheckoutPreview}
                            disabled={
                                !localCarts.length ||
                                (!payLater &&
                                    paymentMethod === "cash" &&
                                    cash < payable) ||
                                isLoadingPricing ||
                                isSubmitting
                            }
                            className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                                localCarts.length &&
                                (paymentMethod !== "cash" || cash >= payable)
                                    && !isLoadingPricing
                                    ? "bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                            {isSubmitting || isLoadingPricing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <IconReceipt size={18} />
                                    <span>
                                        {!localCarts.length
                                            ? "Keranjang Kosong"
                                            : paymentMethod === "cash" &&
                                              cash < payable
                                            ? `Kurang ${formatPrice(
                                                  payable - cash
                                              )}`
                                            : isLoadingPricing
                                            ? "Menghitung Promo..."
                                            : "Selesaikan Transaksi"}
                                    </span>
                                </>
                            )}
                        </button>
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
                                        Preview Transaksi
                                    </p>
                                    <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                        Periksa sebelum disimpan
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Setelah dikonfirmasi, transaksi langsung disimpan dan resi tampil di modal yang sama.
                                    </p>
                                </div>

                                <div className="overflow-y-auto px-5 py-4">
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
                                                    const promoLabel =
                                                        pricingItem?.pricing_rule
                                                            ?.label ||
                                                        pricingItem?.pricing_group_label ||
                                                        pricingItem?.pricing_rule_name;
                                                    const lineTotal = Number(
                                                        pricingItem?.line_total ??
                                                            item.price ??
                                                            0
                                                    );

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40"
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
                                                                                @{" "}
                                                                                {formatPrice(
                                                                                    Number(
                                                                                        pricingItem?.effective_unit_price ??
                                                                                            item
                                                                                                .product
                                                                                                ?.sell_price ??
                                                                                            0
                                                                                    )
                                                                                )}
                                                                                {promoLabel
                                                                                    ? ` • ${promoLabel}`
                                                                                    : ""}
                                                                            </p>
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
                                                : "Konfirmasi & Simpan"}
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
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                                    <button
                                        type="button"
                                        onClick={closeCheckoutModal}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        Tutup
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePrintReceipt}
                                        disabled={!isReceiptFrameReady}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                                    >
                                        <IconPrinter size={18} />
                                        Cetak Struk
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {tableOrderApprovalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeTableOrderApproval}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
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
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Total order</span>
                                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                                        {formatPrice(tableOrderApprovalTarget.grand_total)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Jumlah Bayar Tunai
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={tableOrderCashInput}
                                    onChange={(event) =>
                                        setTableOrderCashInput(
                                            event.target.value.replace(/[^\d]/g, "")
                                        )
                                    }
                                    placeholder="0"
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>

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
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={closeTableOrderApproval}
                                disabled={isApprovingTableOrder}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={submitTableOrderApproval}
                                disabled={
                                    isApprovingTableOrder ||
                                    tableOrderCashAmount <
                                        Number(tableOrderApprovalTarget.grand_total || 0)
                                }
                                className="rounded-2xl bg-[#b8572f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isApprovingTableOrder ? "Memproses..." : "Approve dan Cetak"}
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

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
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

            {modifierModalProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeModifierModal}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                    Opsi Tambahan
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    {modifierModalProduct.title}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {modifierModalCartTargetId
                                        ? "Pilih topping / extra untuk item yang sudah ada di keranjang."
                                        : "Pilih topping / extra sebelum item dimasukkan ke keranjang."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModifierModal}
                                disabled={isModifierModalSubmitting}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 px-5 py-4">
                            {(modifierModalProduct.modifier_options || []).map(
                                (option) => {
                                    const active =
                                        selectedModifierOptionIds.includes(
                                            option.id
                                        );

                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() =>
                                                handleToggleModifierOption(
                                                    option.id
                                                )
                                            }
                                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                                active
                                                    ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30"
                                                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {option.name}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                    Tambahan {formatPrice(option.price)}
                                                </p>
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
                                }
                            )}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="mb-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Total tambahan
                                </span>
                                <span className="font-semibold text-primary-600 dark:text-primary-400">
                                    {formatPrice(
                                        (modifierModalProduct.modifier_options || [])
                                            .filter((option) =>
                                                selectedModifierOptionIds.includes(
                                                    option.id
                                                )
                                            )
                                            .reduce(
                                                (sum, option) =>
                                                    sum +
                                                    Number(option.price || 0),
                                                0
                                            )
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => submitModifierModal(false)}
                                    disabled={isModifierModalSubmitting}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {modifierModalCartTargetId
                                        ? "Tutup"
                                        : "Tanpa topping"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => submitModifierModal(true)}
                                    disabled={isModifierModalSubmitting}
                                    className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                                >
                                    {isModifierModalSubmitting
                                        ? "Menyimpan..."
                                        : modifierModalCartTargetId
                                        ? "Simpan topping"
                                        : "Tambah ke keranjang"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isTablePickerModalOpen && orderType === "dine_in" && (
                <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
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
                                        String(selectedTableId) ===
                                        String(table.id);

                                    return (
                                        <button
                                            key={table.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedTableId(
                                                    String(table.id)
                                                );
                                                setIsTablePickerModalOpen(
                                                    false
                                                );
                                            }}
                                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                                isActive
                                                    ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30"
                                                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {table.code
                                                        ? `${table.code} - ${table.name}`
                                                        : table.name}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                    Kapasitas {table.capacity} orang
                                                </p>
                                            </div>
                                            <div
                                                className={`h-5 w-5 rounded-md border ${
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
                                Pilih nominal cepat atau isi jumlah bayar kasir.
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

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
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
