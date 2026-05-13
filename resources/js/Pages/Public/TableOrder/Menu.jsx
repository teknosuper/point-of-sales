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
                    selectedCategory === "all" || categoryName === selectedCategory;
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
        key: `line-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
                              unit_price: Number(product.sell_price || line.unit_price || 0),
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

    return (
        <>
            <Head title={`Order ${table.name}`} />

            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#f5ede2_42%,_#efe4d4_100%)] text-slate-900">
                <div
                    className={`mx-auto max-w-6xl px-4 py-8 ${
                        showMobileCheckoutBar ? "pb-28 lg:pb-8" : ""
                    }`}
                >
                    <div className="relative mb-8 overflow-hidden rounded-[32px] border border-[#eadac3] bg-[linear-gradient(135deg,_rgba(255,255,255,0.96)_0%,_rgba(255,247,237,0.96)_100%)] p-6 shadow-[0_20px_60px_rgba(148,101,56,0.12)]">
                        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#f3cda1]/35 blur-2xl" />
                        <div className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[#d8e6d2]/40 blur-2xl" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-4">
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-[#eadac3] bg-white shadow-sm">
                                    {storeProfile?.logo ? (
                                        <img
                                            src={storeProfile.logo}
                                            alt={storeProfile?.name || "Logo toko"}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold text-[#9b4b2e]">
                                            {(storeProfile?.name || outlet?.name || "S")
                                                .slice(0, 1)
                                                .toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.28em] text-[#8f6a44]">
                                        Self Order Meja
                                    </p>
                                    <h1 className="mt-2 text-3xl font-bold text-slate-900 lg:text-4xl">
                                        {outlet?.name || storeProfile?.name || "Outlet"} •{" "}
                                        {table.code || table.name}
                                    </h1>
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                                        Scan meja, masukkan nomor HP, pilih menu, lalu bayar ke kasir.
                                        Setelah tunai dikonfirmasi, order otomatis diteruskan ke dapur yang sesuai.
                                    </p>
                                </div>
                            </div>
                            <div className="grid shrink-0 grid-cols-2 gap-3 lg:min-w-[250px]">
                                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                        Meja
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-slate-900">
                                        {table.code || table.name}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                        Kapasitas
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-slate-900">
                                        {table.capacity || 0} Kursi
                                    </p>
                                </div>
                            </div>
                        </div>
                        {flash?.success ? (
                            <div className="relative mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {flash.success}
                            </div>
                        ) : null}
                        {flash?.info ? (
                            <div className="relative mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {flash.info}
                            </div>
                        ) : null}
                    </div>

                    {!customer ? (
                        <div className="space-y-6">
                            <div className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="text-sm uppercase tracking-[0.24em] text-[#8f6a44]">
                                            Mulai Order
                                        </p>
                                        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                                    Identitas Pembeli
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-slate-500">
                                            Masukkan nomor HP untuk melanjutkan ke katalog menu dan checkout.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-[#fff8f1] px-4 py-3 text-sm text-slate-600">
                                        Meja <span className="font-semibold text-slate-900">{table.code || table.name}</span>
                                    </div>
                                </div>

                                {!pendingPhone ? (
                                    <div className="mt-5 rounded-[28px] border border-slate-100 bg-[linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] p-5">
                                        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                                            <p className="text-sm font-semibold text-slate-800">
                                            Masukkan nomor hape
                                            </p>
                                            <p className="text-sm text-slate-500">
                                            Jika nomor sudah terdaftar, poin dan histori akan langsung terhubung.
                                            </p>
                                        </div>
                                        <form onSubmit={submitIdentify} className="mt-4 grid gap-3 lg:grid-cols-[1fr,220px] lg:items-start">
                                            <div>
                                                <input
                                                    type="text"
                                                    value={identifyForm.data.no_telp}
                                                    onChange={(event) =>
                                                        identifyForm.setData("no_telp", event.target.value)
                                                    }
                                                    placeholder="08xxxxxxxxxx"
                                                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base shadow-sm"
                                                />
                                                <p className="mt-2 text-xs text-slate-500">
                                                    Contoh: 0812xxxxxxx
                                                </p>
                                            </div>
                                            {identifyForm.errors.no_telp ? (
                                                <p className="text-sm text-rose-600 lg:col-span-2">
                                                    {identifyForm.errors.no_telp}
                                                </p>
                                            ) : null}
                                            <button
                                                type="submit"
                                                disabled={identifyForm.processing}
                                                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_100%)] px-5 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 disabled:opacity-50"
                                            >
                                                Lanjutkan
                                            </button>
                                        </form>
                                    </div>
                                ) : (
                                    <div className="mt-5 rounded-[28px] border border-slate-100 bg-[linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] p-5">
                                        <p className="text-sm font-semibold text-slate-800">
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
                                                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 shadow-sm"
                                            />
                                            <input
                                                type="email"
                                                value={registerForm.data.email}
                                                onChange={(event) =>
                                                    registerForm.setData("email", event.target.value)
                                                }
                                                placeholder="Email (opsional)"
                                                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 shadow-sm"
                                            />
                                            <textarea
                                                rows={3}
                                                value={registerForm.data.address}
                                                onChange={(event) =>
                                                    registerForm.setData("address", event.target.value)
                                                }
                                                placeholder="Alamat (opsional)"
                                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm"
                                            />
                                            {Object.values(registerForm.errors).length > 0 ? (
                                                <div className="space-y-1 text-sm text-rose-600">
                                                    {Object.entries(registerForm.errors).map(([key, value]) => (
                                                        <p key={key}>{value}</p>
                                                    ))}
                                                </div>
                                            ) : null}
                                            <button
                                                type="submit"
                                                disabled={registerForm.processing}
                                                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_100%)] px-5 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 disabled:opacity-50"
                                            >
                                                Simpan Profil dan Lanjut
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-[32px] border border-[#eadac3] bg-[linear-gradient(180deg,_rgba(255,255,255,0.88)_0%,_rgba(255,248,241,0.92)_100%)] p-6 shadow-[0_20px_60px_rgba(148,101,56,0.10)]">
                                <div className="max-w-2xl">
                                    <p className="text-sm uppercase tracking-[0.24em] text-[#8f6a44]">
                                        Langkah Awal
                                    </p>
                                    <h2 className="mt-3 text-2xl font-bold text-slate-900">
                                        Alur self order meja
                                    </h2>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                        Setelah nomor HP dimasukkan, pembeli bisa memilih menu,
                                        membayar di kasir, lalu menunggu pesanan diproses dapur.
                                    </p>
                                </div>
                                <div className="mt-5 rounded-[28px] border border-white/80 bg-white/75 p-4 shadow-sm">
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                                        Alur Pesanan
                                    </p>
                                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
                                        <div className="rounded-2xl bg-[#fff8f1] px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9b4b2e] text-sm font-bold text-white">1</span>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">Masukkan nomor HP</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500">Hubungkan pesanan ke data member atau pembeli.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="hidden text-center text-2xl text-[#9b4b2e] lg:block">→</div>
                                        <div className="rounded-2xl bg-[#f5f9f3] px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5f7d4d] text-sm font-bold text-white">2</span>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">Pilih menu</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500">Tambahkan makanan, minuman, dan extra jika perlu.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="hidden text-center text-2xl text-[#5f7d4d] lg:block">→</div>
                                        <div className="rounded-2xl bg-[#f8f5ff] px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4f46e5] text-sm font-bold text-white">3</span>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">Bayar di kasir</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500">Tunjukkan pesanan lalu lakukan pembayaran tunai.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="hidden text-center text-2xl text-[#4f46e5] lg:block">→</div>
                                        <div className="rounded-2xl bg-[#eef6ff] px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white">4</span>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">Tunggu pesanan</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500">Setelah pembayaran dikonfirmasi, dapur mulai memproses order.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 lg:hidden">
                                        <div className="flex justify-center text-xl text-[#9b4b2e]">↓</div>
                                        <div className="flex justify-center text-xl text-[#5f7d4d]">↓</div>
                                        <div className="flex justify-center text-xl text-[#4f46e5]">↓</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
                            <div className="space-y-6">
                                <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold">Menu Pesanan</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Cari menu dan filter kategori seperti di POS kasir.
                                            </p>
                                        </div>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="Cari menu..."
                                            className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 lg:max-w-xs"
                                        />
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {categoryOptions.map((categoryName) => {
                                            const active = selectedCategory === categoryName;

                                            return (
                                                <button
                                                    key={categoryName}
                                                    type="button"
                                                    onClick={() => setSelectedCategory(categoryName)}
                                                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                                                        active
                                                            ? "bg-slate-900 text-white"
                                                            : "bg-slate-100 text-slate-600"
                                                    }`}
                                                >
                                                    {categoryName === "all" ? "Semua" : categoryName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>

                                {Object.keys(groupedProducts).length === 0 ? (
                                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                                        Tidak ada menu yang cocok dengan pencarian atau kategori ini.
                                    </div>
                                ) : (
                                    Object.entries(groupedProducts).map(([categoryName, items]) => (
                                        <section
                                            key={categoryName}
                                            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
                                        >
                                            <div className="mb-4">
                                                <h2 className="text-xl font-semibold">{categoryName}</h2>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                {items.map((product) => (
                                                    (() => {
                                                        const promo = promoDisplay(product);
                                                        const hasStock = Number(product.stock || 0) > 0;

                                                        return (
                                                    <div
                                                        key={product.id}
                                                        className={`rounded-3xl border p-4 transition ${
                                                            hasStock
                                                                ? "border-slate-200 bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                                                                : "border-slate-200 bg-slate-100 opacity-70"
                                                        }`}
                                                    >
                                                        <div className="flex gap-4">
                                                            <div className="relative">
                                                                <img
                                                                    src={product.image}
                                                                    alt={product.title}
                                                                    className="h-24 w-24 rounded-2xl object-cover"
                                                                />
                                                                {promo.badge?.label ? (
                                                                    <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white">
                                                                        {promo.badge.label}
                                                                    </span>
                                                                ) : null}
                                                                {!hasStock ? (
                                                                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/60">
                                                                        <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white">
                                                                            Habis
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <h3 className="font-semibold">{product.title}</h3>
                                                                    {hasPresetModifiers(product) ? (
                                                                        <span className="rounded-full bg-[#f4d7c8] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#9b4b2e]">
                                                                            Extra tersedia
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <p className="mt-1 text-sm text-slate-500">
                                                                    {product.description || "Menu tersedia untuk self-order meja."}
                                                                </p>
                                                                <p className="mt-3 text-sm font-semibold text-primary-700">
                                                                    {formatPrice(
                                                                        promo.showPromo
                                                                            ? promo.promoPrice
                                                                            : product.sell_price
                                                                    )}
                                                                </p>
                                                                {promo.showPromo ? (
                                                                    <p className="mt-1 text-xs text-slate-400 line-through">
                                                                        {formatPrice(promo.basePrice)}
                                                                    </p>
                                                                ) : null}
                                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                    <span>Stok outlet: {product.stock}</span>
                                                                    {lowStockLabel(product.stock) ? (
                                                                        <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">
                                                                            {lowStockLabel(product.stock)}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                {product.kitchen_stations?.length ? (
                                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                        <span className="font-medium text-slate-600">
                                                                            Dapur:
                                                                        </span>
                                                                        {product.kitchen_stations.map((station) => (
                                                                            <span
                                                                                key={`${product.id}-${station.id || station.name}`}
                                                                                className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700"
                                                                            >
                                                                                {station.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>

                                                        {hasPresetModifiers(product) ? (
                                                            <div className="mt-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAddProduct(product)}
                                                                    disabled={!hasStock}
                                                                    className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                                                >
                                                                    Tambah Pesanan
                                                                </button>
                                                                <p className="mt-2 text-xs text-slate-500">
                                                                    Sudah dipilih: {productOrderCount(product.id)} item
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-4 flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        updatePlainQty(
                                                                            product,
                                                                            plainProductQty(product.id) - 1
                                                                        )
                                                                    }
                                                                    disabled={!hasStock}
                                                                    className="h-10 w-10 rounded-2xl border border-slate-300 bg-white text-lg"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={product.stock}
                                                                    value={plainProductQty(product.id)}
                                                                    onChange={(event) =>
                                                                        updatePlainQty(product, event.target.value)
                                                                    }
                                                                    disabled={!hasStock}
                                                                    className="h-10 w-20 rounded-2xl border border-slate-300 bg-white px-3 text-center"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        updatePlainQty(
                                                                            product,
                                                                            plainProductQty(product.id) + 1
                                                                        )
                                                                    }
                                                                    disabled={!hasStock}
                                                                    className="h-10 w-10 rounded-2xl border border-slate-300 bg-white text-lg"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                        );
                                                    })()
                                                ))}
                                            </div>
                                        </section>
                                    ))
                                )}
                            </div>

                            <div
                                ref={checkoutSectionRef}
                                className="h-fit scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
                            >
                                <h2 className="text-xl font-semibold">Checkout Meja</h2>
                                <p className="mt-2 text-sm text-slate-500">
                                    Pembayaran self-order saat ini menggunakan tunai di kasir.
                                </p>

                                <div className="mt-5 rounded-3xl bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {customer.name}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                {customer.no_telp}
                                                {customer.member_code ? ` • ${customer.member_code}` : ""}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={logoutCustomer}
                                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600"
                                        >
                                            Logout
                                        </button>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-2xl bg-white px-4 py-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Tier
                                            </p>
                                            <p className="mt-1 font-semibold capitalize">
                                                {customer.loyalty_tier || "regular"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-4 py-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Poin
                                            </p>
                                            <p className="mt-1 font-semibold">
                                                {customer.loyalty_points || 0}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-4 py-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Transaksi
                                            </p>
                                            <p className="mt-1 font-semibold">
                                                {customer.loyalty_transaction_count || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {recentOrders.length > 0 ? (
                                        <div className="mt-4 rounded-2xl bg-white p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-slate-800">
                                                    Riwayat Order Terakhir
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {customer.loyalty_total_spent
                                                        ? formatPrice(customer.loyalty_total_spent)
                                                        : "Belum ada total belanja"}
                                                </p>
                                            </div>
                                            <div className="mt-3 space-y-3">
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
                                                                    {outlet?.name || "Outlet"}
                                                                </span>
                                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                                                    {orderStatusLabel[order.status] || order.status}
                                                                </span>
                                                            </div>
                                                            {order.access_token ? (
                                                                <Link
                                                                    href={route("table-order.status", order.access_token)}
                                                                    className="mt-2 inline-flex text-xs font-medium text-[#9b4b2e]"
                                                                >
                                                                    Lihat status order
                                                                </Link>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-semibold text-slate-800">
                                                                {formatPrice(order.grand_total)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : recentTransactions.length > 0 ? (
                                        <div className="mt-4 rounded-2xl bg-white p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-slate-800">
                                                    Riwayat Transaksi Kasir
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {customer.loyalty_total_spent
                                                        ? formatPrice(customer.loyalty_total_spent)
                                                        : "Belum ada total belanja"}
                                                </p>
                                            </div>
                                            <div className="mt-3 space-y-3">
                                                {recentTransactions.map((transaction) => (
                                                    <div
                                                        key={transaction.id}
                                                        className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-800">
                                                                {transaction.invoice}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {transaction.outlet_name || outlet?.name || "Outlet"}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-semibold text-slate-800">
                                                                {formatPrice(transaction.grand_total)}
                                                            </p>
                                                            <p className="text-xs capitalize text-slate-500">
                                                                {transaction.payment_status}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
                                            Belum ada histori order di outlet ini.
                                        </div>
                                    )}

                                    <textarea
                                        rows={3}
                                        value={orderForm.data.notes}
                                        onChange={(event) =>
                                            orderForm.setData("notes", event.target.value)
                                        }
                                        placeholder="Catatan umum untuk pesanan"
                                        className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                                    />
                                </div>

                                <div className="mt-6 space-y-3 rounded-3xl bg-slate-50 p-4">
                                    {cartItems.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                            Belum ada menu dipilih.
                                        </p>
                                    ) : (
                                        cartItems.map((item) => (
                                            <div
                                                key={item.key}
                                                className="rounded-2xl bg-white px-4 py-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-medium">
                                                            {item.title}
                                                        </p>
                                                        {(item.modifiers || []).length > 0 ? (
                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                {item.modifiers.map((modifier) => (
                                                                    <span
                                                                        key={`${item.key}-${modifier.id}`}
                                                                        className="rounded-full bg-[#f5e4d9] px-2 py-1 text-xs text-[#9b4b2e]"
                                                                    >
                                                                        {modifier.name} +{formatPrice(modifier.price)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateLineQty(item.key, 0)}
                                                        className="text-xs font-medium text-rose-600"
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>

                                                <div className="mt-4 flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateLineQty(
                                                                item.key,
                                                                Number(item.qty || 0) - 1,
                                                                products.find(
                                                                    (product) => product.id === item.product_id
                                                                )?.stock
                                                            )
                                                        }
                                                        className="h-9 w-9 rounded-2xl border border-slate-300 bg-white text-lg"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={Number(item.qty || 0)}
                                                        onChange={(event) =>
                                                            updateLineQty(
                                                                item.key,
                                                                event.target.value,
                                                                products.find(
                                                                    (product) => product.id === item.product_id
                                                                )?.stock
                                                            )
                                                        }
                                                        className="h-9 w-20 rounded-2xl border border-slate-300 bg-white px-3 text-center"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateLineQty(
                                                                item.key,
                                                                Number(item.qty || 0) + 1,
                                                                products.find(
                                                                    (product) => product.id === item.product_id
                                                                )?.stock
                                                            )
                                                        }
                                                        className="h-9 w-9 rounded-2xl border border-slate-300 bg-white text-lg"
                                                    >
                                                        +
                                                    </button>
                                                    <div className="ml-auto text-right">
                                                        <p className="text-xs text-slate-500">
                                                            {formatPrice(item.unit_total)} / porsi
                                                        </p>
                                                        <p className="font-semibold">
                                                            {formatPrice(item.line_total)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <textarea
                                                    rows={2}
                                                    value={item.notes || ""}
                                                    onChange={(event) =>
                                                        updateLineNotes(item.key, event.target.value)
                                                    }
                                                    placeholder="Catatan item, mis. tanpa sambal"
                                                    className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                                    <span className="text-sm text-slate-500">Total</span>
                                    <span className="text-2xl font-bold">
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
                                    className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#b8572f] px-5 py-3 font-semibold text-white disabled:opacity-50"
                                >
                                    {orderForm.processing
                                        ? "Mengirim order..."
                                        : "Checkout dan Bayar ke Kasir"}
                                </button>
                            </div>
                        </div>
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
                            {(modifierModalProduct.modifier_options || []).map((option) => {
                                const active = selectedModifierOptionIds.includes(option.id);

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => toggleModifierOption(option.id)}
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
                                                Tambahan {formatPrice(option.price)}
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
                            })}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                            <div className="mb-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500">Total tambahan</span>
                                <span className="font-semibold text-primary-600">
                                    {formatPrice(
                                        (modifierModalProduct.modifier_options || [])
                                            .filter((option) =>
                                                selectedModifierOptionIds.includes(option.id)
                                            )
                                            .reduce(
                                                (sum, option) => sum + Number(option.price || 0),
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
                <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 lg:hidden">
                    <div className="mx-auto max-w-md rounded-[26px] border border-[#e7d7c3] bg-white/96 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur">
                        <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1 rounded-2xl bg-[#fff8f1] px-3 py-2.5">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f6a44]">
                                    Ringkasan Pesanan
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                    {cartItems.length} item • {formatPrice(grandTotal)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={scrollToCheckout}
                                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#b8572f] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#b8572f]/20"
                            >
                                Lihat Checkout
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
