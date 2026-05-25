import { Head, Link, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const lineModifierUnitTotal = (modifiers = []) =>
    modifiers.reduce((sum, modifier) => sum + Number(modifier.price || 0), 0);

const promoDisplay = (product) => {
    const badge = product?.pricing_badge;
    const promoPrice = Number(badge?.promo_price || 0);
    const basePrice = Number(badge?.base_price || product?.sell_price || 0);
    const showPromo = promoPrice > 0 && promoPrice < basePrice;

    return {
        badge,
        promoPrice,
        basePrice,
        showPromo,
    };
};

const promoExplanation = (product) =>
    product?.pricing_badge?.detail ||
    product?.pricing_badge?.rule_name ||
    product?.pricing_badge?.label ||
    null;

const productHasPromo = (product) => promoDisplay(product).showPromo;

const resolvedProductUnitPrice = (product) => {
    const promo = promoDisplay(product);

    if (promo.showPromo) {
        return promo.promoPrice;
    }

    return Number(product?.sell_price || 0);
};

const orderStatusLabel = {
    pending_cashier_payment: "Menunggu bayar di kasir",
    paid: "Sudah dibayar",
    rejected: "Ditolak kasir",
    cancelled: "Dibatalkan",
};

const productPlaceholder = (title = "Menu") =>
    `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
            <rect width="120" height="120" rx="24" fill="#e2e8f0"/>
            <rect x="18" y="18" width="84" height="84" rx="18" fill="#f8fafc"/>
            <text x="60" y="68" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#334155">
                ${(title || "M").trim().slice(0, 1).toUpperCase()}
            </text>
        </svg>
    `)}`;

const sanitizePhoneNumber = (value = "") =>
    String(value)
        .replace(/[^\d+]/g, "")
        .replace(/(?!^)\+/g, "")
        .slice(0, 16);

const isValidPhoneNumber = (value = "") =>
    /^(?:\+62|62|0)[0-9]{8,13}$/.test(String(value).trim());

const recommendationTone = {
    promo: {
        eyebrow: "Promo Favorit Hari Ini",
        title: "Menu spesial, harga lebih seru",
        description: "Pilihan promo terbaik yang paling sayang untuk dilewatkan.",
        accent: "text-rose-600",
        chip: "bg-rose-50 text-rose-700 border-rose-200",
        button: "bg-rose-500 text-white shadow-lg shadow-rose-500/25",
    },
    best_sellers: {
        eyebrow: "Favorit Banyak Orang",
        title: "Menu andalan yang paling dicari",
        description: "Rekomendasi aman kalau ingin pilih yang paling laris.",
        accent: "text-amber-600",
        chip: "bg-amber-50 text-amber-700 border-amber-200",
        button: "bg-amber-500 text-white shadow-lg shadow-amber-500/25",
    },
    history: {
        eyebrow: "Favoritmu Sebelumnya",
        title: "Pesan lagi tanpa mikir lama",
        description: "Menu yang pernah kamu pilih, siap dipesan lagi lebih cepat.",
        accent: "text-emerald-600",
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
        button: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25",
    },
};

function RecommendationStrip({
    sectionKey,
    products = [],
    onPick,
}) {
    const railRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [activePage, setActivePage] = useState(0);

    const pageCount = Math.max(1, Math.ceil(products.length / 3));

    if (!products.length) {
        return null;
    }

    const tone = recommendationTone[sectionKey] || recommendationTone.promo;
    const syncRailState = () => {
        if (!railRef.current) {
            return;
        }

        const { scrollLeft, scrollWidth, clientWidth } = railRef.current;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const nextPageCount = Math.max(1, Math.ceil(scrollWidth / Math.max(clientWidth, 1)));
        const nextActivePage = Math.min(
            nextPageCount - 1,
            Math.max(0, Math.round(scrollLeft / Math.max(clientWidth, 1)))
        );

        setCanScrollLeft(scrollLeft > 8);
        setCanScrollRight(scrollLeft < maxScrollLeft - 8);
        setActivePage(nextActivePage);
    };

    const scrollRail = (direction) => {
        if (!railRef.current) {
            return;
        }

        railRef.current.scrollBy({
            left: direction * 260,
            behavior: "smooth",
        });
    };

    useEffect(() => {
        syncRailState();

        const currentRail = railRef.current;

        if (!currentRail) {
            return undefined;
        }

        currentRail.addEventListener("scroll", syncRailState, { passive: true });
        window.addEventListener("resize", syncRailState);

        return () => {
            currentRail.removeEventListener("scroll", syncRailState);
            window.removeEventListener("resize", syncRailState);
        };
    }, [products.length]);

    return (
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${tone.accent}`}>
                        {tone.eyebrow}
                    </p>
                    <h3 className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950">
                        {tone.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                        {tone.description}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${tone.chip}`}>
                        {products.length} menu
                    </span>
                </div>
            </div>

            <div className="relative mt-4">
                <button
                    type="button"
                    onClick={() => scrollRail(-1)}
                    disabled={!canScrollLeft}
                    className={`absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg backdrop-blur transition sm:inline-flex ${
                        canScrollLeft
                            ? "border-slate-200 bg-white/95 text-slate-700 hover:bg-white"
                            : "border-slate-100 bg-white/75 text-slate-300 opacity-80"
                    }`}
                    aria-label={`Geser ${tone.title} ke kiri`}
                >
                    &larr;
                </button>
                <button
                    type="button"
                    onClick={() => scrollRail(1)}
                    disabled={!canScrollRight}
                    className={`absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg backdrop-blur transition sm:inline-flex ${
                        canScrollRight
                            ? "border-slate-200 bg-white/95 text-slate-700 hover:bg-white"
                            : "border-slate-100 bg-white/75 text-slate-300 opacity-80"
                    }`}
                    aria-label={`Geser ${tone.title} ke kanan`}
                >
                    &rarr;
                </button>
                <div
                    ref={railRef}
                    className="grid auto-cols-[78vw] grid-flow-col gap-3 overflow-x-auto pb-1 overscroll-x-contain touch-pan-x sm:auto-cols-[220px] sm:px-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {products.map((product) => {
                        const promo = promoDisplay(product);
                        const promoDetail = promoExplanation(product);

                        return (
                        <button
                            key={`${sectionKey}-${product.id}`}
                            type="button"
                            onClick={() => onPick(product)}
                            className="group relative w-[78vw] max-w-full min-w-0 overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:w-[220px] sm:max-w-[220px]"
                        >
                            <div className="relative">
                                <img
                                    src={product.image || productPlaceholder(product.title)}
                                    alt={product.title}
                                        className="h-28 w-full rounded-[18px] object-cover"
                                        onError={(event) => {
                                            event.currentTarget.src = productPlaceholder(product.title);
                                        }}
                                    />
                                    <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone.button}`}>
                                        {tone.eyebrow}
                                    </span>
                                    <span className="pointer-events-none absolute inset-x-4 top-1/2 hidden -translate-y-1/2 rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#ef4444_100%)] px-4 py-3 text-center text-sm font-bold tracking-[0.01em] text-white shadow-2xl shadow-slate-900/25 sm:block sm:scale-95 sm:opacity-0 sm:transition sm:duration-200 sm:group-hover:scale-100 sm:group-hover:opacity-100">
                                        Tambah ke Pesanan
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                                                {product.title}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {product.category?.name || "Lainnya"}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                            Stok {product.stock || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-end gap-2">
                                    <span className={`text-sm font-black ${promo.showPromo ? "text-rose-600" : "text-slate-900"}`}>
                                        {formatPrice(
                                            promo.showPromo
                                                ? promo.promoPrice
                                                : product.sell_price
                                        )}
                                    </span>
                                    {promo.showPromo ? (
                                        <>
                                            <span className="text-[11px] text-slate-400 line-through">
                                                {formatPrice(promo.basePrice)}
                                            </span>
                                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                                Hemat{" "}
                                                {formatPrice(
                                                    Math.max(
                                                        0,
                                                        promo.basePrice - promo.promoPrice
                                                    )
                                                )}
                                            </span>
                                        </>
                                    ) : null}
                                </div>
                                {promoDetail ? (
                                    <p className="mt-2 text-xs leading-5 text-rose-600">
                                        {promoDetail}
                                    </p>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                {pageCount > 1 ? (
                    <div className="mt-4 flex items-center justify-center gap-2">
                        {Array.from({ length: pageCount }).map((_, index) => (
                            <span
                                key={`${sectionKey}-page-${index}`}
                                className={`h-2 rounded-full transition-all ${
                                    index === activePage
                                        ? "w-6 bg-slate-900"
                                        : "w-2 bg-slate-300"
                                }`}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export default function Menu({
    table,
    outlet,
    products = [],
    identity,
    recommendations = {},
}) {
    const { flash, storeProfile } = usePage().props;
    const checkoutSectionRef = useRef(null);
    const promoHighlightRailRef = useRef(null);
    const identifyPhoneInputRef = useRef(null);
    const registerNameInputRef = useRef(null);
    const [promoCanScrollLeft, setPromoCanScrollLeft] = useState(false);
    const [promoCanScrollRight, setPromoCanScrollRight] = useState(false);
    const [promoActivePage, setPromoActivePage] = useState(0);
    const [cartLines, setCartLines] = useState([]);
    const [modifierModalProduct, setModifierModalProduct] = useState(null);
    const [selectedModifierOptionIds, setSelectedModifierOptionIds] = useState(
        []
    );
    const [isModifierModalSubmitting, setIsModifierModalSubmitting] =
        useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [activeMobileTab, setActiveMobileTab] = useState("products");
    const [showOrderGuide, setShowOrderGuide] = useState(false);
    const [showCustomerHistory, setShowCustomerHistory] = useState(false);
    const [showFloatingCheckout, setShowFloatingCheckout] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const customer = identity?.customer || null;
    const pendingPhone = identity?.pending_phone || "";
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];
    const recommendationGroups = useMemo(
        () => ({
            promo: recommendations?.promo || [],
            best_sellers: recommendations?.best_sellers || [],
            history: recommendations?.history || [],
        }),
        [recommendations]
    );
    const cartStorageKey = customer?.id
        ? `table-order-cart:${table.qr_token}:${customer.id}`
        : null;

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

    const categoryOptions = useMemo(() => {
        const grouped = products.reduce((accumulator, product) => {
            const categoryName = product.category?.name || "Lainnya";
            accumulator[categoryName] = (accumulator[categoryName] || 0) + 1;
            return accumulator;
        }, {});

        const categoryItems = Object.entries(grouped)
            .sort(([left], [right]) => left.localeCompare(right, "id"))
            .map(([label, count]) => ({
                key: label,
                label,
                count,
                isPromo: false,
            }));

        const promoCount = products.filter((product) => productHasPromo(product)).length;

        return [
            {
                key: "all",
                label: "Semua",
                count: products.length,
                isPromo: false,
            },
            {
                key: "promo",
                label: "Promo",
                count: promoCount,
                isPromo: true,
            },
            ...categoryItems,
        ];
    }, [products]);

    const promoProducts = useMemo(
        () => products.filter((product) => productHasPromo(product)),
        [products]
    );
    const spotlightProducts = useMemo(() => {
        const promoFirst = [...promoProducts];
        const fallback = products.filter(
            (product) => !productHasPromo(product) && Number(product.stock || 0) > 0
        );

        return [...promoFirst, ...fallback].slice(0, 8);
    }, [products, promoProducts]);
    const promoHighlightPageCount = Math.max(
        1,
        Math.ceil(Math.min(promoProducts.length, 6) / 3)
    );
    const syncPromoHighlightState = () => {
        if (!promoHighlightRailRef.current) {
            return;
        }

        const { scrollLeft, scrollWidth, clientWidth } = promoHighlightRailRef.current;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const nextPageCount = Math.max(1, Math.ceil(scrollWidth / Math.max(clientWidth, 1)));
        const nextActivePage = Math.min(
            nextPageCount - 1,
            Math.max(0, Math.round(scrollLeft / Math.max(clientWidth, 1)))
        );

        setPromoCanScrollLeft(scrollLeft > 8);
        setPromoCanScrollRight(scrollLeft < maxScrollLeft - 8);
        setPromoActivePage(nextActivePage);
    };
    const scrollPromoHighlight = (direction) => {
        if (!promoHighlightRailRef.current) {
            return;
        }

        promoHighlightRailRef.current.scrollBy({
            left: direction * 240,
            behavior: "smooth",
        });
    };

    useEffect(() => {
        syncPromoHighlightState();

        const currentRail = promoHighlightRailRef.current;

        if (!currentRail) {
            return undefined;
        }

        currentRail.addEventListener("scroll", syncPromoHighlightState, {
            passive: true,
        });
        window.addEventListener("resize", syncPromoHighlightState);

        return () => {
            currentRail.removeEventListener("scroll", syncPromoHighlightState);
            window.removeEventListener("resize", syncPromoHighlightState);
        };
    }, [promoProducts.length]);

    useEffect(() => {
        if (customer) {
            document.body.style.overflow = "";
            return undefined;
        }

        document.body.style.overflow = "hidden";
        setSidebarOpen(false);
        setActiveMobileTab("products");

        const focusTimer = window.setTimeout(() => {
            if (pendingPhone) {
                registerNameInputRef.current?.focus();
                return;
            }

            identifyPhoneInputRef.current?.focus();
        }, 60);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = "";
        };
    }, [customer, pendingPhone]);

    const focusProductInCatalog = (product) => {
        setSearchQuery(product?.title || "");
        setSelectedCategory(
            productHasPromo(product)
                ? "promo"
                : product?.category?.name || "all"
        );
    };
    const handleRecommendationPick = (product) => {
        focusProductInCatalog(product);
        handleAddProduct(product);
    };

    const filteredProducts = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return products
            .filter((product) => {
                const categoryName = product.category?.name || "Lainnya";
                const matchesCategory =
                    selectedCategory === "all" ||
                    (selectedCategory === "promo" && productHasPromo(product)) ||
                    categoryName === selectedCategory;
                const haystack = [
                    product.title,
                    product.description,
                    categoryName,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                const matchesQuery =
                    normalizedQuery.length === 0 ||
                    haystack.includes(normalizedQuery);

                return matchesCategory && matchesQuery;
            })
            .sort((a, b) => {
                const categoryCompare = (a.category?.name || "Lainnya").localeCompare(
                    b.category?.name || "Lainnya",
                    "id"
                );

                if (categoryCompare !== 0) {
                    return categoryCompare;
                }

                return String(a.title || "").localeCompare(
                    String(b.title || ""),
                    "id"
                );
            });
    }, [products, searchQuery, selectedCategory]);

    const groupedProducts = useMemo(() => {
        return filteredProducts.reduce((acc, product) => {
            const key = product.category?.name || "Lainnya";
            acc[key] = acc[key] || [];
            acc[key].push(product);
            return acc;
        }, {});
    }, [filteredProducts]);
    const filteredProductCount = filteredProducts.length;

    const cartItems = useMemo(() => {
        return cartLines.map((line) => {
            const modifierUnitTotal = lineModifierUnitTotal(line.modifiers);
            const unitTotal = Number(line.unit_price || 0) + modifierUnitTotal;

            return {
                ...line,
                modifier_unit_total: modifierUnitTotal,
                unit_total: unitTotal,
                line_total: unitTotal * Number(line.qty || 0),
            };
        });
    }, [cartLines]);

    const grandTotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.line_total, 0),
        [cartItems]
    );

    const hasPresetModifiers = (product) =>
        Array.isArray(product?.modifier_options) &&
        product.modifier_options.length > 0;

    const createCartLine = (product, modifiers = []) => ({
        key: `line-${product.id}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        product_id: product.id,
        title: product.title,
        qty: 1,
        notes: "",
        unit_price: resolvedProductUnitPrice(product),
        modifiers: modifiers.map((modifier) => ({
            id: modifier.id,
            name: modifier.name,
            price: Number(modifier.price || 0),
        })),
    });

    const updatePlainQty = (product, nextQty) => {
        const safeQty = Math.max(0, Number(nextQty || 0));

        setCartLines((current) => {
            const existingIndex = current.findIndex(
                (line) =>
                    line.product_id === product.id &&
                    (!line.modifiers || line.modifiers.length === 0)
            );

            if (safeQty === 0) {
                if (existingIndex < 0) {
                    return current;
                }

                return current.filter((_, index) => index !== existingIndex);
            }

            if (existingIndex >= 0) {
                return current.map((line, index) =>
                    index === existingIndex
                        ? {
                              ...line,
                              qty: Math.min(safeQty, Number(product.stock || 0)),
                          }
                        : line
                );
            }

            return [
                ...current,
                {
                    ...createCartLine(product),
                    qty: Math.min(safeQty, Number(product.stock || 0)),
                },
            ];
        });
    };

    const updateLineQty = (lineKey, nextQty, maxStock) => {
        const safeQty = Math.max(0, Number(nextQty || 0));

        setCartLines((current) => {
            if (safeQty === 0) {
                return current.filter((line) => line.key !== lineKey);
            }

            return current.map((line) =>
                line.key === lineKey
                    ? {
                          ...line,
                          qty: Math.min(safeQty, Number(maxStock || safeQty)),
                      }
                    : line
            );
        });
    };

    const updateLineNotes = (lineKey, notes) => {
        setCartLines((current) =>
            current.map((line) =>
                line.key === lineKey
                    ? {
                          ...line,
                          notes,
                      }
                    : line
            )
        );
    };

    const handleAddProduct = (product) => {
        if (hasPresetModifiers(product)) {
            setModifierModalProduct(product);
            setSelectedModifierOptionIds([]);
            return;
        }

        updatePlainQty(product, plainProductQty(product.id) + 1);
        toast.success(`${product.title} ditambahkan`);
    };

    const closeModifierModal = () => {
        if (isModifierModalSubmitting) {
            return;
        }

        setModifierModalProduct(null);
        setSelectedModifierOptionIds([]);
    };

    const toggleModifierOption = (optionId) => {
        setSelectedModifierOptionIds((current) =>
            current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : [...current, optionId]
        );
    };

    const submitModifierModal = (includeModifiers) => {
        if (!modifierModalProduct?.id) {
            return;
        }

        setIsModifierModalSubmitting(true);

        const selectedModifiers = includeModifiers
            ? (modifierModalProduct.modifier_options || []).filter((option) =>
                  selectedModifierOptionIds.includes(option.id)
              )
            : [];

        setCartLines((current) => [
            ...current,
            createCartLine(modifierModalProduct, selectedModifiers),
        ]);

        setIsModifierModalSubmitting(false);
        setModifierModalProduct(null);
        setSelectedModifierOptionIds([]);
        toast.success(`${modifierModalProduct.title} ditambahkan`);
    };

    const submitOrder = (event) => {
        event?.preventDefault?.();

        if (cartItems.length === 0) {
            toast.error("Pilih minimal satu menu.");
            return;
        }

        orderForm.transform((data) => ({
            ...data,
            items: cartItems.map((item) => ({
                product_id: item.product_id,
                qty: item.qty,
                notes: item.notes || null,
                modifiers: (item.modifiers || []).map((modifier) => ({
                    id: modifier.id,
                })),
            })),
        }));

        orderForm.post(route("table-order.store", table.qr_token), {
            preserveScroll: true,
            onSuccess: () => {
                if (cartStorageKey && typeof window !== "undefined") {
                    window.localStorage.removeItem(cartStorageKey);
                }

                setCartLines([]);
                orderForm.setData("notes", "");
            },
        });
    };

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
        orderForm.setData("notes", "");
        logoutForm.post(route("table-order.logout", table.qr_token), {
            preserveScroll: true,
        });
    };

    const productOrderCount = (productId) =>
        cartLines
            .filter((line) => line.product_id === productId)
            .reduce((sum, line) => sum + Number(line.qty || 0), 0);

    const plainProductQty = (productId) =>
        cartLines
            .filter(
                (line) =>
                    line.product_id === productId &&
                    (!line.modifiers || line.modifiers.length === 0)
            )
            .reduce((sum, line) => sum + Number(line.qty || 0), 0);

    const lowStockLabel = (stock) =>
        Number(stock || 0) > 0 && Number(stock || 0) <= 5
            ? `Sisa ${stock}`
            : null;

    const showMobileCheckoutBar = customer && cartItems.length > 0;

    const scrollToCheckout = () => {
        checkoutSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    const openCheckoutView = () => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setActiveMobileTab("cart");

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    scrollToCheckout();
                });
            });

            return;
        }

        scrollToCheckout();
    };

    useEffect(() => {
        if (!cartStorageKey || typeof window === "undefined") {
            setCartLines([]);
            orderForm.setData("notes", "");
            return;
        }

        try {
            const storedPayload = window.localStorage.getItem(cartStorageKey);

            if (!storedPayload) {
                setCartLines([]);
                orderForm.setData("notes", "");
                return;
            }

            const parsedPayload = JSON.parse(storedPayload);
            const productMap = new Map(products.map((product) => [product.id, product]));
            const restoredLines = Array.isArray(parsedPayload?.cartLines)
                ? parsedPayload.cartLines
                      .map((line) => {
                          const product = productMap.get(line.product_id);

                          if (!product) {
                              return null;
                          }

                          return {
                              ...line,
                              qty: Math.max(
                                  1,
                                  Math.min(
                                      Number(line.qty || 1),
                                      Number(product.stock || line.qty || 1)
                                  )
                              ),
                              unit_price: resolvedProductUnitPrice(product) || Number(line.unit_price || 0),
                              modifiers: Array.isArray(line.modifiers)
                                  ? line.modifiers.map((modifier) => ({
                                        id: modifier.id,
                                        name: modifier.name,
                                        price: Number(modifier.price || 0),
                                    }))
                                  : [],
                          };
                      })
                      .filter(Boolean)
                : [];

            setCartLines(restoredLines);
            orderForm.setData("notes", parsedPayload?.notes || "");
        } catch {
            setCartLines([]);
            orderForm.setData("notes", "");
        }
    }, [cartStorageKey, products]);

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
        if (typeof window === "undefined") {
            return undefined;
        }

        const syncFloatingCheckout = () => {
            const shouldShow =
                window.innerWidth < 1024 &&
                activeMobileTab === "products" &&
                cartItems.length > 0 &&
                window.scrollY > 280;

            setShowFloatingCheckout(shouldShow);
        };

        syncFloatingCheckout();
        window.addEventListener("scroll", syncFloatingCheckout, {
            passive: true,
        });
        window.addEventListener("resize", syncFloatingCheckout);

        return () => {
            window.removeEventListener("scroll", syncFloatingCheckout);
            window.removeEventListener("resize", syncFloatingCheckout);
        };
    }, [activeMobileTab, cartItems.length]);

    return (
        <>
            <Head title={`Order ${table.name}`} />

            {/* Sidebar overlay */}
            {sidebarOpen ? (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            ) : null}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-[70] w-[300px] max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex h-full flex-col overflow-hidden">
                    {/* Sidebar header */}
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                        <div>
                            <p className="text-sm font-bold text-slate-900">Menu</p>
                            <p className="text-xs text-slate-500">Meja {table.code || table.name}</p>
                        </div>
                        <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                    </div>

                    {/* Sidebar content */}
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        {/* Info Meja */}
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Info Meja</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">Meja {table.code || table.name}</p>
                            <p className="text-xs text-slate-500">Kapasitas {table.capacity || 0} kursi</p>
                        </div>

                        {/* Customer info */}
                        {customer ? (
                            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pelanggan</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{customer.name || "Pelanggan"}</p>
                                {customer.no_telp ? <p className="text-xs text-slate-500">{customer.no_telp}</p> : null}
                                {customer.loyalty_points ? <p className="mt-1 text-xs text-emerald-600 font-medium">{customer.loyalty_points} poin loyalti</p> : null}
                            </div>
                        ) : null}

                        {/* History pesanan */}
                        <div className="mb-4">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Riwayat Pesanan</p>
                            {recentOrders.length > 0 ? (
                                <div className="space-y-2">
                                    {recentOrders.map((order) => (
                                        <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-800">{order.order_number}</p>
                                                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                        {orderStatusLabel[order.status] || order.status}
                                                    </span>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold text-slate-800">{formatPrice(order.grand_total)}</p>
                                            </div>
                                            {order.access_token ? (
                                                <Link href={route("table-order.status", order.access_token)} className="mt-2 inline-flex text-xs font-medium text-sky-700">
                                                    Lihat status →
                                                </Link>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : recentTransactions.length > 0 ? (
                                <div className="space-y-2">
                                    {recentTransactions.map((transaction) => (
                                        <div key={transaction.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-800">{transaction.invoice}</p>
                                                    <p className="text-xs capitalize text-slate-500">{transaction.payment_status}</p>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold text-slate-800">{formatPrice(transaction.grand_total)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Belum ada riwayat pesanan.</p>
                            )}
                        </div>

                        {/* Outlet info */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outlet</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{outlet?.name || storeProfile?.name || "Outlet"}</p>
                            <p className="text-xs text-slate-500">Pembayaran di kasir</p>
                        </div>
                    </div>

                    {/* Sidebar footer */}
                    {customer ? (
                        <div className="border-t border-slate-200 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => { logoutForm.post(route("table-order.logout", table.qr_token), { preserveScroll: true }); setSidebarOpen(false); }}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Keluar akun
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Sidebar toggle button */}
            <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur sm:left-5 sm:top-5"
                aria-label="Buka menu"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>

            <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_34%),linear-gradient(180deg,_#eef4ff_0%,_#f8fafc_22%,_#f8fafc_100%)] text-slate-900">
                <div
                    className={`mx-auto max-w-7xl overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6 ${
                        showMobileCheckoutBar ? "pb-28 lg:pb-10" : ""
                    }`}
                >
                    <div className="relative mb-4 overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(15,23,42,0.97)_0%,_rgba(30,41,59,0.95)_52%,_rgba(8,47,73,0.94)_100%)] p-5 text-white shadow-[0_30px_90px_-42px_rgba(15,23,42,0.78)] sm:mb-6 sm:p-6">
                        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-12 left-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-3xl" />
                        <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/15 bg-white/95 shadow-lg shadow-slate-950/20">
                                        {storeProfile?.logo ? (
                                            <img
                                                src={storeProfile.logo}
                                                alt={storeProfile?.name || "Logo toko"}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-xl font-black text-slate-900">
                                                {(storeProfile?.name || outlet?.name || "S")
                                                    .slice(0, 1)
                                                    .toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">
                                            Self Order
                                        </p>
                                        <p className="mt-1 truncate text-sm font-medium text-slate-300">
                                            {outlet?.name || storeProfile?.name || "Outlet"}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                                        Meja {table.code || table.name}
                                    </span>
                                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                                        Bayar nanti di kasir
                                    </span>
                                </div>
                            </div>
                        </div>
                        {flash?.success ? (
                            <div className="relative mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/12 px-4 py-3 text-sm text-emerald-100">
                                {flash.success}
                            </div>
                        ) : null}
                        {flash?.info ? (
                            <div className="relative mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/12 px-4 py-3 text-sm text-amber-100">
                                {flash.info}
                            </div>
                        ) : null}
                        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">
                                    Menu Aktif
                                </p>
                                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                                    {products.length}
                                </p>
                                <p className="mt-1 text-xs text-slate-300">
                                    Siap dipilih dari meja ini
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("promo")}
                                className="rounded-[22px] border border-rose-300/25 bg-[linear-gradient(135deg,_rgba(244,63,94,0.22)_0%,_rgba(251,113,133,0.14)_100%)] px-4 py-4 text-left backdrop-blur transition hover:border-rose-300/40"
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100">
                                    Promo Hari Ini
                                </p>
                                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                                    {promoProducts.length}
                                </p>
                                <p className="mt-1 text-xs text-rose-100/80">
                                    Tab promo langsung disorot
                                </p>
                            </button>
                            <div className="rounded-[22px] border border-emerald-300/20 bg-[linear-gradient(135deg,_rgba(16,185,129,0.18)_0%,_rgba(52,211,153,0.08)_100%)] px-4 py-4 backdrop-blur">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                                    Pesanan Anda
                                </p>
                                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                                    {cartItems.length}
                                </p>
                                <p className="mt-1 text-xs text-emerald-100/80">
                                    Item ada di keranjang
                                </p>
                            </div>
                        </div>
                    </div>

                    {!customer ? (
                        <div className="relative z-0 min-h-[58vh] overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/45 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)] backdrop-blur-sm">
                            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(248,250,252,0.45)_0%,_rgba(226,232,240,0.65)_100%)]" />
                            <div className="relative z-[1] grid gap-4 p-5 opacity-80 sm:grid-cols-3 sm:p-6">
                                {[
                                    ["Akses dikunci", "Nomor HP wajib sebelum katalog dan keranjang aktif."],
                                    ["Promo tetap aman", "Promo customer dan histori hanya terbaca setelah identitas terhubung."],
                                    ["Bayar nanti di kasir", "Order tetap diproses normal setelah login dengan nomor HP."],
                                ].map(([title, helper]) => (
                                    <div
                                        key={title}
                                        className="rounded-[22px] border border-white/70 bg-white/75 px-4 py-4 shadow-sm backdrop-blur"
                                    >
                                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-500">{helper}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 grid grid-cols-2 rounded-[22px] border border-slate-200 bg-white p-1 shadow-sm lg:hidden">
                                <button
                                    type="button"
                                    onClick={() => setActiveMobileTab("products")}
                                    className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition ${
                                        activeMobileTab === "products"
                                            ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                                            : "text-slate-600"
                                    }`}
                                >
                                    Produk
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveMobileTab("cart")}
                                    className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition ${
                                        activeMobileTab === "cart"
                                            ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                                            : "text-slate-600"
                                    }`}
                                >
                                    Keranjang
                                    {cartItems.length > 0 ? (
                                        <span
                                            className={`ml-2 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                                                activeMobileTab === "cart"
                                                    ? "bg-white/15 text-white"
                                                    : "bg-slate-100 text-slate-700"
                                            }`}
                                        >
                                            {cartItems.length}
                                        </span>
                                    ) : null}
                                </button>
                            </div>

                        <div className="min-w-0 overflow-x-hidden grid gap-5 lg:grid-cols-[minmax(0,1.35fr),380px] xl:grid-cols-[minmax(0,1.45fr),420px]">
                            <div
                                className={`min-w-0 overflow-x-hidden space-y-4 sm:space-y-5 ${
                                    activeMobileTab === "products"
                                        ? "block"
                                        : "hidden lg:block"
                                }`}
                            >
                                <section className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_20px_70px_-38px_rgba(15,23,42,0.28)] sm:rounded-[28px]">
                                    <div className="border-b border-slate-100 bg-[linear-gradient(135deg,_rgba(15,23,42,0.04)_0%,_rgba(14,165,233,0.07)_100%)] px-3 py-3 sm:px-5 sm:py-4">
                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                                                    Katalog Menu
                                                </p>
                                                <h2 className="mt-1.5 break-words text-[1.15rem] font-bold tracking-[-0.03em] text-slate-950 sm:mt-2 sm:text-[1.7rem]">
                                                    Pilih menu favorit Anda
                                                </h2>
                                                <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                                                    Cari menu dengan cepat, lalu pilih kategori yang diinginkan.
                                                </p>
                                            </div>
                                            <div className="min-w-0 w-full lg:max-w-sm">
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(event) =>
                                                        setSearchQuery(
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Cari menu, minuman, atau snack..."
                                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 sm:h-12 sm:rounded-2xl sm:px-4"
                                                />
                                            </div>
                                        </div>
                                        {promoProducts.length > 0 ? (
                                            <div className="mt-4 overflow-hidden rounded-[24px] border border-rose-200 bg-[linear-gradient(135deg,_#fff1f2_0%,_#fff7ed_100%)] p-3 sm:p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
                                                            Highlight Promo
                                                        </p>
                                                        <h3 className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950">
                                                            Menu yang sedang turun harga
                                                        </h3>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Tap tab promo atau pilih langsung dari deretan menu ini.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCategory("promo")}
                                                        className="inline-flex rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/25"
                                                    >
                                                        Lihat Semua Promo
                                                    </button>
                                                </div>
                                                <div className="relative mt-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => scrollPromoHighlight(-1)}
                                                        disabled={!promoCanScrollLeft}
                                                        className={`absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg backdrop-blur transition sm:inline-flex ${
                                                            promoCanScrollLeft
                                                                ? "border-rose-200 bg-white/95 text-rose-700 hover:bg-white"
                                                                : "border-rose-100 bg-white/75 text-rose-300 opacity-80"
                                                        }`}
                                                        aria-label="Geser promo ke kiri"
                                                    >
                                                        &larr;
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => scrollPromoHighlight(1)}
                                                        disabled={!promoCanScrollRight}
                                                        className={`absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg backdrop-blur transition sm:inline-flex ${
                                                            promoCanScrollRight
                                                                ? "border-rose-200 bg-white/95 text-rose-700 hover:bg-white"
                                                                : "border-rose-100 bg-white/75 text-rose-300 opacity-80"
                                                        }`}
                                                        aria-label="Geser promo ke kanan"
                                                    >
                                                        &rarr;
                                                    </button>
                                                    <div
                                                        ref={promoHighlightRailRef}
                                                        className="grid auto-cols-[76vw] grid-flow-col gap-3 overflow-x-auto pb-1 sm:auto-cols-[210px] sm:px-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                                    >
                                                        {promoProducts.slice(0, 6).map((product) => {
                                                            const promo = promoDisplay(product);

                                                            return (
                                                                <button
                                                                    key={`promo-${product.id}`}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        focusProductInCatalog(product);
                                                                        handleAddProduct(product);
                                                                    }}
                                                                    className="group relative w-[76vw] max-w-full min-w-0 overflow-hidden rounded-[22px] border border-white/70 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:w-[210px] sm:max-w-[210px]"
                                                                >
                                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                                                        <img
                                                                            src={product.image || productPlaceholder(product.title)}
                                                                            alt={product.title}
                                                                            className="h-24 w-full rounded-2xl object-cover sm:h-16 sm:w-16"
                                                                            onError={(event) => {
                                                                                event.currentTarget.src = productPlaceholder(product.title);
                                                                            }}
                                                                        />
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                                                                                {product.title}
                                                                            </p>
                                                                            <p className="mt-1 text-xs text-slate-500">
                                                                                {product.category?.name || "Lainnya"}
                                                                            </p>
                                                                            <div className="mt-2 flex items-end gap-2">
                                                                                <span className="text-sm font-black text-rose-600">
                                                                                    {formatPrice(promo.promoPrice)}
                                                                                </span>
                                                                                <span className="text-[11px] text-slate-400 line-through">
                                                                                    {formatPrice(promo.basePrice)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <span className="pointer-events-none absolute inset-x-4 top-1/2 hidden -translate-y-1/2 rounded-2xl bg-[linear-gradient(135deg,_#7f1d1d_0%,_#f43f5e_100%)] px-4 py-3 text-center text-sm font-bold tracking-[0.01em] text-white shadow-2xl shadow-rose-500/25 sm:block sm:scale-95 sm:opacity-0 sm:transition sm:duration-200 sm:group-hover:scale-100 sm:group-hover:opacity-100">
                                                                        Tambah ke Pesanan
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {promoHighlightPageCount > 1 ? (
                                                        <div className="mt-4 flex items-center justify-center gap-2">
                                                            {Array.from({
                                                                length: promoHighlightPageCount,
                                                            }).map((_, index) => (
                                                                <span
                                                                    key={`promo-highlight-page-${index}`}
                                                                    className={`h-2 rounded-full transition-all ${
                                                                        index === promoActivePage
                                                                            ? "w-6 bg-rose-500"
                                                                            : "w-2 bg-rose-200"
                                                                    }`}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="sticky top-0 z-10 mt-3 border-y border-slate-100 bg-white/90 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                                        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {categoryOptions.map((category) => {
                                                const active =
                                                    selectedCategory ===
                                                    category.key;

                                                return (
                                                    <button
                                                        key={category.key}
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedCategory(
                                                                category.key
                                                            )
                                                        }
                                                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition duration-200 sm:px-4 sm:py-2 sm:text-sm ${
                                                            active
                                                                ? category.isPromo
                                                                    ? "translate-y-[-1px] bg-[linear-gradient(135deg,_#f43f5e_0%,_#fb7185_100%)] text-white shadow-lg shadow-rose-500/30 ring-4 ring-rose-100"
                                                                    : "translate-y-[-1px] bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                                                                : category.isPromo
                                                                    ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <span>{category.label}</span>
                                                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                                                active
                                                                    ? "bg-white/15 text-white"
                                                                    : category.isPromo
                                                                        ? "bg-white text-rose-600"
                                                                        : "bg-slate-100 text-slate-500"
                                                            }`}>
                                                                {category.count}
                                                            </span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 sm:px-3 sm:py-1.5">
                                                {filteredProductCount} menu tampil
                                            </span>
                                            {selectedCategory !== "all" ? (
                                                <span className={`rounded-full px-2.5 py-1 font-semibold sm:px-3 sm:py-1.5 ${
                                                    selectedCategory === "promo"
                                                        ? "bg-rose-50 text-rose-700"
                                                        : "bg-sky-50 text-sky-700"
                                                }`}>
                                                    {selectedCategory}
                                                </span>
                                            ) : null}
                                            {searchQuery.trim() ? (
                                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 sm:px-3 sm:py-1.5">
                                                    Cari: {searchQuery.trim()}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="min-w-0 overflow-x-hidden p-3 sm:p-5">
                                        {spotlightProducts.length > 0 ? (
                                            <section className="mb-5 overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,_rgba(15,23,42,0.02)_0%,_rgba(14,165,233,0.06)_100%)] p-3 sm:p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                                                            Pilihan Cepat
                                                        </p>
                                                        <h3 className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950">
                                                            Menu yang layak dicoba sekarang
                                                        </h3>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Promo diprioritaskan, sisanya menu siap pesan dengan stok aman.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedCategory("all");
                                                            setSearchQuery("");
                                                        }}
                                                        className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                                                    >
                                                        Reset Jelajah
                                                    </button>
                                                </div>
                                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                    {spotlightProducts.map((product, index) => {
                                                        const promo = promoDisplay(product);

                                                        return (
                                                            <button
                                                                key={`spotlight-${product.id}`}
                                                                type="button"
                                                                onClick={() => {
                                                                    focusProductInCatalog(product);
                                                                    handleAddProduct(product);
                                                                }}
                                                                className={`group relative min-w-0 overflow-hidden rounded-[22px] border bg-white p-3 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
                                                                    promo.showPromo
                                                                        ? "border-rose-200"
                                                                        : "border-slate-200"
                                                                }`}
                                                                style={{
                                                                    animationDelay: `${index * 60}ms`,
                                                                }}
                                                            >
                                                                <div className="relative">
                                                                    <img
                                                                        src={product.image || productPlaceholder(product.title)}
                                                                        alt={product.title}
                                                                        className="h-28 w-full rounded-[18px] object-cover"
                                                                        onError={(event) => {
                                                                            event.currentTarget.src = productPlaceholder(product.title);
                                                                        }}
                                                                    />
                                                                    {promo.showPromo ? (
                                                                        <span className="absolute left-2 top-2 rounded-full bg-[linear-gradient(135deg,_#f43f5e_0%,_#fb7185_100%)] px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg shadow-rose-500/30">
                                                                            Promo
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="mt-3">
                                                                    <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                                                                        {product.title}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {product.category?.name || "Lainnya"}
                                                                    </p>
                                                                    <div className="mt-2 flex flex-wrap items-end gap-2">
                                                                        <span className={`text-sm font-black ${
                                                                            promo.showPromo ? "text-rose-600" : "text-slate-900"
                                                                        }`}>
                                                                            {formatPrice(
                                                                                promo.showPromo
                                                                                    ? promo.promoPrice
                                                                                    : product.sell_price
                                                                            )}
                                                                        </span>
                                                                        {promo.showPromo ? (
                                                                            <span className="text-[11px] text-slate-400 line-through">
                                                                                {formatPrice(promo.basePrice)}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                                <span className="pointer-events-none absolute inset-x-4 top-1/2 hidden -translate-y-1/2 rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f766e_100%)] px-4 py-3 text-center text-sm font-bold tracking-[0.01em] text-white shadow-2xl shadow-slate-900/25 sm:block sm:scale-95 sm:opacity-0 sm:transition sm:duration-200 sm:group-hover:scale-100 sm:group-hover:opacity-100">
                                                                    Tambah ke Pesanan
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        ) : null}
                                        <div className="mb-5 space-y-4">
                                            <RecommendationStrip
                                                sectionKey="promo"
                                                products={recommendationGroups.promo}
                                                onPick={handleRecommendationPick}
                                            />
                                            <RecommendationStrip
                                                sectionKey="best_sellers"
                                                products={recommendationGroups.best_sellers}
                                                onPick={handleRecommendationPick}
                                            />
                                            <RecommendationStrip
                                                sectionKey="history"
                                                products={recommendationGroups.history}
                                                onPick={handleRecommendationPick}
                                            />
                                        </div>
                                        {Object.keys(groupedProducts).length === 0 ? (
                                            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                                                Tidak ada menu yang cocok dengan pencarian atau kategori ini.
                                            </div>
                                        ) : (
                                            <div className="space-y-5">
                                                {Object.entries(groupedProducts).map(
                                                    ([categoryName, items]) => (
                                                        <section key={categoryName}>
                                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                                                                    {categoryName}
                                                                </h3>
                                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:px-3 sm:text-xs">
                                                                    {items.length} menu
                                                                </span>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {items.map((product) => {
                                                                    const promo =
                                                                        promoDisplay(
                                                                            product
                                                                        );
                                                                    const promoDetail =
                                                                        promoExplanation(
                                                                            product
                                                                        );
                                                                    const hasStock =
                                                                        Number(
                                                                            product.stock || 0
                                                                        ) > 0;

                                                                    return (
                                                                        <article
                                                                            key={product.id}
                                                                            className={`group min-w-0 overflow-hidden rounded-[22px] border p-2.5 transition sm:rounded-[26px] sm:p-4 ${
                                                                                hasStock
                                                                                    ? promo.showPromo
                                                                                        ? "border-rose-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fff6f7_100%)] shadow-[0_18px_45px_-34px_rgba(244,63,94,0.45)]"
                                                                                        : "border-slate-200 bg-white shadow-[0_14px_40px_-34px_rgba(15,23,42,0.35)]"
                                                                                    : "border-slate-200 bg-slate-100/90 opacity-75"
                                                                            }`}
                                                                        >
                                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                                                                                <div className="relative shrink-0">
                                                                                    <img
                                                                                        src={
                                                                                            product.image ||
                                                                                            productPlaceholder(
                                                                                                product.title
                                                                                            )
                                                                                        }
                                                                                        alt={
                                                                                            product.title
                                                                                        }
                                                                                        className="h-40 w-full rounded-[18px] object-cover sm:h-28 sm:w-28 sm:rounded-[22px]"
                                                                                        onError={(
                                                                                            event
                                                                                        ) => {
                                                                                            event.currentTarget.src =
                                                                                                productPlaceholder(
                                                                                                    product.title
                                                                                                );
                                                                                        }}
                                                                                    />
                                                                                    {promo.badge?.label ? (
                                                                                        <span className="absolute left-2 top-2 max-w-[80%] truncate rounded-full bg-[linear-gradient(135deg,_#f43f5e_0%,_#fb7185_100%)] px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg shadow-rose-500/30">
                                                                                            {promo.badge.label}
                                                                                        </span>
                                                                                    ) : null}
                                                                                    {!hasStock ? (
                                                                                        <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-slate-950/60">
                                                                                            <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white">
                                                                                                Habis
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : null}
                                                                                </div>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                                        <div className="min-w-0">
                                                                                            <h3 className="break-words text-sm font-bold leading-5 text-slate-950 sm:text-base sm:leading-6">
                                                                                                {
                                                                                                    product.title
                                                                                                }
                                                                                            </h3>
                                                                                            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                                                                                                {product.description ||
                                                                                                    "Menu tersedia untuk self-order meja."}
                                                                                            </p>
                                                                                        </div>
                                                                                        {hasPresetModifiers(
                                                                                            product
                                                                                        ) ? (
                                                                                            <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 sm:px-3 sm:text-[11px]">
                                                                                                Extra tersedia
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </div>

                                                                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 sm:mt-3 sm:gap-2">
                                                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 sm:px-3 sm:py-1.5">
                                                                                            Stok{" "}
                                                                                            {
                                                                                                product.stock
                                                                                            }
                                                                                        </span>
                                                                                        {lowStockLabel(
                                                                                            product.stock
                                                                                        ) ? (
                                                                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 sm:px-3 sm:py-1.5">
                                                                                                {lowStockLabel(
                                                                                                    product.stock
                                                                                                )}
                                                                                            </span>
                                                                                        ) : null}
                                                                                        {product.kitchen_stations?.map(
                                                                                            (
                                                                                                station
                                                                                            ) => (
                                                                                                <span
                                                                                                    key={`${product.id}-${station.id || station.name}`}
                                                                                                    className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 sm:px-3 sm:py-1.5"
                                                                                                >
                                                                                                    {
                                                                                                        station.name
                                                                                                    }
                                                                                                </span>
                                                                                            )
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:mt-4 sm:pt-4 lg:grid lg:grid-cols-[minmax(0,1fr),220px] lg:items-end lg:gap-4">
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-base font-black tracking-[-0.03em] text-slate-950 sm:text-lg">
                                                                                                {formatPrice(
                                                                                                    promo.showPromo
                                                                                                        ? promo.promoPrice
                                                                                                        : product.sell_price
                                                                                                )}
                                                                                            </p>
                                                                                            {promo.showPromo ? (
                                                                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                                                    <p className="text-xs text-slate-400 line-through">
                                                                                                        {formatPrice(
                                                                                                            promo.basePrice
                                                                                                        )}
                                                                                                    </p>
                                                                                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                                                                                        Hemat {formatPrice(Math.max(0, promo.basePrice - promo.promoPrice))}
                                                                                                    </span>
                                                                                                </div>
                                                                                            ) : null}
                                                                                            {promoDetail ? (
                                                                                                <p className="mt-1.5 text-[11px] leading-5 text-rose-600 sm:text-xs">
                                                                                                    {promoDetail}
                                                                                                </p>
                                                                                            ) : null}
                                                                                            <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">
                                                                                                Dipilih{" "}
                                                                                                {productOrderCount(
                                                                                                    product.id
                                                                                                )}{" "}
                                                                                                item
                                                                                            </p>
                                                                                        </div>

                                                                                        {hasPresetModifiers(
                                                                                            product
                                                                                        ) ? (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    handleAddProduct(
                                                                                                        product
                                                                                                    )
                                                                                                }
                                                                                                disabled={
                                                                                                    !hasStock
                                                                                                }
                                                                                                className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f3b68_100%)] px-4 text-xs font-semibold text-white shadow-lg shadow-slate-900/15 disabled:opacity-50 sm:h-11 sm:rounded-2xl sm:px-5 sm:text-sm"
                                                                                            >
                                                                                                Tambah ke Pesanan
                                                                                            </button>
                                                                                        ) : (
                                                                                            <div className="w-full shrink-0">
                                                                                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() =>
                                                                                                            updatePlainQty(
                                                                                                                product,
                                                                                                                plainProductQty(
                                                                                                                    product.id
                                                                                                                ) -
                                                                                                                    1
                                                                                                            )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            !hasStock
                                                                                                        }
                                                                                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-slate-700 shadow-sm disabled:opacity-50"
                                                                                                    >
                                                                                                        -
                                                                                                    </button>
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        min="0"
                                                                                                        max={
                                                                                                            product.stock
                                                                                                        }
                                                                                                        value={plainProductQty(
                                                                                                            product.id
                                                                                                        )}
                                                                                                        onChange={(
                                                                                                            event
                                                                                                        ) =>
                                                                                                            updatePlainQty(
                                                                                                                product,
                                                                                                                event
                                                                                                                    .target
                                                                                                                    .value
                                                                                                            )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            !hasStock
                                                                                                        }
                                                                                                        className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold outline-none"
                                                                                                    />
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() =>
                                                                                                            updatePlainQty(
                                                                                                                product,
                                                                                                                plainProductQty(
                                                                                                                    product.id
                                                                                                                ) +
                                                                                                                    1
                                                                                                            )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            !hasStock
                                                                                                        }
                                                                                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-slate-700 shadow-sm disabled:opacity-50"
                                                                                                    >
                                                                                                        +
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </article>
                                                                    );
                                                                })}
                                                            </div>
                                                        </section>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div
                                ref={checkoutSectionRef}
                                className={`h-fit scroll-mt-24 rounded-[28px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_22px_80px_-40px_rgba(15,23,42,0.3)] sm:p-5 lg:sticky lg:top-6 ${
                                    activeMobileTab === "cart"
                                        ? "block"
                                        : "hidden lg:block"
                                }`}
                            >
                                <div className="rounded-[24px] bg-[linear-gradient(135deg,_rgba(15,23,42,0.97)_0%,_rgba(8,47,73,0.96)_100%)] p-4 text-white">
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
                                        Ringkasan Pesanan
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                                        Checkout meja
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">
                                        Kirim order setelah semua menu dipilih. Pembayaran dilakukan tunai di kasir.
                                    </p>
                                </div>

                                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-semibold text-slate-900">
                                                {customer.name}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {customer.no_telp}
                                                {customer.member_code
                                                    ? ` • ${customer.member_code}`
                                                    : ""}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={logoutCustomer}
                                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                                        >
                                            Ganti
                                        </button>
                                    </div>

                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                        <div className="rounded-2xl bg-white px-3 py-3">
                                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                                Tier
                                            </p>
                                            <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                                                {customer.loyalty_tier || "regular"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-3 py-3">
                                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                                Poin
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                                {customer.loyalty_points || 0}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-3 py-3">
                                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                                Transaksi
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                                {customer.loyalty_transaction_count || 0}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowCustomerHistory(
                                                (current) => !current
                                            )
                                        }
                                        className="mt-4 inline-flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700"
                                    >
                                        <span>
                                            {recentOrders.length > 0
                                                ? "Riwayat order terakhir"
                                                : recentTransactions.length > 0
                                                  ? "Riwayat transaksi kasir"
                                                  : "Belum ada histori order"}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {showCustomerHistory ? "Tutup" : "Lihat"}
                                        </span>
                                    </button>

                                    {showCustomerHistory ? (
                                        recentOrders.length > 0 ? (
                                            <div className="mt-3 rounded-2xl bg-white p-4">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-slate-800">
                                                        Riwayat Order Terakhir
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {customer.loyalty_total_spent
                                                            ? formatPrice(
                                                                  customer.loyalty_total_spent
                                                              )
                                                            : "Belum ada total belanja"}
                                                    </p>
                                                </div>
                                                <div className="space-y-3">
                                                    {recentOrders.map((order) => (
                                                        <div
                                                            key={order.id}
                                                            className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-800">
                                                                    {order.order_number}
                                                                </p>
                                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                    <span className="text-xs text-slate-500">
                                                                        {outlet?.name ||
                                                                            "Outlet"}
                                                                    </span>
                                                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                                                        {orderStatusLabel[
                                                                            order
                                                                                .status
                                                                        ] ||
                                                                            order.status}
                                                                    </span>
                                                                </div>
                                                                {order.access_token ? (
                                                                    <Link
                                                                        href={route(
                                                                            "table-order.status",
                                                                            order.access_token
                                                                        )}
                                                                        className="mt-2 inline-flex text-xs font-medium text-sky-700"
                                                                    >
                                                                        Lihat status order
                                                                    </Link>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-semibold text-slate-800">
                                                                    {formatPrice(
                                                                        order.grand_total
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : recentTransactions.length > 0 ? (
                                            <div className="mt-3 rounded-2xl bg-white p-4">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-slate-800">
                                                        Riwayat Transaksi Kasir
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {customer.loyalty_total_spent
                                                            ? formatPrice(
                                                                  customer.loyalty_total_spent
                                                              )
                                                            : "Belum ada total belanja"}
                                                    </p>
                                                </div>
                                                <div className="space-y-3">
                                                    {recentTransactions.map(
                                                        (transaction) => (
                                                            <div
                                                                key={transaction.id}
                                                                className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-800">
                                                                        {
                                                                            transaction.invoice
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-slate-500">
                                                                        {transaction.outlet_name ||
                                                                            outlet?.name ||
                                                                            "Outlet"}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm font-semibold text-slate-800">
                                                                        {formatPrice(
                                                                            transaction.grand_total
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs capitalize text-slate-500">
                                                                        {
                                                                            transaction.payment_status
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
                                                Belum ada histori order di outlet
                                                ini.
                                            </div>
                                        )
                                    ) : null}

                                    <textarea
                                        rows={3}
                                        value={orderForm.data.notes}
                                        onChange={(event) =>
                                            orderForm.setData(
                                                "notes",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Catatan umum untuk pesanan"
                                        className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                    />
                                </div>

                                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Keranjang
                                        </p>
                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                            {cartItems.length} item
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {cartItems.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                                                Belum ada menu dipilih.
                                            </div>
                                        ) : (
                                            cartItems.map((item) => (
                                                <div
                                                    key={item.key}
                                                    className="rounded-2xl bg-white px-4 py-4"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-slate-900">
                                                                {item.title}
                                                            </p>
                                                            {(item.modifiers || [])
                                                                .length > 0 ? (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {item.modifiers.map(
                                                                        (
                                                                            modifier
                                                                        ) => (
                                                                            <span
                                                                                key={`${item.key}-${modifier.id}`}
                                                                                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                                                                            >
                                                                                {
                                                                                    modifier.name
                                                                                }{" "}
                                                                                +
                                                                                {formatPrice(
                                                                                    modifier.price
                                                                                )}
                                                                            </span>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateLineQty(
                                                                    item.key,
                                                                    0
                                                                )
                                                            }
                                                            className="text-xs font-semibold text-rose-600"
                                                        >
                                                            Hapus
                                                        </button>
                                                    </div>

                                                    <div className="mt-4 flex items-center gap-3">
                                                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateLineQty(
                                                                        item.key,
                                                                        Number(
                                                                            item.qty ||
                                                                                0
                                                                        ) - 1,
                                                                        products.find(
                                                                            (
                                                                                product
                                                                            ) =>
                                                                                product.id ===
                                                                                item.product_id
                                                                        )?.stock
                                                                    )
                                                                }
                                                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-slate-700 shadow-sm"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={Number(
                                                                    item.qty || 0
                                                                )}
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateLineQty(
                                                                        item.key,
                                                                        event.target
                                                                            .value,
                                                                        products.find(
                                                                            (
                                                                                product
                                                                            ) =>
                                                                                product.id ===
                                                                                item.product_id
                                                                        )?.stock
                                                                    )
                                                                }
                                                                className="h-9 w-14 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold outline-none"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateLineQty(
                                                                        item.key,
                                                                        Number(
                                                                            item.qty ||
                                                                                0
                                                                        ) + 1,
                                                                        products.find(
                                                                            (
                                                                                product
                                                                            ) =>
                                                                                product.id ===
                                                                                item.product_id
                                                                        )?.stock
                                                                    )
                                                                }
                                                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-slate-700 shadow-sm"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                        <div className="ml-auto text-right">
                                                            <p className="text-xs text-slate-500">
                                                                {formatPrice(
                                                                    item.unit_total
                                                                )}{" "}
                                                                / porsi
                                                            </p>
                                                            <p className="text-base font-bold text-slate-950">
                                                                {formatPrice(
                                                                    item.line_total
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        rows={2}
                                                        value={item.notes || ""}
                                                        onChange={(event) =>
                                                            updateLineNotes(
                                                                item.key,
                                                                event.target
                                                                    .value
                                                            )
                                                        }
                                                        placeholder="Catatan item, mis. tanpa sambal"
                                                        className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-slate-500">
                                            Total
                                        </span>
                                        <span className="text-[1.9rem] font-black tracking-[-0.04em] text-slate-950">
                                            {formatPrice(grandTotal)}
                                        </span>
                                    </div>

                                    {orderForm.errors.items ? (
                                        <p className="mt-3 text-sm text-rose-600">
                                            {orderForm.errors.items}
                                        </p>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={submitOrder}
                                        disabled={orderForm.processing}
                                        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f3b68_100%)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.55)] disabled:opacity-50"
                                    >
                                        {orderForm.processing
                                            ? "Mengirim order..."
                                            : "Kirim Order dan Bayar ke Kasir"}
                                    </button>
                                </div>
                            </div>
                        </div>
                        </>
                    )}
                </div>
            </div>

            {!customer ? (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[linear-gradient(180deg,_rgba(2,6,23,0.82)_0%,_rgba(15,23,42,0.9)_100%)] px-4 py-6 backdrop-blur-md sm:px-6">
                    <div className="relative z-[501] w-full max-w-md rounded-[30px] border border-slate-200/90 bg-white p-5 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.72)] sm:p-7">
                        {!pendingPhone ? (
                            <div className="text-center">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                                    Login Wajib
                                </p>
                                <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.03em] text-slate-950 sm:text-[1.6rem]">
                                    Masukkan nomor HP
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Nomor HP wajib untuk mulai order dari meja ini.
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-400">
                                    Meja {table.code || table.name}
                                </p>

                                <form onSubmit={submitIdentify} className="mt-5 space-y-3 text-left">
                                    <div>
                                        <input
                                            ref={identifyPhoneInputRef}
                                            type="text"
                                            value={identifyForm.data.no_telp}
                                            onChange={(event) =>
                                                identifyForm.setData(
                                                    "no_telp",
                                                    sanitizePhoneNumber(
                                                        event.target.value
                                                    )
                                                )
                                            }
                                            placeholder="08xxxxxxxxxx"
                                            inputMode="numeric"
                                            autoComplete="tel"
                                            className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-base shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                                        />
                                        <p className="mt-2 text-xs text-slate-500">
                                            Contoh: 0812xxxxxxx
                                        </p>
                                    </div>
                                    {identifyForm.errors.no_telp ? (
                                        <p className="text-sm text-rose-600">
                                            {identifyForm.errors.no_telp}
                                        </p>
                                    ) : null}
                                    <button
                                        type="submit"
                                        disabled={identifyForm.processing}
                                        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f3b68_100%)] px-5 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 disabled:opacity-50"
                                    >
                                        Lanjutkan
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div>
                                <div className="text-center">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                                        Lengkapi Profil
                                    </p>
                                    <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.03em] text-slate-950 sm:text-[1.6rem]">
                                        Nomor belum terdaftar
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Lengkapi nama untuk melanjutkan order.
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-slate-400">
                                        {pendingPhone}
                                    </p>
                                </div>

                                <form onSubmit={submitRegister} className="mt-5 space-y-3">
                                    <input
                                        ref={registerNameInputRef}
                                        type="text"
                                        value={registerForm.data.name}
                                        onChange={(event) =>
                                            registerForm.setData("name", event.target.value)
                                        }
                                        placeholder="Nama"
                                        className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                                    />
                                    <input
                                        type="email"
                                        value={registerForm.data.email}
                                        onChange={(event) =>
                                            registerForm.setData("email", event.target.value)
                                        }
                                        placeholder="Email (opsional)"
                                        className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                                    />
                                    <textarea
                                        rows={3}
                                        value={registerForm.data.address}
                                        onChange={(event) =>
                                            registerForm.setData(
                                                "address",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Alamat (opsional)"
                                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                                    />
                                    {Object.values(registerForm.errors).length > 0 ? (
                                        <div className="space-y-1 text-sm text-rose-600">
                                            {Object.entries(registerForm.errors).map(
                                                ([key, value]) => (
                                                    <p key={key}>{value}</p>
                                                )
                                            )}
                                        </div>
                                    ) : null}
                                    <button
                                        type="submit"
                                        disabled={registerForm.processing}
                                        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f3b68_100%)] px-5 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 disabled:opacity-50"
                                    >
                                        Simpan dan Lanjut
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {modifierModalProduct ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeModifierModal}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                    Opsi Tambahan
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900">
                                    {modifierModalProduct.title}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Pilih extra jika diperlukan. Jika tidak, lanjutkan tanpa tambahan.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModifierModal}
                                disabled={isModifierModalSubmitting}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                            >
                                ×
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
                                                toggleModifierOption(option.id)
                                            }
                                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                                active
                                                    ? "border-primary-500 bg-primary-50"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {option.name}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    Tambahan{" "}
                                                    {formatPrice(option.price)}
                                                </p>
                                            </div>
                                            <div
                                                className={`h-5 w-5 rounded-md border ${
                                                    active
                                                        ? "border-primary-500 bg-primary-500"
                                                        : "border-slate-300"
                                                }`}
                                            />
                                        </button>
                                    );
                                }
                            )}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                            <div className="mb-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500">
                                    Total tambahan
                                </span>
                                <span className="font-semibold text-primary-600">
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
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                                >
                                    Tanpa Extra
                                </button>
                                <button
                                    type="button"
                                    onClick={() => submitModifierModal(true)}
                                    disabled={isModifierModalSubmitting}
                                    className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white"
                                >
                                    Tambah ke Order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {showMobileCheckoutBar ? (
                <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 lg:hidden">
                    <div
                        className={`mx-auto max-w-md rounded-[24px] border border-slate-200/80 bg-white/96 p-3 backdrop-blur transition-all duration-300 ${
                            showFloatingCheckout
                                ? "translate-y-0 opacity-100 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
                                : "translate-y-24 opacity-0 pointer-events-none shadow-none"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2.5">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                    Pesanan Anda
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                    {cartItems.length} item •{" "}
                                    {formatPrice(grandTotal)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                    Scroll ke keranjang atau buka tab checkout
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openCheckoutView}
                                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f3b68_100%)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
                            >
                                Lihat
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
