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
        isCheckingInstallState,
        isChromeLike,
        isInstalled,
        installHelpText,
        isIos,
        isPwaEnabled,
        isStandalone,
        promptInstall,
        shouldShowInstallEntry,
    } = usePwaInstall();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showInstallDebug, setShowInstallDebug] = useState(false);
    const [showInstallGuide, setShowInstallGuide] = useState(false);
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
                params.append("include_out_of_stock", "1");
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

    const handleInstallApp = useCallback(async () => {
        if (canPromptInstall) {
            await promptInstall();
            return;
        }

        setShowInstallGuide(true);
    }, [canPromptInstall, promptInstall]);

    const installGuideSteps = isIos
        ? [
              "Buka menu ini dari Safari di iPhone atau iPad.",
              "Tap tombol Bagikan di browser.",
              "Pilih Tambahkan ke Layar Utama.",
          ]
        : isChromeLike
          ? [
                "Buka menu browser Chrome atau Edge.",
                "Pilih Install app atau Tambahkan ke layar utama.",
                "Konfirmasi pemasangan GTC Menu ke perangkat.",
            ]
          : [
                "Buka menu browser di perangkat Anda.",
                "Cari opsi Tambahkan ke layar utama atau Install app.",
                "Ikuti konfirmasi yang tersedia di browser.",
            ];

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

            {shouldShowInstallEntry && !isCheckingInstallState ? (
                <div
                    className={`fixed z-[90] print:hidden ${
                        isShortLandscape
                            ? "bottom-3 right-3 left-auto w-[min(22rem,calc(100vw-1.5rem))]"
                            : "inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4"
                    }`}
                >
                    <div className="mx-auto w-full max-w-md rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                        <button
                            type="button"
                            onClick={handleInstallApp}
                            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
                        >
                            <IconDownload size={16} />
                            {canPromptInstall
                                ? `Install ${appLabel}`
                                : `Cara Install ${appLabel}`}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setShowInstallDebug((current) => !current)
                            }
                            className="mt-2 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                            {showInstallDebug
                                ? "Sembunyikan status perangkat"
                                : "Lihat status perangkat"}
                        </button>
                        {showInstallDebug && (
                            <div className="mt-2 rounded-2xl bg-slate-100 p-3 text-xs text-slate-600">
                                <div className="grid grid-cols-2 gap-2">
                                    <span>Prompt browser</span>
                                    <span className="font-semibold text-right">
                                        {canPromptInstall ? "Siap" : "Belum"}
                                    </span>
                                    <span>Sudah terpasang</span>
                                    <span className="font-semibold text-right">
                                        {isInstalled ? "Ya" : "Belum"}
                                    </span>
                                    <span>Mode standalone</span>
                                    <span className="font-semibold text-right">
                                        {isStandalone ? "Aktif" : "Tidak"}
                                    </span>
                                    <span>Browser iOS</span>
                                    <span className="font-semibold text-right">
                                        {isIos ? "Ya" : "Tidak"}
                                    </span>
                                    <span>Chrome / Edge</span>
                                    <span className="font-semibold text-right">
                                        {isChromeLike ? "Ya" : "Tidak"}
                                    </span>
                                    <span>PWA aktif</span>
                                    <span className="font-semibold text-right">
                                        {isPwaEnabled ? "Ya" : "Tidak"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : !isCheckingInstallState && !isInstalled && !isStandalone ? (
                <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 print:hidden">
                    <div className="mx-auto w-full max-w-md rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                        <button
                            type="button"
                            onClick={handleInstallApp}
                            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
                        >
                            <IconDownload size={16} />
                            Cara Install {appLabel}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setShowInstallDebug((current) => !current)
                            }
                            className="mt-2 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                            {showInstallDebug
                                ? "Sembunyikan status perangkat"
                                : "Lihat status perangkat"}
                        </button>
                        {showInstallDebug && (
                            <div className="mt-2 rounded-2xl bg-slate-100 p-3 text-xs text-slate-600">
                                <div className="grid grid-cols-2 gap-2">
                                    <span>Prompt browser</span>
                                    <span className="font-semibold text-right">
                                        {canPromptInstall ? "Siap" : "Belum"}
                                    </span>
                                    <span>Sudah terpasang</span>
                                    <span className="font-semibold text-right">
                                        {isInstalled ? "Ya" : "Belum"}
                                    </span>
                                    <span>Mode standalone</span>
                                    <span className="font-semibold text-right">
                                        {isStandalone ? "Aktif" : "Tidak"}
                                    </span>
                                    <span>Browser iOS</span>
                                    <span className="font-semibold text-right">
                                        {isIos ? "Ya" : "Tidak"}
                                    </span>
                                    <span>Chrome / Edge</span>
                                    <span className="font-semibold text-right">
                                        {isChromeLike ? "Ya" : "Tidak"}
                                    </span>
                                    <span>PWA aktif</span>
                                    <span className="font-semibold text-right">
                                        {isPwaEnabled ? "Ya" : "Tidak"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {showInstallGuide ? (
                <div className="fixed inset-0 z-[95] flex items-end justify-center p-3 sm:items-center sm:p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setShowInstallGuide(false)}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                    Install {appLabel}
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900">
                                    Panduan install di perangkat ini
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInstallGuide(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                            >
                                <IconX size={18} />
                            </button>
                        </div>
                        <div className="space-y-4 px-5 py-4">
                            <p className="text-sm text-slate-500">
                                {installHelpText}
                            </p>
                            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                                {installGuideSteps.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ol>
                            <button
                                type="button"
                                onClick={() => setShowInstallGuide(false)}
                                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
