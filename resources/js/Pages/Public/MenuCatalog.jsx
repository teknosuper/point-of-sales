import ProductGrid from "@/Components/POS/ProductGrid";
import usePwaInstall from "@/Hooks/usePwaInstall";
import { Head } from "@inertiajs/react";
import {
    IconDownload,
    IconRefresh,
    IconWifiOff,
    IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

export default function MenuCatalog({
    outlet,
    store,
}) {
    const {
        appLabel,
        canPromptInstall,
        installHelpText,
        promptInstall,
        shouldShowInstallEntry,
    } = usePwaInstall();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [usingCachedData, setUsingCachedData] = useState(false);
    const [syncError, setSyncError] = useState("");
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
            const params = new URLSearchParams();
            params.append("include_out_of_stock", "1");

            if (outlet?.code) {
                params.append("outlet_code", outlet.code);
            }

            const response = await fetch(
                `/api/public/catalog/products?${params.toString()}`
            );
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const payload = await response.json();
            const nextProducts = Array.isArray(payload.data) ? payload.data : [];
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

    const handleInstallApp = useCallback(async () => {
        if (canPromptInstall) {
            await promptInstall();
            return;
        }

        toast(installHelpText, {
            duration: 5000,
            icon: "📲",
        });
    }, [canPromptInstall, installHelpText, promptInstall]);

    return (
        <>
            <Head title={store?.name ? `Daftar Menu ${store.name}` : "Daftar Menu"} />

            <div className="min-h-screen bg-slate-100">
                <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-4 sm:px-4 lg:px-6">
                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="min-h-[calc(100vh-2rem)] bg-slate-100">
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
                                        onProductSelect={(product) => {
                                            if (
                                                Array.isArray(product?.modifier_options) &&
                                                product.modifier_options.length > 0
                                            ) {
                                                setSelectedProduct(product);
                                            }
                                        }}
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
                                        <div className="flex flex-wrap items-center justify-between gap-3">
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
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                    Detail Topping
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
                            <div className="space-y-3">
                                {selectedProduct.modifier_options.map((option) => (
                                    <div
                                        key={option.id}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {option.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                Topping tambahan untuk menu ini
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-sm font-bold text-primary-600">
                                            {option.price > 0
                                                ? `+ ${formatPrice(option.price)}`
                                                : "Gratis"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {shouldShowInstallEntry ? (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden">
                    <div className="pointer-events-auto w-full max-w-md rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                        <button
                            type="button"
                            onClick={handleInstallApp}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            <IconDownload size={16} />
                            Install {appLabel}
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
