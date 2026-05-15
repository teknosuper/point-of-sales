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

export default function Menu({ table, outlet, products = [], identity }) {
    const { flash, storeProfile } = usePage().props;
    const checkoutSectionRef = useRef(null);
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
    const customer = identity?.customer || null;
    const pendingPhone = identity?.pending_phone || "";
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];
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
        const names = products
            .map((product) => product.category?.name || "Lainnya")
            .filter(Boolean);

        return [
            "all",
            ...[...new Set(names)].sort((a, b) => a.localeCompare(b, "id")),
        ];
    }, [products]);

    const filteredProducts = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return products
            .filter((product) => {
                const categoryName = product.category?.name || "Lainnya";
                const matchesCategory =
                    selectedCategory === "all" ||
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
        unit_price: Number(product.sell_price || 0),
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
                              unit_price: Number(
                                  product.sell_price || line.unit_price || 0
                              ),
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
                                <h1 className="mt-4 max-w-3xl text-[1.9rem] font-black leading-tight tracking-[-0.04em] text-white sm:text-[2.35rem]">
                                    Pesan dari meja dengan alur yang cepat dan mudah dipahami.
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                                    Pilih menu, tambah catatan bila perlu, lalu kirim ringkasan order ke kasir. Pembayaran dilakukan di kasir dan pesanan diteruskan ke dapur otomatis.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                                        Meja {table.code || table.name}
                                    </span>
                                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                                        Bayar di kasir
                                    </span>
                                    <span className="rounded-full border border-sky-400/20 bg-sky-400/12 px-3 py-1.5 text-xs font-semibold text-sky-100">
                                        Dapur otomatis
                                    </span>
                                </div>
                            </div>
                            <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:max-w-sm lg:min-w-[300px]">
                                <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                                        Meja
                                    </p>
                                    <p className="mt-1 text-base font-semibold text-white sm:text-lg">
                                        {table.code || table.name}
                                    </p>
                                </div>
                                <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                                        Kapasitas
                                    </p>
                                    <p className="mt-1 text-base font-semibold text-white sm:text-lg">
                                        {table.capacity || 0} Kursi
                                    </p>
                                </div>
                                <div className="col-span-2 min-w-0 rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                                                Ringkas
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-white">
                                                Pilih menu, kirim order, lalu bayar di kasir.
                                            </p>
                                        </div>
                                        <span className="inline-flex shrink-0 self-start rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900 sm:self-auto">
                                            Fast flow
                                        </span>
                                    </div>
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
                    </div>

                    {!customer ? (
                        <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
                            <section className="rounded-[28px] border border-slate-200/80 bg-white/96 p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)] sm:p-6">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                                            Mulai Order
                                        </p>
                                        <h2 className="mt-2 text-[1.6rem] font-bold tracking-[-0.03em] text-slate-950">
                                            Identitas pembeli
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            Masukkan nomor HP agar pesanan mudah dikenali kasir dan dapat terhubung ke histori pembelian jika sudah pernah terdaftar.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        Meja{" "}
                                        <span className="font-semibold text-slate-900">
                                            {table.code || table.name}
                                        </span>
                                    </div>
                                </div>

                                {!pendingPhone ? (
                                    <div className="mt-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 sm:p-5">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-semibold text-slate-900">
                                                Masukkan nomor hape
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                Jika nomor sudah terdaftar, histori dan poin akan langsung terhubung.
                                            </p>
                                        </div>
                                        <form
                                            onSubmit={submitIdentify}
                                            className="mt-4 grid gap-3 sm:grid-cols-[1fr,180px] sm:items-start"
                                        >
                                            <div>
                                                <input
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
                                                    Gunakan angka saja. Contoh: 0812xxxxxxx
                                                </p>
                                            </div>
                                            {identifyForm.errors.no_telp ? (
                                                <p className="text-sm text-rose-600 sm:col-span-2">
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
                                    <div className="mt-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 sm:p-5">
                                        <p className="text-sm font-semibold text-slate-900">
                                            Lengkapi profil singkat
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Nomor {pendingPhone} belum terdaftar. Nama wajib, email dan alamat opsional.
                                        </p>
                                        <form onSubmit={submitRegister} className="mt-4 space-y-3">
                                            <input
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
                                                Simpan Profil dan Lanjut
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </section>

                            <section className="rounded-[28px] border border-slate-200/80 bg-white/96 p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)] sm:p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                                            Cara Order
                                        </p>
                                        <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-slate-950">
                                            Ringkas dan cepat dipakai
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowOrderGuide((current) => !current)
                                        }
                                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 lg:hidden"
                                    >
                                        {showOrderGuide ? "Tutup" : "Lihat"}
                                    </button>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    Buka nomor, pilih menu, kirim order, lalu bayar di kasir.
                                </p>
                                <div
                                    className={`mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 ${
                                        showOrderGuide ? "grid" : "hidden lg:grid"
                                    }`}
                                >
                                    {[
                                        [
                                            "1",
                                            "Isi nomor HP",
                                            "Agar kasir mudah mengenali order Anda.",
                                        ],
                                        [
                                            "2",
                                            "Pilih menu",
                                            "Tambahkan extra atau catatan bila perlu.",
                                        ],
                                        [
                                            "3",
                                            "Kirim order",
                                            "Tunjukkan total ke kasir untuk pembayaran.",
                                        ],
                                        [
                                            "4",
                                            "Tunggu pesanan",
                                            "Dapur langsung memproses order.",
                                        ],
                                    ].map(([step, title, helper]) => (
                                        <div
                                            key={step}
                                            className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-4 py-4 shadow-sm"
                                        >
                                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                                                {step}
                                            </span>
                                            <p className="mt-4 text-sm font-semibold text-slate-900">
                                                {title}
                                            </p>
                                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                                {helper}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
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

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr),380px] xl:grid-cols-[minmax(0,1.45fr),420px]">
                            <div
                                className={`space-y-4 sm:space-y-5 ${
                                    activeMobileTab === "products"
                                        ? "block"
                                        : "hidden lg:block"
                                }`}
                            >
                                <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_20px_70px_-38px_rgba(15,23,42,0.28)] sm:rounded-[28px]">
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
                                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {categoryOptions.map((categoryName) => {
                                                const active =
                                                    selectedCategory ===
                                                    categoryName;

                                                return (
                                                    <button
                                                        key={categoryName}
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedCategory(
                                                                categoryName
                                                            )
                                                        }
                                                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                                                            active
                                                                ? "bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                                                                : "border border-slate-200 bg-white text-slate-600"
                                                        }`}
                                                    >
                                                        {categoryName === "all"
                                                            ? "Semua"
                                                            : categoryName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 sm:px-3 sm:py-1.5">
                                                {filteredProductCount} menu tampil
                                            </span>
                                            {selectedCategory !== "all" ? (
                                                <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 sm:px-3 sm:py-1.5">
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

                                    <div className="p-3 sm:p-5">
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
                                                                    const hasStock =
                                                                        Number(
                                                                            product.stock || 0
                                                                        ) > 0;

                                                                    return (
                                                                        <article
                                                                            key={product.id}
                                                                            className={`rounded-[22px] border p-2.5 transition sm:rounded-[26px] sm:p-4 ${
                                                                                hasStock
                                                                                    ? "border-slate-200 bg-white shadow-[0_14px_40px_-34px_rgba(15,23,42,0.35)]"
                                                                                    : "border-slate-200 bg-slate-100/90 opacity-75"
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-start gap-2.5 sm:gap-4">
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
                                                                                        className="h-20 w-20 rounded-[18px] object-cover sm:h-28 sm:w-28 sm:rounded-[22px]"
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
                                                                                        <span className="absolute left-2 top-2 max-w-[75%] truncate rounded-full bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white">
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
                                                                                            <h3 className="text-sm font-bold leading-5 text-slate-950 sm:text-base sm:leading-6">
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

                                                                                    <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:mt-4 sm:pt-4 lg:flex-row lg:items-end lg:justify-between">
                                                                                        <div>
                                                                                            <p className="text-base font-black tracking-[-0.03em] text-slate-950 sm:text-lg">
                                                                                                {formatPrice(
                                                                                                    promo.showPromo
                                                                                                        ? promo.promoPrice
                                                                                                        : product.sell_price
                                                                                                )}
                                                                                            </p>
                                                                                            {promo.showPromo ? (
                                                                                                <p className="mt-1 text-xs text-slate-400 line-through">
                                                                                                    {formatPrice(
                                                                                                        promo.basePrice
                                                                                                    )}
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
                                                                                                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,_#0f172a_0%,_#0f3b68_100%)] px-4 text-xs font-semibold text-white shadow-lg shadow-slate-900/15 disabled:opacity-50 sm:h-11 sm:rounded-2xl sm:px-5 sm:text-sm lg:w-auto lg:min-w-[170px]"
                                                                                            >
                                                                                                Tambah ke Keranjang
                                                                                            </button>
                                                                                        ) : (
                                                                                            <div className="w-full lg:min-w-[220px]">
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
                                                                                                        className="h-9 w-14 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold outline-none"
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
