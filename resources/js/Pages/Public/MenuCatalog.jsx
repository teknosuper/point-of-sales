import ProductGrid from "@/Components/POS/ProductGrid";
import LazyImage from "@/Components/Dashboard/LazyImage";
import { Head } from "@inertiajs/react";
import { getProductImageUrl, getProductThumbUrl } from "@/Utils/imageUrl";
import {
    IconAlertTriangle,
    IconClock,
    IconPhoto,
    IconRefresh,
    IconStar,
    IconMessageCircle,
    IconSend,
    IconWifiOff,
    IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_REFRESH_INTERVAL = 30 * 1000;

export default function MenuCatalog({
    outlet,
    store,
    storeHours,
    supportContact,
    tenants = [],
    categories = [],
    mainCategories = [],
}) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [usingCachedData, setUsingCachedData] = useState(false);
    const [syncError, setSyncError] = useState("");
    const [isShortLandscape, setIsShortLandscape] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "", is_verified_purchase: false });
    const [submittingReview, setSubmittingReview] = useState(false);
    const searchInputRef = useRef(null);
    const cacheKey = `public-menu:catalog:${outlet?.code || store?.name || "default"}`;

    // Tenant outlets untuk filter dapur — nama asli tanpa label status
    // (tutup permanen sudah difilter backend karena is_active=false tidak masuk)
    const tenantOutlets = tenants.map((t) => ({
        id: t.id,
        name: t.name,
        sort_order: t.sort_order,
    }));

    // Set ID tenant aktif yang boleh ditampilkan (tutup permanen sudah difilter backend)
    const activeTenantIdSet = new Set(tenants.map((t) => t.id));

    // Map tenant ID → closed_reason dari backend (sumber kebenaran: ProductCatalogService::resolveOutletClosedReason)
    // null = buka, 'store_closed' = tutup manual, 'outside_hours' = luar jam operasional
    const tenantClosedReasonMap = Object.fromEntries(
        tenants
            .filter((t) => t.closed_reason)
            .map((t) => [t.id, t.closed_reason])
    );

    // Map tenant ID → jam operasional { open_time, close_time }
    const tenantHoursMap = Object.fromEntries(
        tenants.map((t) => [t.id, { open_time: t.open_time || null, close_time: t.close_time || null }])
    );

    // Set tenant yang belum buka (ada closed_reason)
    const closedTenantIds = new Set(
        tenants.filter((t) => t.closed_reason).map((t) => t.id)
    );

    // Resolusi status toko
    const storeClosed =
        storeHours?.is_permanently_closed ||
        !storeHours?.is_open ||
        !storeHours?.has_active_shift;

    const storeStatusLabel = storeHours?.is_permanently_closed
        ? "Toko tidak beroperasi"
        : !storeHours?.is_open
          ? "Toko sedang tutup"
          : !storeHours?.has_active_shift
            ? "Kasir belum membuka shift"
            : null;

    const formatPrice = (value = 0) =>
        Number(value || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatSyncTime = (value) => {
        if (!value) return "Belum pernah";
        try {
            return new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
            }).format(new Date(value));
        } catch {
            return "Belum pernah";
        }
    };

    const readCache = useCallback(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = window.localStorage.getItem(cacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed?.products)) return null;
            return parsed;
        } catch {
            return null;
        }
    }, [cacheKey]);

    const fetchProductReviews = useCallback(async (productId) => {
        try {
            const response = await fetch(`/api/public/catalog/products/${productId}/reviews`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setReviews(Array.isArray(data.data) ? data.data : []);
        } catch {
            setReviews([]);
        }
    }, []);

    const submitReview = useCallback(async () => {
        if (!selectedProduct || submittingReview) return;
        setSubmittingReview(true);
        try {
            const response = await fetch('/daftarmenu/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({
                    product_id: selectedProduct.id,
                    rating: Math.max(1, Math.min(5, Number(reviewForm.rating) || 5)),
                    comment: reviewForm.comment?.trim() || null,
                    is_verified_purchase: Boolean(reviewForm.is_verified_purchase),
                }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setReviews((prev) => [data.data, ...prev]);
            setReviewForm({ rating: 5, comment: "", is_verified_purchase: false });
        } catch {
            // silently fail for public users
        } finally {
            setSubmittingReview(false);
        }
    }, [selectedProduct, submittingReview, reviewForm]);

    const writeCache = useCallback(
        (items, timestamp) => {
            if (typeof window === "undefined") return;
            try {
                window.localStorage.setItem(
                    cacheKey,
                    JSON.stringify({ products: items, updated_at: timestamp })
                );
            } catch {}
        },
        [cacheKey]
    );

    const fetchProducts = useCallback(
        async ({ silent = false } = {}) => {
            if (!silent) setRefreshing(true);
            setSyncError("");

            try {
                const buildParams = (page) => {
                    const params = new URLSearchParams();
                    params.append("per_page", "100");
                    params.append("page", String(page));
                    if (outlet?.code) params.append("outlet_code", outlet.code);
                    return params;
                };

                const loadPage = async (page) => {
                    const response = await fetch(
                        `/api/public/catalog/products?${buildParams(page).toString()}`
                    );
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                };

                const firstPayload = await loadPage(1);
                const allProducts = Array.isArray(firstPayload.data) ? [...firstPayload.data] : [];
                const lastPage = Number(firstPayload?.meta?.last_page || 1);

                for (let page = 2; page <= lastPage; page++) {
                    const payload = await loadPage(page);
                    if (Array.isArray(payload.data)) allProducts.push(...payload.data);
                }

                const syncedAt = new Date().toISOString();
                setProducts(allProducts);
                setLastUpdatedAt(syncedAt);
                setUsingCachedData(false);
                writeCache(allProducts, syncedAt);
            } catch (error) {
                console.error("Failed to fetch public menu:", error);
                setSyncError("Gagal mengambil data terbaru.");
                const cached = readCache();
                if (cached) {
                    setProducts(cached.products);
                    setLastUpdatedAt(cached.updated_at || null);
                    setUsingCachedData(true);
                } else {
                    setProducts([]);
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [outlet?.code, readCache, writeCache]
    );

    useEffect(() => {
        const cached = readCache();
        if (cached) {
            setProducts(cached.products);
            setLastUpdatedAt(cached.updated_at || null);
            setUsingCachedData(true);
            setLoading(false);
        }
        fetchProducts({ silent: Boolean(cached) });
    }, [fetchProducts, readCache]);

    useEffect(() => {
        const id = window.setInterval(() => fetchProducts({ silent: true }), AUTO_REFRESH_INTERVAL);
        return () => window.clearInterval(id);
    }, [fetchProducts]);

    useEffect(() => {
        if (selectedProduct?.id) {
            fetchProductReviews(selectedProduct.id);
        } else {
            setReviews([]);
        }
    }, [selectedProduct?.id, fetchProductReviews]);

    useEffect(() => {
        const onVisible = () => document.visibilityState === "visible" && fetchProducts({ silent: true });
        const onFocus = () => fetchProducts({ silent: true });
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [fetchProducts]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "/" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target;
            if (t instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
            e.preventDefault();
            searchInputRef.current?.focus();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const sync = () => {
            const w = window.innerWidth || 0;
            const h = window.innerHeight || 0;
            const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
            setIsShortLandscape(Boolean(coarse) && w >= 640 && w > h && h <= 560);
        };
        sync();
        window.addEventListener("resize", sync);
        window.addEventListener("orientationchange", sync);
        return () => {
            window.removeEventListener("resize", sync);
            window.removeEventListener("orientationchange", sync);
        };
    }, []);

    return (
        <>
            <Head title={store?.name ? `Daftar Menu — ${store.name}` : "Daftar Menu"} />

            {/* ── Banner status toko ── */}
            {storeHours && storeClosed ? (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="mx-auto flex max-w-7xl items-start gap-3">
                        <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-amber-800">{storeStatusLabel}</p>
                                {storeHours.current_time ? (
                                    <span className="text-xs text-amber-600">Sekarang {storeHours.current_time}</span>
                                ) : null}
                            </div>
                            {storeHours.notes ? (
                                <p className="mt-0.5 text-xs text-amber-700">{storeHours.notes}</p>
                            ) : storeHours.open_time && storeHours.close_time ? (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                                    <IconClock size={12} />
                                    <span>Jam operasional: {storeHours.open_time} – {storeHours.close_time}</span>
                                </div>
                            ) : null}
                            {storeHours.next_open_label ? (
                                <p className="mt-1 text-xs font-semibold text-amber-700">
                                    Buka lagi: {storeHours.next_open_label}
                                </p>
                            ) : null}
                            <p className="mt-1 text-xs text-amber-600">
                                Menu tetap dapat dilihat. Untuk pemesanan, silakan hubungi staf kami.
                            </p>
                        </div>
                    </div>
                </div>
            ) : storeHours && storeHours.open_time && storeHours.close_time ? (
                <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2">
                    <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <IconClock size={14} className="shrink-0 text-emerald-600" />
                            <p className="text-xs text-emerald-700">
                                Buka {storeHours.open_time} – {storeHours.close_time}
                            </p>
                        </div>
                        {storeHours.current_time ? (
                            <span className="text-xs text-emerald-600">Sekarang {storeHours.current_time}</span>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="min-h-screen min-h-dvh bg-slate-100">
                <div
                    className={`mx-auto flex w-full max-w-7xl flex-col px-3 sm:px-4 lg:px-6 ${
                        isShortLandscape ? "min-h-dvh py-3" : "min-h-screen min-h-dvh py-4"
                    }`}
                >
                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div
                            className={`bg-slate-100 ${
                                isShortLandscape
                                    ? "min-h-[calc(100dvh-1.5rem)]"
                                    : "min-h-[calc(100dvh-2rem)]"
                            }`}
                        >
                            {loading ? (
                                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                                    {Array.from({ length: 10 }).map((_, i) => (
                                        <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <ProductGrid
                                        products={products
                                            // Sembunyikan produk dari tenant tutup permanen (tidak ada di activeTenantIdSet)
                                            .filter((p) => {
                                                const tenantId = p.tenant_outlet?.id ?? p.tenant_outlet_id ?? null;
                                                // Produk tanpa tenant (non-tenant) selalu tampil
                                                if (!tenantId) return true;
                                                // Produk tenant hanya tampil jika tenantnya aktif
                                                return activeTenantIdSet.has(Number(tenantId));
                                            })
                                            // Inject store_closed_reason dan tenant_store_hours dari backend
                                            // null=buka, 'store_closed'=tutup manual, 'outside_hours'=luar jam buka
                                            .map((p) => {
                                                const tenantId = p.tenant_outlet?.id ?? p.tenant_outlet_id ?? null;
                                                const reason = tenantId ? (tenantClosedReasonMap[Number(tenantId)] ?? null) : null;
                                                const hours = tenantId ? (tenantHoursMap[Number(tenantId)] ?? null) : null;
                                                return {
                                                    ...p,
                                                    ...(reason ? { store_closed_reason: reason } : {}),
                                                    ...(hours ? { tenant_store_hours: hours } : {}),
                                                };
                                            })}
                                        categories={categories}
                                        mainCategories={mainCategories.length > 0 ? mainCategories : categories.filter((c) => !c.parent_id)}
                                        searchQuery={searchQuery}
                                        onSearchChange={setSearchQuery}
                                        onSearch={() => undefined}
                                        isSearching={false}
                                        searchInputRef={searchInputRef}
                                        interactive={false}
                                        onProductSelect={setSelectedProduct}
                                        searchPlaceholder="Cari menu favorit... (tekan / untuk fokus)"
                                        emptyMessage={
                                            searchQuery ? "Menu tidak ditemukan" : "Belum ada menu yang bisa ditampilkan"
                                        }
                                        enableBarcodeScanner={false}
                                        sortControlVariant="chips"
                                        filterPanelCollapsible={false}
                                        mainCategorySectionLabel="Kategori Utama"
                                        allMainCategoriesLabel="Semua Kategori"
                                        gridLayoutClass="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                                        listLayoutClass="grid grid-cols-1 gap-3"
                                        compactHeaderLayout={true}
                                        showFilterSummary={false}
                                        groupByCategoryWhenMainCategoryFiltered={true}
                                        storageNamespace={`public-menu:${outlet?.code || store?.name || "default"}`}
                                        initialSortMode="best_seller"
                                    />

                                    <div className="border-t border-slate-200 bg-white px-4 py-3">
                                        <div
                                            className={`flex flex-wrap items-center justify-between gap-3 ${
                                                isShortLandscape ? "text-[11px]" : ""
                                            }`}
                                        >
                                            <div className="min-w-0 text-xs text-slate-500">
                                                <span>
                                                    Update terakhir {formatSyncTime(lastUpdatedAt)} • {products.length} menu
                                                </span>
                                                {usingCachedData ? (
                                                    <span className="ml-2 inline-flex items-center gap-1 font-medium text-amber-600">
                                                        <IconWifiOff size={14} />
                                                        Cache lokal
                                                    </span>
                                                ) : null}
                                                {syncError ? (
                                                    <span className="ml-2 font-medium text-rose-600">{syncError}</span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fetchProducts()}
                                                disabled={refreshing}
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                            >
                                                <IconRefresh size={15} className={refreshing ? "animate-spin" : ""} />
                                                Update data terbaru
                                            </button>
                                        </div>
                                        {supportContact?.email || supportContact?.phone || supportContact?.address ? (
                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                                                <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                    Kontak Support
                                                </p>
                                                {supportContact.phone ? <p className="mt-2">No. Telepon: {supportContact.phone}</p> : null}
                                                {supportContact.email ? <p className="mt-1">Email: {supportContact.email}</p> : null}
                                                {supportContact.address ? <p className="mt-1">Alamat Usaha: {supportContact.address}</p> : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modal detail produk (view only) ── */}
            {selectedProduct ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setSelectedProduct(null)}
                    />
                    <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        {(() => {
                            const hasModifiers =
                                Array.isArray(selectedProduct.modifier_options) &&
                                selectedProduct.modifier_options.length > 0;
                            const requiresSelection = Boolean(selectedProduct.requires_modifier_selection);
                            const isOutOfStock = (selectedProduct.stock ?? -1) === 0;

                            const heroClass = isOutOfStock
                                ? "border-slate-200 bg-slate-50"
                                : !hasModifiers
                                  ? "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100"
                                  : requiresSelection
                                    ? "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50"
                                    : "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50";

                            const badgeClass = !hasModifiers
                                ? "bg-slate-100 text-slate-600"
                                : requiresSelection
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-sky-100 text-sky-700";

                            const badgeLabel = !hasModifiers
                                ? "Tanpa topping"
                                : requiresSelection
                                  ? "Topping wajib"
                                  : "Ada topping";

                            const modifierGroups = hasModifiers
                                ? selectedProduct.modifier_options.reduce((acc, opt) => {
                                      const g = String(opt.group_name || "").trim() || "Topping";
                                      if (!acc[g]) acc[g] = [];
                                      acc[g].push(opt);
                                      return acc;
                                  }, {})
                                : {};

                            return (
                                <>
                                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                                Detail Menu
                                            </p>
                                            <h3 className="mt-1 text-lg font-bold text-slate-900">
                                                {selectedProduct.title}
                                            </h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProduct(null)}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        >
                                            <IconX size={18} />
                                        </button>
                                    </div>

                                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                                        {/* Gambar produk */}
                                        <div className="relative mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm">
                                            <LazyImage
                                                src={getProductThumbUrl(selectedProduct.image, selectedProduct.title)}
                                                fallbackSrc={getProductImageUrl(selectedProduct.image, selectedProduct.title)}
                                                alt={selectedProduct.title}
                                                className="aspect-[4/3] w-full"
                                                imgClassName="object-cover"
                                                fallback={
                                                    <div className="flex h-full w-full items-center justify-center bg-slate-100">
                                                        <IconPhoto size={36} className="text-slate-400" />
                                                    </div>
                                                }
                                            />
                                            {/* Badge stok habis di atas gambar */}
                                            {isOutOfStock ? (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                                                    <span className="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-bold text-white shadow">
                                                        Stok Habis
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Info harga + badge */}
                                        <div className={`mb-4 rounded-[28px] border p-4 shadow-sm ${heroClass}`}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {isOutOfStock ? (
                                                    <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600">
                                                        Stok habis
                                                    </span>
                                                ) : (selectedProduct.stock !== null && selectedProduct.stock <= 5 && selectedProduct.stock > 0) ? (
                                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                                        Sisa {selectedProduct.stock}
                                                    </span>
                                                ) : null}
                                                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${badgeClass}`}>
                                                    {badgeLabel}
                                                </span>
                                                {selectedProduct.category?.name ? (
                                                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                                                        {selectedProduct.category.name}
                                                    </span>
                                                ) : null}
                                                {selectedProduct.tenant_outlet?.name ? (
                                                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                                                        {selectedProduct.tenant_outlet.name}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-baseline gap-3">
                                                    <p className={`text-lg font-bold ${isOutOfStock ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                                        {formatPrice(selectedProduct.effective_price ?? selectedProduct.sell_price)}
                                                    </p>
                                                    {selectedProduct.pricing_badge ? (
                                                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                                            {selectedProduct.pricing_badge.label}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="text-sm leading-6 text-slate-600">
                                                    {selectedProduct.description?.trim()
                                                        ? selectedProduct.description
                                                        : isOutOfStock
                                                          ? "Menu ini sedang tidak tersedia."
                                                          : requiresSelection
                                                            ? "Menu ini punya topping wajib."
                                                            : hasModifiers
                                                              ? "Komposisi topping tersedia di bawah."
                                                              : "Menu ini belum memiliki deskripsi tambahan."}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Daftar topping */}
                                        {hasModifiers ? (
                                            <div className="space-y-4">
                                                {Object.entries(modifierGroups).map(([groupName, options]) => (
                                                    <div key={groupName} className="rounded-3xl border border-slate-200 bg-white/80 p-3">
                                                        <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                                            <div>
                                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                                    Kategori topping
                                                                </p>
                                                                <p className="mt-1 text-sm font-bold text-slate-900">{groupName}</p>
                                                            </div>
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                                {options.length} opsi
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {options.map((option) => {
                                                                const toppingOut = option.stock !== null && option.stock <= 0;
                                                                return (
                                                                    <div
                                                                        key={option.id}
                                                                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                                                                            toppingOut
                                                                                ? "border-slate-200 bg-slate-50 opacity-60"
                                                                                : option.price > 0
                                                                                  ? "border-sky-200 bg-sky-50"
                                                                                  : "border-emerald-200 bg-emerald-50"
                                                                        }`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className={`text-sm font-semibold ${toppingOut ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                                                                    {option.name}
                                                                                </p>
                                                                                {toppingOut ? (
                                                                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                                                                                        Habis
                                                                                    </span>
                                        ) : null}

                                        {/* Review section */}
                                        <div className="mt-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <IconStar size={18} className="text-amber-500" />
                                                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                                                    Ulasan Pelanggan
                                                </h4>
                                            </div>

                                            {/* Review list */}
                                            {reviews.length > 0 ? (
                                                <div className="space-y-3">
                                                    {reviews.map((review) => (
                                                        <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1">
                                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                                        <IconStar
                                                                            key={i}
                                                                            size={14}
                                                                            className={i < review.rating ? "text-amber-500 fill-amber-500" : "text-slate-300"}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {review.customer_name || 'Pengguna'}
                                                                </span>
                                                            </div>
                                                            {review.comment?.trim() ? (
                                                                <p className="mt-1.5 text-xs leading-5 text-slate-600">
                                                                    {review.comment}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400">Belum ada ulasan untuk menu ini.</p>
                                            )}

                                            {/* Review form */}
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-xs font-semibold text-slate-700">Tulis ulasan Anda</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setReviewForm((prev) => ({ ...prev, rating: i + 1 }))}
                                                            className="p-0"
                                                        >
                                                            <IconStar
                                                                size={20}
                                                                className={i < reviewForm.rating ? "text-amber-500 fill-amber-500" : "text-slate-300"}
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                                <textarea
                                                    value={reviewForm.comment}
                                                    onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                                                    placeholder="Bagikan pengalaman Anda..."
                                                    rows={2}
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:ring-primary-500"
                                                />
                                                <div className="mt-2 flex items-center justify-between gap-2">
                                                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                                        <input
                                                            type="checkbox"
                                                            checked={reviewForm.is_verified_purchase}
                                                            onChange={(e) => setReviewForm((prev) => ({ ...prev, is_verified_purchase: e.target.checked }))}
                                                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-500"
                                                        />
                                                        Saya sudah memesan di sini
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={submitReview}
                                                        disabled={submittingReview}
                                                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600 disabled:opacity-60"
                                                    >
                                                        {submittingReview ? (
                                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                        ) : (
                                                            <IconSend size={14} />
                                                        )}
                                                        Kirim
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                                                            </div>
                                                                            <p className="mt-0.5 text-xs text-slate-500">
                                                                                {option.price > 0 ? "Topping berbayar" : "Topping gratis"}
                                                                            </p>
                                                                        </div>
                                                                        <div className={`shrink-0 text-sm font-bold ${option.price > 0 ? "text-sky-700" : "text-emerald-700"}`}>
                                                                            {option.price > 0 ? `+ ${formatPrice(option.price)}` : "Gratis"}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            ) : null}
        </>
    );
}
