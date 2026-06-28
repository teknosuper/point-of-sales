import ProductGrid from "@/Components/POS/ProductGrid";
import LazyImage from "@/Components/Dashboard/LazyImage";
import { Head } from "@inertiajs/react";
import { getProductImageUrl, getProductThumbUrl } from "@/Utils/imageUrl";
import {
    IconPhoto,
    IconRefresh,
    IconWifiOff,
    IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const AUTO_REFRESH_INTERVAL = 30 * 1000;

export default function MenuCatalog({
    outlet,
    store,
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
    const searchInputRef = useRef(null);
    const cacheKey = `public-menu:catalog:${outlet?.code || store?.name || "default"}`;

    const formatPrice = (value = 0) =>
        Number(value || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatSyncTime = (value) => {
        if (!value) {
            return "Belum pernah";
        }

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
        if (typeof window === "undefined") {
            return null;
        }

        try {
            const raw = window.localStorage.getItem(cacheKey);
            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed?.products)) {
                return null;
            }

            return parsed;
        } catch (error) {
            console.error("Failed to read public menu cache:", error);
            return null;
        }
    }, [cacheKey]);

    const writeCache = useCallback((items, timestamp) => {
        if (typeof window === "undefined") {
            return;
        }

        try {
            window.localStorage.setItem(
                cacheKey,
                JSON.stringify({
                    products: items,
                    updated_at: timestamp,
                })
            );
        } catch (error) {
            console.error("Failed to write public menu cache:", error);
        }
    }, [cacheKey]);

    const fetchProducts = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setRefreshing(true);
        }
        setSyncError("");

        try {
            const buildParams = (page) => {
                const params = new URLSearchParams();
                params.append("per_page", "100");
                params.append("page", String(page));

                if (outlet?.code) {
                    params.append("outlet_code", outlet.code);
                }

                return params;
            };

            const loadPage = async (page) => {
                const response = await fetch(
                    `/api/public/catalog/products?${buildParams(page).toString()}`
                );

                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                return response.json();
            };

            const firstPayload = await loadPage(1);
            const allProducts = Array.isArray(firstPayload.data)
                ? [...firstPayload.data]
                : [];
            const lastPage = Number(firstPayload?.meta?.last_page || 1);

            for (let page = 2; page <= lastPage; page += 1) {
                const payload = await loadPage(page);
                if (Array.isArray(payload.data)) {
                    allProducts.push(...payload.data);
                }
            }

            const nextProducts = allProducts;
            const syncedAt = new Date().toISOString();

            setProducts(nextProducts);
            setLastUpdatedAt(syncedAt);
            setUsingCachedData(false);
            writeCache(nextProducts, syncedAt);
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
    }, [outlet?.code, readCache, writeCache]);

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
        const intervalId = window.setInterval(() => {
            fetchProducts({ silent: true });
        }, AUTO_REFRESH_INTERVAL);

        return () => window.clearInterval(intervalId);
    }, [fetchProducts]);

    useEffect(() => {
        const handleVisibilityRefresh = () => {
            if (document.visibilityState === "visible") {
                fetchProducts({ silent: true });
            }
        };

        const handleFocusRefresh = () => {
            fetchProducts({ silent: true });
        };

        window.addEventListener("focus", handleFocusRefresh);
        document.addEventListener("visibilitychange", handleVisibilityRefresh);

        return () => {
            window.removeEventListener("focus", handleFocusRefresh);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityRefresh
            );
        };
    }, [fetchProducts]);

    useEffect(() => {
        const handleShortcut = (event) => {
            if (
                event.key !== "/" ||
                event.defaultPrevented ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            ) {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement &&
                ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
            ) {
                return;
            }

            event.preventDefault();
            searchInputRef.current?.focus();
        };

        window.addEventListener("keydown", handleShortcut);

        return () => window.removeEventListener("keydown", handleShortcut);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const syncViewportMode = () => {
            const width = window.innerWidth || 0;
            const height = window.innerHeight || 0;
            const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;

            setIsShortLandscape(
                Boolean(coarsePointer) && width >= 640 && width > height && height <= 560
            );
        };

        syncViewportMode();
        window.addEventListener("resize", syncViewportMode);
        window.addEventListener("orientationchange", syncViewportMode);

        return () => {
            window.removeEventListener("resize", syncViewportMode);
            window.removeEventListener("orientationchange", syncViewportMode);
        };
    }, []);

    return (
        <>
            <Head title={store?.name ? `Daftar Menu ${store.name}` : "Daftar Menu"} />

            <div className="min-h-screen min-h-dvh bg-slate-100">
                <div
                    className={`mx-auto flex w-full max-w-7xl flex-col px-3 sm:px-4 lg:px-6 ${
                        isShortLandscape
                            ? "min-h-dvh py-3"
                            : "min-h-screen min-h-dvh py-4"
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
                                    {Array.from({ length: 10 }).map((_, index) => (
                                        <div
                                            key={index}
                                            className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <ProductGrid
                                        products={products}
                                        searchQuery={searchQuery}
                                        onSearchChange={setSearchQuery}
                                        onSearch={() => undefined}
                                        isSearching={false}
                                        searchInputRef={searchInputRef}
                                        interactive={false}
                                        onProductSelect={setSelectedProduct}
                                        searchPlaceholder="Cari menu favorit... (tekan / untuk fokus)"
                                        emptyMessage={
                                            searchQuery
                                                ? "Menu tidak ditemukan"
                                                : "Belum ada menu yang bisa ditampilkan"
                                        }
                                        enableBarcodeScanner={false}
                                    sortControlVariant="chips"
                                    filterPanelCollapsible={false}
                                    tenantSectionLabel="Dapur"
                                    allTenantLabel="Semua Dapur"
                                    gridLayoutClass="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                                    listLayoutClass="grid grid-cols-1 gap-3"
                                    compactHeaderLayout={true}
                                    showFilterSummary={false}
                                    groupByCategoryWhenTenantFiltered={true}
                                    storageNamespace={`public-menu:${
                                        outlet?.code || store?.name || "default"
                                    }`}
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
                                                    <span className="ml-2 font-medium text-rose-600">
                                                        {syncError}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fetchProducts()}
                                                disabled={refreshing}
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                            >
                                                <IconRefresh
                                                    size={15}
                                                    className={refreshing ? "animate-spin" : ""}
                                                />
                                                Update data terbaru
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
                            const requiresSelection = Boolean(
                                selectedProduct.requires_modifier_selection
                            );
                            const heroClass = !hasModifiers
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
                                ? selectedProduct.modifier_options.reduce(
                                      (groups, option) => {
                                          const groupName =
                                              String(option.group_name || "").trim() ||
                                              "Topping";

                                          if (!groups[groupName]) {
                                              groups[groupName] = [];
                                          }

                                          groups[groupName].push(option);

                                          return groups;
                                      },
                                      {}
                                  )
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
                                        <div className="mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm">
                                            <LazyImage
                                                src={getProductThumbUrl(
                                                    selectedProduct.image,
                                                    selectedProduct.title
                                                )}
                                                fallbackSrc={getProductImageUrl(
                                                    selectedProduct.image,
                                                    selectedProduct.title
                                                )}
                                                alt={selectedProduct.title}
                                                className="aspect-[4/3] w-full"
                                                imgClassName="object-cover"
                                                fallback={
                                                    <div className="flex h-full w-full items-center justify-center bg-slate-100">
                                                        <IconPhoto
                                                            size={36}
                                                            className="text-slate-400"
                                                        />
                                                    </div>
                                                }
                                            />
                                        </div>

                                        <div className={`mb-4 rounded-[28px] border p-4 shadow-sm ${heroClass}`}>
                                            <div className="flex flex-wrap items-center gap-2">
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
                                            <div className="mt-3 space-y-3">
                                                <p className="text-lg font-bold text-slate-900">
                                                    {formatPrice(
                                                        selectedProduct.effective_price ??
                                                            selectedProduct.sell_price
                                                    )}
                                                </p>
                                                <p className="text-sm leading-6 text-slate-600">
                                                    {selectedProduct.description?.trim()
                                                        ? selectedProduct.description
                                                        : requiresSelection
                                                          ? "Menu ini punya topping wajib. Pilihan topping perlu diperhatikan sebelum order."
                                                          : hasModifiers
                                                            ? "Komposisi topping ditampilkan di bawah agar item dengan topping langsung mudah dibedakan."
                                                            : "Menu ini belum memiliki deskripsi tambahan."}
                                                </p>
                                            </div>
                                        </div>
                                        {hasModifiers ? (
                                            <div className="space-y-4">
                                                {Object.entries(modifierGroups).map(
                                                    ([groupName, options]) => (
                                                        <div
                                                            key={groupName}
                                                            className="rounded-3xl border border-slate-200 bg-white/80 p-3"
                                                        >
                                                            <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                                                <div>
                                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                                        Kategori topping
                                                                    </p>
                                                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                                                        {groupName}
                                                                    </p>
                                                                </div>
                                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                                    {options.length} opsi
                                                                </span>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {options.map((option) => (
                                                                    <div
                                                                        key={option.id}
                                                                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                                                                            option.price > 0
                                                                                ? "border-sky-200 bg-sky-50"
                                                                                : "border-emerald-200 bg-emerald-50"
                                                                        }`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-semibold text-slate-900">
                                                                                {option.name}
                                                                            </p>
                                                                            <p className="mt-0.5 text-xs text-slate-500">
                                                                                {option.price > 0
                                                                                    ? "Topping berbayar"
                                                                                    : "Topping gratis"}
                                                                            </p>
                                                                        </div>
                                                                        <div
                                                                            className={`shrink-0 text-sm font-bold ${
                                                                                option.price > 0
                                                                                    ? "text-sky-700"
                                                                                    : "text-emerald-700"
                                                                            }`}
                                                                        >
                                                                            {option.price > 0
                                                                                ? `+ ${formatPrice(option.price)}`
                                                                                : "Gratis"}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                )}
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
