import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Modal from "@/Components/Dashboard/Modal";
import {
    IconAdjustmentsHorizontal,
    IconBarcode,
    IconCirclePlus,
    IconChevronDown,
    IconChevronUp,
    IconDatabaseOff,
    IconInfoCircle,
    IconLayoutGrid,
    IconList,
    IconPackage,
    IconPencilCog,
    IconPhoto,
    IconPrinter,
    IconSearch,
    IconTrash,
    IconX,
} from "@/Utils/icons";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { getProductImageUrl } from "@/Utils/imageUrl";
import BarcodePrintModal from "@/Components/Barcode/BarcodePrintModal";
import { useAuthorization } from "@/Utils/authorization";
import { setFallbackImage } from "@/Utils/imagePlaceholder";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const defaultFilters = {
    search: "",
    category_id: "",
    tenant_outlet_id: "",
    mapping_status: "",
    stock_status: "",
    sort: "latest",
    per_page: "10",
};

const castFilterValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

const compactFilters = (filters = {}) =>
    Object.fromEntries(
        Object.entries(filters).filter(([, value]) => {
            if (value === null || value === undefined) {
                return false;
            }

            if (typeof value === "string") {
                return value !== "";
            }

            return true;
        })
    );

function OutletStockSummary({ product, activeOutletName = "Outlet aktif" }) {
    const outletStocks = product.outlet_stock_summary ?? [];
    const outletStockCount = Number(product.outlet_stock_count ?? 0);

    if (outletStockCount === 0) {
        return (
            <p className="text-xs text-slate-400 dark:text-slate-500">
                Belum ada stok outlet.
            </p>
        );
    }

    return (
        <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {product.active_outlet_stock !== null && product.active_outlet_stock !== undefined
                    ? `${activeOutletName}: ${product.active_outlet_stock}`
                    : `Total semua outlet: ${product.total_outlet_stock ?? 0}`}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {outletStocks.map((stock) => (
                    <span
                        key={`${product.id}-${stock.outlet_id}`}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                        {stock.outlet_code || "OUT"} {stock.stock}
                    </span>
                ))}
                {outletStockCount > outletStocks.length ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        +{outletStockCount - outletStocks.length} outlet
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function ProductCard({
    product,
    isSelected,
    onToggle,
    canSelect = false,
    canUpdate,
    canDelete,
    canUpdateDailyStock = false,
    onDailyStockUpdate,
    activeOutletName,
    showCostAsPrimary = false,
    showSellPrice = true,
}) {
    const lowStock = product.stock > 0 && product.stock <= 5;
    const outOfStock = product.stock === 0;
    const tenantReady = Boolean(product.tenant_outlet_id);
    const kitchenReady =
        Number(product.active_kitchen_station_mappings_count ?? 0) > 0;
    const promoPrice = Number(product.pricing_badge?.promo_price || 0);
    const promoBasePrice = Number(product.pricing_badge?.base_price || 0);
    const usesTenantRulePromo =
        showCostAsPrimary &&
        product.pricing_badge?.price_basis === "buy_price" &&
        promoPrice > 0 &&
        promoPrice < promoBasePrice;

    return (
        <div
            className={`group overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:shadow-lg dark:bg-slate-900 ${
                isSelected
                    ? "border-primary-500 ring-2 ring-primary-500/20"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
            }`}
        >
            <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                {canSelect ? (
                    <div className="absolute left-2 top-2 z-10">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggle(product)}
                            className="h-5 w-5 cursor-pointer rounded border-2 border-white bg-white/80 text-primary-500 shadow-sm focus:ring-primary-500"
                        />
                    </div>
                ) : null}

                {product.image ? (
                    <img
                        src={getProductImageUrl(product.image, product.title)}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(event) =>
                            setFallbackImage(
                                event,
                                getProductImageUrl(null, product.title)
                            )
                        }
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <IconPhoto
                            size={48}
                            className="text-slate-300 dark:text-slate-600"
                            strokeWidth={1}
                        />
                    </div>
                )}

                <div className="absolute right-2 top-2">
                    {outOfStock ? (
                        <span className="rounded-full bg-danger-500 px-2 py-1 text-xs font-semibold text-white">
                            Habis
                        </span>
                    ) : lowStock ? (
                        <span className="rounded-full bg-warning-500 px-2 py-1 text-xs font-semibold text-white">
                            Stok: {product.stock}
                        </span>
                    ) : (
                        <span className="rounded-full bg-slate-900/60 px-2 py-1 text-xs font-medium text-white">
                            Stok: {product.stock}
                        </span>
                    )}
                </div>

                {(canUpdate || canDelete) && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/40 group-hover:opacity-100">
                        {canUpdate && (
                            <Link
                                href={route("products.edit", product.id)}
                                className="rounded-xl bg-white p-2.5 text-warning-600 shadow-lg transition-colors hover:bg-warning-50"
                            >
                                <IconPencilCog size={18} />
                            </Link>
                        )}
                        {canDelete && (
                            <Button
                                type="delete"
                                icon={<IconTrash size={18} />}
                                className="rounded-xl bg-white p-2.5 text-danger-600 shadow-lg hover:bg-danger-50"
                                url={route("products.destroy", product.id)}
                            />
                        )}
                    </div>
                )}
            </div>

            <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="truncate rounded-md bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-400">
                        {product.category?.name || "Kategori"}
                    </span>
                    <span className="truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {product.tenant_outlet?.code || "Global"}
                    </span>
                </div>

                <div className="mb-2 flex flex-wrap gap-2">
                    <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            tenantReady
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                    >
                        {tenantReady ? "Tenant Siap" : "Tenant Belum"}
                    </span>
                    <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            kitchenReady
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                    >
                        {kitchenReady ? "Dapur Siap" : "Dapur Belum"}
                    </span>
                </div>

                <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {product.title}
                </h3>

                {(product.barcode || product.sku) && (
                    <div className="mb-2 space-y-0.5">
                        {product.barcode ? (
                            <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                                Barcode: {product.barcode}
                            </p>
                        ) : null}
                        {product.sku ? (
                            <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                                SKU: {product.sku}
                            </p>
                        ) : null}
                    </div>
                )}

                <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                    <div className="flex flex-wrap items-end gap-2">
                        {usesTenantRulePromo ? (
                            <p className="text-xs font-semibold text-slate-400 line-through dark:text-slate-500">
                                {formatCurrency(promoBasePrice)}
                            </p>
                        ) : showCostAsPrimary && product.tenant_has_discount ? (
                            <p className="text-xs font-semibold text-slate-400 line-through dark:text-slate-500">
                                {formatCurrency(product.buy_price)}
                            </p>
                        ) : null}
                        <p className="text-base font-bold text-primary-600 dark:text-primary-400">
                            {formatCurrency(
                                showCostAsPrimary
                                    ? usesTenantRulePromo
                                        ? promoPrice
                                        : product.tenant_effective_price ?? product.buy_price
                                    : product.sell_price
                            )}
                        </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            {showCostAsPrimary
                                ? usesTenantRulePromo
                                    ? product.pricing_badge?.label || `Promo tenant dari harga dasar ${formatCurrency(promoBasePrice)}`
                                    : product.tenant_has_discount
                                    ? `Promo tenant dari harga dasar ${formatCurrency(product.buy_price)}`
                                    : `Harga dasar tenant: ${formatCurrency(product.buy_price)}`
                                : `Harga beli: ${formatCurrency(product.buy_price)}`}
                        </p>
                        {showSellPrice && product.sell_price > product.buy_price ? (
                            <span className="text-xs font-medium text-success-600 dark:text-success-400">
                                +{formatCurrency(product.sell_price - product.buy_price)}
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <OutletStockSummary
                            product={product}
                            activeOutletName={activeOutletName}
                        />
                    </div>
                    {canUpdateDailyStock ? (
                        <button
                            type="button"
                            onClick={() => onDailyStockUpdate?.(product)}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                        >
                            Update Stok Hari Ini
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function Index({
    products,
    filters = {},
    setupStatus = {},
    meta = {},
    workspace = {},
}) {
    const { can } = useAuthorization();
    const { activeOutlet, auth } = usePage().props;
    const [viewMode, setViewMode] = useState("grid");
    const [showFilters, setShowFilters] = useState(false);
    const [showSetupGuide, setShowSetupGuide] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [singleProductBarcode, setSingleProductBarcode] = useState(null);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkMapping, setBulkMapping] = useState({
        apply_tenant: true,
        tenant_outlet_id: "",
        apply_kitchen: true,
        kitchen_station_id: "",
    });
    const [dailyStockModalProduct, setDailyStockModalProduct] = useState(null);
    const [dailyStockForm, setDailyStockForm] = useState({
        stock: "",
        notes: "",
    });
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castFilterValue(filters?.search),
        category_id: castFilterValue(filters?.category_id),
        tenant_outlet_id: castFilterValue(filters?.tenant_outlet_id),
        mapping_status: castFilterValue(filters?.mapping_status),
        stock_status: castFilterValue(filters?.stock_status),
        sort: castFilterValue(filters?.sort, "latest"),
        per_page: castFilterValue(filters?.per_page, "10"),
    });

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castFilterValue(filters?.search),
            category_id: castFilterValue(filters?.category_id),
            tenant_outlet_id: castFilterValue(filters?.tenant_outlet_id),
            mapping_status: castFilterValue(filters?.mapping_status),
            stock_status: castFilterValue(filters?.stock_status),
            sort: castFilterValue(filters?.sort, "latest"),
            per_page: castFilterValue(filters?.per_page, "10"),
        });
    }, [filters]);

    useEffect(() => {
        setSelectedProducts([]);
    }, [products?.data]);

    const canCreateProducts = can("products-create");
    const canEditProducts = can("products-edit");
    const canDeleteProducts = can("products-delete");
    const canUpdateProductStock = can("products-stock-update");
    const canManagePricing = can("products-pricing-update");
    const isKitchenWorkspace =
        workspace?.is_kitchen === true || auth?.user?.preferred_workspace === "kitchen";
    const isTenantWorkspace =
        workspace?.is_tenant === true || activeOutlet?.outlet_type === "tenant";
    const canManageCatalog = canCreateProducts && !isTenantWorkspace && !isKitchenWorkspace;
    const canEditCatalog = canEditProducts && !isTenantWorkspace && !isKitchenWorkspace;
    const canDeleteCatalog = canDeleteProducts && !isTenantWorkspace && !isKitchenWorkspace;
    const canUpdateDailyStock = canUpdateProductStock && Boolean(activeOutlet?.id);
    const showCostAsPrimary = isKitchenWorkspace || isTenantWorkspace || !canManagePricing;
    const categories = meta?.categories ?? [];
    const tenantOutlets = meta?.tenantOutlets ?? [];
    const kitchenStations = meta?.kitchenStations ?? [];
    const setupIssueCount =
        Number(setupStatus?.needs_tenant_mapping ? 1 : 0) +
        Number(setupStatus?.needs_station_mapping ? 1 : 0);
    const setupSummaryCards = [
        {
            label: "Tenant Foodcourt",
            value: setupStatus.tenant_outlets_count ?? 0,
            done: true,
        },
        {
            label: "Produk ke Tenant",
            value: setupStatus.products_with_tenant_count ?? 0,
            done: !setupStatus.needs_tenant_mapping,
        },
        {
            label: "Produk tanpa Tenant",
            value: setupStatus.products_without_tenant_count ?? 0,
            done: !setupStatus.needs_tenant_mapping,
        },
        {
            label: "Produk ke Station",
            value: setupStatus.products_with_station_mapping_count ?? 0,
            done: !setupStatus.needs_station_mapping,
        },
    ];

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                    filterData.search ||
                    filterData.category_id ||
                    filterData.tenant_outlet_id ||
                    filterData.mapping_status ||
                    filterData.stock_status ||
                    filterData.sort !== "latest" ||
                    filterData.per_page !== "10"
            ),
        [filterData]
    );

    const activeFilterChips = useMemo(() => {
        const chips = [];

        if (filterData.search) {
            chips.push({
                key: "search",
                label: `Cari: ${filterData.search}`,
            });
        }

        if (filterData.category_id) {
            const matchedCategory = categories.find(
                (category) => String(category.id) === String(filterData.category_id)
            );
            chips.push({
                key: "category_id",
                label: `Kategori: ${matchedCategory?.name || filterData.category_id}`,
            });
        }

        if (filterData.tenant_outlet_id && !isKitchenWorkspace && !isTenantWorkspace) {
            const matchedOutlet = tenantOutlets.find(
                (outlet) => String(outlet.id) === String(filterData.tenant_outlet_id)
            );
            chips.push({
                key: "tenant_outlet_id",
                label:
                    filterData.tenant_outlet_id === "unassigned"
                        ? "Tenant: Global"
                        : `Tenant: ${matchedOutlet?.name || filterData.tenant_outlet_id}`,
            });
        }

        if (filterData.stock_status) {
            const stockStatusLabel = {
                out: "Stok habis",
                low: "Stok menipis",
                ready: "Stok aman",
            };

            chips.push({
                key: "stock_status",
                label: stockStatusLabel[filterData.stock_status] || filterData.stock_status,
            });
        }

        if (filterData.mapping_status && !isKitchenWorkspace && !isTenantWorkspace) {
            const mappingLabel = {
                tenant_missing: "Tenant belum",
                kitchen_missing: "Dapur belum",
                ready: "Siap operasional",
            };

            chips.push({
                key: "mapping_status",
                label: mappingLabel[filterData.mapping_status] || filterData.mapping_status,
            });
        }

        if (filterData.sort !== "latest") {
            const sortLabel = {
                oldest: "Terlama",
                title_asc: "Nama A-Z",
                title_desc: "Nama Z-A",
                price_low: "Harga termurah",
                price_high: "Harga tertinggi",
                stock_low: "Stok terendah",
                stock_high: "Stok tertinggi",
            };

            chips.push({
                key: "sort",
                label: `Urut: ${sortLabel[filterData.sort] || filterData.sort}`,
            });
        }

        return chips;
    }, [categories, filterData, isKitchenWorkspace, isTenantWorkspace, tenantOutlets]);

    const handlePrintSingleBarcode = (product) => {
        setSingleProductBarcode(product);
        setSelectedProducts([]);
        setShowBarcodeModal(true);
    };

    const handlePrintAllBarcodes = () => {
        setSingleProductBarcode(null);
        setSelectedProducts(products.data || []);
        setShowBarcodeModal(true);
    };

    const handlePrintSelected = () => {
        if (selectedProducts.length === 0) return;
        setSingleProductBarcode(null);
        setShowBarcodeModal(true);
    };

    const toggleProductSelection = (product) => {
        setSelectedProducts((prev) => {
            const isSelected = prev.some((item) => item.id === product.id);
            return isSelected
                ? prev.filter((item) => item.id !== product.id)
                : [...prev, product];
        });
    };

    const toggleSelectAll = () => {
        if (selectedProducts.length === (products.data || []).length) {
            setSelectedProducts([]);
            return;
        }

        setSelectedProducts([...(products.data || [])]);
    };

    const isProductSelected = (productId) =>
        selectedProducts.some((item) => item.id === productId);

    const handleChange = (key, value) => {
        setFilterData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("products.index"), compactFilters(filterData), {
            preserveScroll: true,
            preserveState: false,
        });
        setShowFilters(false);
    };

    const submitQuickSearch = (event) => {
        event.preventDefault();
        router.get(route("products.index"), compactFilters(filterData), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        setShowFilters(false);
        router.get(route("products.index"), {}, {
            preserveScroll: false,
            preserveState: false,
            replace: true,
        });
    };

    const applyPerPage = (value) => {
        const nextFilters = {
            ...filterData,
            per_page: value,
        };

        setFilterData(nextFilters);
        router.get(route("products.index"), compactFilters(nextFilters), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const applyQuickFilter = (mappingStatus) => {
        const nextFilters = {
            ...filterData,
            mapping_status: mappingStatus,
            per_page: filterData.per_page || "10",
        };

        setFilterData(nextFilters);
        router.get(route("products.index"), compactFilters(nextFilters), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const rows = products?.data ?? [];
    const total = Number(products?.total ?? rows.length ?? 0);
    const from = Number(products?.from ?? 0);
    const to = Number(products?.to ?? 0);
    const currentPage = Number(products?.current_page ?? 1);
    const perPage = Number(products?.per_page ?? 10);
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];
    const activeOutletName = activeOutlet?.code || activeOutlet?.name || "Outlet aktif";

    const submitBulkMapping = () => {
        if (selectedProducts.length === 0) return;

        router.post(
            route("products.bulk-mapping"),
            {
                product_ids: selectedProducts.map((product) => product.id),
                apply_tenant: bulkMapping.apply_tenant,
                tenant_outlet_id: bulkMapping.tenant_outlet_id || null,
                apply_kitchen: bulkMapping.apply_kitchen,
                kitchen_station_id: bulkMapping.kitchen_station_id || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedProducts([]);
                },
            }
        );
    };

    const openDailyStockModal = (product) => {
        setDailyStockModalProduct(product);
        setDailyStockForm({
            stock: String(product.active_outlet_stock ?? product.stock ?? 0),
            notes: "",
        });
    };

    const closeDailyStockModal = () => {
        setDailyStockModalProduct(null);
        setDailyStockForm({
            stock: "",
            notes: "",
        });
    };

    const submitDailyStockUpdate = (event) => {
        event.preventDefault();

        if (!dailyStockModalProduct) {
            return;
        }

        router.patch(
            route("products.daily-stock.update", dailyStockModalProduct.id),
            {
                stock: Number(dailyStockForm.stock || 0),
                notes: dailyStockForm.notes,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeDailyStockModal();
                },
            }
        );
    };

    return (
        <>
            <Head title="Produk" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Produk
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isKitchenWorkspace
                                ? `Menampilkan produk dapur Anda: ${from || 0}-${to || 0} dari ${total} produk.`
                                : isTenantWorkspace
                                  ? `Menampilkan produk tenant aktif: ${from || 0}-${to || 0} dari ${total} produk.`
                                : `Menampilkan ${from || 0}-${to || 0} dari ${total} produk.`}
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/40"
                        >
                            <IconInfoCircle size={16} />
                            Bantuan
                        </button>

                        {!isKitchenWorkspace && !isTenantWorkspace ? (
                            <button
                                onClick={handlePrintAllBarcodes}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 sm:w-auto"
                                type="button"
                            >
                                <IconBarcode size={18} />
                                Cetak All Barcode
                            </button>
                        ) : null}

                        <Link
                            href={route("products.menu-book")}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 sm:w-auto"
                        >
                            <IconPrinter size={18} />
                            Buku Menu
                        </Link>

                        <button
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto ${
                                showFilters || hasActiveFilters
                                    ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            }`}
                        >
                            <IconAdjustmentsHorizontal size={18} />
                            Filter
                        </button>

                        {canManageCatalog ? (
                            <Button
                                type="link"
                                icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                                className="w-full justify-center bg-primary-500 text-white shadow-lg shadow-primary-500/30 hover:bg-primary-600 sm:w-auto"
                                label="Tambah Produk"
                                href={route("products.create")}
                            />
                        ) : null}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <form onSubmit={submitQuickSearch} className="flex flex-1 flex-col gap-3 sm:flex-row">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={filterData.search}
                                    onChange={(event) =>
                                        handleChange("search", event.target.value)
                                    }
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="Cari nama produk, barcode, SKU, atau deskripsi..."
                                />
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                    <IconSearch size={18} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-600"
                                >
                                    Cari
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowFilters((value) => !value)}
                                    className={`inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                                        showFilters || hasActiveFilters
                                            ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    Pencarian Lanjutan
                                </button>
                            </div>
                        </form>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-slate-500 dark:text-slate-400">
                                    Rows:
                                </label>
                                <select
                                    value={String(perPage)}
                                    onChange={(event) => applyPerPage(event.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    {perPageOptions.map((option) => (
                                        <option key={option} value={String(option)}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => setViewMode("grid")}
                                className={`rounded-lg p-2.5 transition-colors ${
                                    viewMode === "grid"
                                        ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                                title="Grid View"
                                type="button"
                            >
                                <IconLayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`rounded-lg p-2.5 transition-colors ${
                                    viewMode === "list"
                                        ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                                title="List View"
                                type="button"
                            >
                                <IconList size={20} />
                            </button>
                        </div>
                    </div>

                    {activeFilterChips.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {activeFilterChips.map((chip) => (
                                <span
                                    key={chip.key}
                                    className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300"
                                >
                                    {chip.label}
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Reset
                            </button>
                        </div>
                    ) : null}
                </div>

                {isKitchenWorkspace ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                        <p className="font-semibold">Mode dapur aktif</p>
                        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                            Halaman ini hanya menampilkan produk yang terhubung ke station dapur Anda. Gunakan aksi <span className="font-semibold">Update Stok Hari Ini</span> untuk menyesuaikan stok outlet aktif tanpa membuka form admin produk.
                        </p>
                    </div>
                ) : isTenantWorkspace ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                        <p className="font-semibold">Mode tenant aktif</p>
                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                            Tenant hanya melihat produk miliknya sendiri dan di halaman ini hanya dapat memperbarui <span className="font-semibold">Stok Hari Ini</span>. Perubahan katalog, mapping, dan harga tetap dikelola outlet owner.
                        </p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Setup tenant, dapur, dan mapping produk
                                </p>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                    Ringkas dulu agar layar produk tetap fokus. Buka detail hanya saat perlu cek mapping tenant foodcourt atau routing station dapur.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        setupIssueCount === 0
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                    }`}
                                >
                                    {setupIssueCount === 0
                                        ? "Semua mapping siap"
                                        : `${setupIssueCount} area perlu dicek`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowSetupGuide((value) => !value)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    {showSetupGuide ? (
                                        <IconChevronUp size={16} />
                                    ) : (
                                        <IconChevronDown size={16} />
                                    )}
                                    {showSetupGuide ? "Sembunyikan detail setup" : "Buka detail setup"}
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {setupSummaryCards.map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
                                >
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {item.label}
                                    </p>
                                    <div className="mt-1 flex items-end justify-between gap-3">
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                                            {item.value}
                                        </p>
                                        <span
                                            className={`text-[11px] font-semibold ${
                                                item.done
                                                    ? "text-emerald-600 dark:text-emerald-300"
                                                    : "text-amber-600 dark:text-amber-300"
                                            }`}
                                        >
                                            {item.done ? "Siap" : "Cek"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {showSetupGuide ? (
                            <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                                        <p className="font-semibold">Halaman ini untuk katalog dan mapping produk</p>
                                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                                            Setelah outlet, tenant, dan kitchen siap, halaman produk dipakai untuk memastikan setiap produk terhubung ke tenant yang benar dan siap diarahkan ke station dapur yang tepat.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                        <p className="font-semibold">Jika foodcourt aktif, mapping tenant wajib diperhatikan</p>
                                        <p className="mt-1 text-amber-800 dark:text-amber-200">
                                            Produk yang belum dipetakan ke tenant akan terlihat sebagai <span className="font-semibold">Global</span> dan belum cocok untuk settlement tenant foodcourt.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        href={route("guides.setup-wizard")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Wizard Setup
                                    </Link>
                                    <Link
                                        href={route("guides.outlet-kitchen")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Panduan Lengkap
                                    </Link>
                                    {can("outlets-access") ? (
                                        <Link
                                            href={route("outlets.index")}
                                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                        >
                                            Outlet & Tenant
                                        </Link>
                                    ) : null}
                                    <Link
                                        href={route("settings.kitchen-devices.index")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Operasional Dapur & Printer
                                    </Link>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => applyQuickFilter("tenant_missing")}
                                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                                            filterData.mapping_status === "tenant_missing"
                                                ? "bg-amber-500 text-white"
                                                : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                                        }`}
                                    >
                                        Tanpa Tenant ({setupStatus.products_without_tenant_count ?? 0})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickFilter("kitchen_missing")}
                                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                                            filterData.mapping_status === "kitchen_missing"
                                                ? "bg-amber-500 text-white"
                                                : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                                        }`}
                                    >
                                        Tanpa Dapur ({setupStatus.products_without_station_mapping_count ?? 0})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickFilter("ready")}
                                        className={`rounded-xl px-3 py-2 text-sm font-medium ${
                                            filterData.mapping_status === "ready"
                                                ? "bg-emerald-500 text-white"
                                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                                        }`}
                                    >
                                        Siap Operasional
                                    </button>
                                    {filterData.mapping_status ? (
                                        <button
                                            type="button"
                                            onClick={() => applyQuickFilter("")}
                                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                        >
                                            Reset Quick Filter
                                        </button>
                                    ) : null}
                                </div>

                                {setupIssueCount > 0 ? (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                        <p className="font-semibold">Mapping produk masih belum lengkap</p>
                                        <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
                                            {setupStatus.needs_tenant_mapping ? (
                                                <p>• Masih ada produk yang belum dipetakan ke tenant, padahal tenant foodcourt sudah tersedia.</p>
                                            ) : null}
                                            {setupStatus.needs_station_mapping ? (
                                                <p>• Masih ada produk yang belum dipetakan ke station dapur, sehingga ticket kitchen belum akan terpecah otomatis.</p>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                )}

                {showFilters ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Cari
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={filterData.search}
                                            onChange={(event) =>
                                                handleChange("search", event.target.value)
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            placeholder="Nama, barcode, SKU, deskripsi..."
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                            <IconSearch size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Kategori
                                    </label>
                                    <select
                                        value={filterData.category_id}
                                        onChange={(event) =>
                                            handleChange("category_id", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua kategori</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={String(category.id)}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {!isKitchenWorkspace && !isTenantWorkspace ? (
                                    <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tenant Outlet
                                    </label>
                                    <select
                                        value={filterData.tenant_outlet_id}
                                        onChange={(event) =>
                                            handleChange("tenant_outlet_id", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua tenant</option>
                                        <option value="unassigned">Global / belum diassign</option>
                                        {tenantOutlets.map((outlet) => (
                                            <option key={outlet.id} value={String(outlet.id)}>
                                                {outlet.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                ) : null}

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status Stok
                                    </label>
                                    <select
                                        value={filterData.stock_status}
                                        onChange={(event) =>
                                            handleChange("stock_status", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua stok</option>
                                        <option value="out">Habis</option>
                                        <option value="low">Stok menipis</option>
                                        <option value="ready">Stok aman</option>
                                    </select>
                                </div>

                                {!isKitchenWorkspace && !isTenantWorkspace ? (
                                    <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status Mapping
                                    </label>
                                    <select
                                        value={filterData.mapping_status}
                                        onChange={(event) =>
                                            handleChange("mapping_status", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua mapping</option>
                                        <option value="tenant_missing">Tenant belum</option>
                                        <option value="kitchen_missing">Dapur belum</option>
                                        <option value="ready">Siap operasional</option>
                                    </select>
                                </div>
                                ) : null}

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Urutkan
                                    </label>
                                    <select
                                        value={filterData.sort}
                                        onChange={(event) =>
                                            handleChange("sort", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="latest">Terbaru</option>
                                        <option value="oldest">Terlama</option>
                                        <option value="title_asc">Nama A-Z</option>
                                        <option value="title_desc">Nama Z-A</option>
                                        <option value="price_low">Harga terendah</option>
                                        <option value="price_high">Harga tertinggi</option>
                                        <option value="stock_low">Stok terendah</option>
                                        <option value="stock_high">Stok tertinggi</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tampil per halaman
                                    </label>
                                    <select
                                        value={filterData.per_page}
                                        onChange={(event) =>
                                            handleChange("per_page", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {perPageOptions.map((option) => (
                                            <option key={option} value={String(option)}>
                                                {option} row
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                                {hasActiveFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <IconX size={16} />
                                        Reset
                                    </button>
                                ) : null}
                                <button
                                    type="submit"
                                    className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                                >
                                    Terapkan Filter
                                </button>
                            </div>
                        </form>
                    </div>
                ) : null}

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                        <span>
                            Halaman {currentPage} • {rows.length} row tampil • total {total} data
                        </span>
                        {canManageCatalog ? (
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={
                                        selectedProducts.length === rows.length && rows.length > 0
                                    }
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                />
                                <span>Pilih semua di halaman ini</span>
                            </label>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {canManageCatalog && selectedProducts.length > 0 ? (
                            <button
                                onClick={handlePrintSelected}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                                type="button"
                            >
                                <IconPrinter size={18} />
                                Cetak Terpilih ({selectedProducts.length})
                            </button>
                        ) : null}
                    </div>
                </div>

                {products.last_page !== 1 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                        <Pagination links={products.links} />
                    </div>
                ) : null}

                {canManageCatalog && selectedProducts.length > 0 ? (
                    <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5 dark:border-primary-900/40 dark:bg-primary-950/20">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Bulk Mapping Produk
                                </h2>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                    {selectedProducts.length} produk terpilih. Gunakan panel ini untuk assign tenant outlet dan station dapur sekaligus.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedProducts([])}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                Kosongkan Pilihan
                            </button>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={bulkMapping.apply_tenant}
                                        onChange={(event) =>
                                            setBulkMapping((prev) => ({
                                                ...prev,
                                                apply_tenant: event.target.checked,
                                            }))
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                    />
                                    Update tenant outlet
                                </label>
                                <select
                                    value={bulkMapping.tenant_outlet_id}
                                    onChange={(event) =>
                                        setBulkMapping((prev) => ({
                                            ...prev,
                                            tenant_outlet_id: event.target.value,
                                        }))
                                    }
                                    disabled={!bulkMapping.apply_tenant}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Kosongkan / Global</option>
                                    {tenantOutlets.map((outlet) => (
                                        <option key={outlet.id} value={String(outlet.id)}>
                                            {outlet.code} - {outlet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={bulkMapping.apply_kitchen}
                                        onChange={(event) =>
                                            setBulkMapping((prev) => ({
                                                ...prev,
                                                apply_kitchen: event.target.checked,
                                            }))
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                    />
                                    Update station dapur
                                </label>
                                <select
                                    value={bulkMapping.kitchen_station_id}
                                    onChange={(event) =>
                                        setBulkMapping((prev) => ({
                                            ...prev,
                                            kitchen_station_id: event.target.value,
                                        }))
                                    }
                                    disabled={!bulkMapping.apply_kitchen}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Kosongkan mapping kitchen</option>
                                    {kitchenStations.map((station) => (
                                        <option key={station.id} value={String(station.id)}>
                                            {(station.outlet?.code || "OUT")} - {station.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={submitBulkMapping}
                                className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                            >
                                Terapkan Bulk Mapping
                            </button>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Centang hanya bagian yang ingin diubah. Opsi kosong akan menghapus tenant atau kitchen mapping jika bagian itu diterapkan.
                            </p>
                        </div>
                    </div>
                ) : null}

                {rows.length > 0 ? (
                    viewMode === "grid" ? (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {rows.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    isSelected={isProductSelected(product.id)}
                                    onToggle={toggleProductSelection}
                                    canSelect={canManageCatalog}
                                    canUpdate={canEditCatalog}
                                    canDelete={canDeleteCatalog}
                                    canUpdateDailyStock={canUpdateDailyStock}
                                    onDailyStockUpdate={openDailyStockModal}
                                    activeOutletName={activeOutletName}
                                    showCostAsPrimary={showCostAsPrimary}
                                    showSellPrice={canManagePricing}
                                />
                            ))}
                        </div>
                    ) : (
                        <Table.Card title="Data Produk">
                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th className="w-10">No</Table.Th>
                                        <Table.Th>Produk</Table.Th>
                                        <Table.Th>Kategori</Table.Th>
                                        <Table.Th>Tenant</Table.Th>
                                        <Table.Th>Mapping</Table.Th>
                                        <Table.Th>Harga Beli</Table.Th>
                                        {canManagePricing ? <Table.Th>Harga Jual</Table.Th> : null}
                                        <Table.Th>Stok</Table.Th>
                                        <Table.Th>Stok Outlet</Table.Th>
                                        <Table.Th></Table.Th>
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {rows.map((product, i) => (
                                        <tr
                                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            key={product.id}
                                        >
                                            <Table.Td className="text-center">
                                                {i + 1 + (currentPage - 1) * perPage}
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                                                        {product.image ? (
                                                            <img
                                                                src={getProductImageUrl(
                                                                    product.image,
                                                                    product.title
                                                                )}
                                                                alt={product.title}
                                                                className="h-full w-full object-cover"
                                                                onError={(event) =>
                                                                    setFallbackImage(
                                                                        event,
                                                                        getProductImageUrl(
                                                                            null,
                                                                            product.title
                                                                        )
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            <IconPackage
                                                                size={16}
                                                                className="text-slate-400"
                                                            />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                            {product.title}
                                                        </p>
                                                        <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                            {product.barcode ? <p>Barcode: {product.barcode}</p> : null}
                                                            {product.sku ? <p>SKU: {product.sku}</p> : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                    {product.category?.name || "-"}
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                    {product.tenant_outlet?.code || "Global"}
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span
                                                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                                                            product.tenant_outlet_id
                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                                        }`}
                                                    >
                                                        {product.tenant_outlet_id ? "Tenant Siap" : "Tenant Belum"}
                                                    </span>
                                                    <span
                                                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                                                            Number(product.active_kitchen_station_mappings_count ?? 0) > 0
                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                                        }`}
                                                    >
                                                        {Number(product.active_kitchen_station_mappings_count ?? 0) > 0
                                                            ? "Dapur Siap"
                                                            : "Dapur Belum"}
                                                    </span>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {showCostAsPrimary &&
                                                        product.pricing_badge?.price_basis === "buy_price" &&
                                                        Number(product.pricing_badge?.promo_price || 0) > 0 &&
                                                        Number(product.pricing_badge?.promo_price || 0) <
                                                            Number(product.pricing_badge?.base_price || 0) ? (
                                                            <p className="text-xs font-semibold text-slate-400 line-through dark:text-slate-500">
                                                                {formatCurrency(product.pricing_badge?.base_price)}
                                                            </p>
                                                        ) : showCostAsPrimary && product.tenant_has_discount ? (
                                                            <p className="text-xs font-semibold text-slate-400 line-through dark:text-slate-500">
                                                                {formatCurrency(product.buy_price)}
                                                            </p>
                                                        ) : null}
                                                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                            {formatCurrency(
                                                                showCostAsPrimary
                                                                    ? product.pricing_badge?.price_basis === "buy_price" &&
                                                                      Number(product.pricing_badge?.promo_price || 0) > 0 &&
                                                                      Number(product.pricing_badge?.promo_price || 0) <
                                                                          Number(product.pricing_badge?.base_price || 0)
                                                                        ? product.pricing_badge?.promo_price
                                                                        : product.tenant_effective_price ?? product.buy_price
                                                                    : product.buy_price
                                                            )}
                                                        </p>
                                                    </div>
                                                    {showCostAsPrimary ? (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {product.pricing_badge?.price_basis === "buy_price" &&
                                                            Number(product.pricing_badge?.promo_price || 0) > 0 &&
                                                            Number(product.pricing_badge?.promo_price || 0) <
                                                                Number(product.pricing_badge?.base_price || 0)
                                                                ? product.pricing_badge?.label || "Promo tenant aktif dari rule outlet."
                                                                : product.tenant_has_discount
                                                                ? "Promo tenant aktif dari harga dasar."
                                                                : "Harga utama untuk operasional dapur."}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </Table.Td>
                                            {canManagePricing ? (
                                                <Table.Td className="font-semibold text-primary-600 dark:text-primary-400">
                                                    {formatCurrency(product.sell_price)}
                                                </Table.Td>
                                            ) : null}
                                            <Table.Td>
                                                <span
                                                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                        product.stock === 0
                                                            ? "bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-400"
                                                            : product.stock <= 5
                                                              ? "bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400"
                                                              : "bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-400"
                                                    }`}
                                                >
                                                    {product.stock}
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <OutletStockSummary
                                                    product={product}
                                                    activeOutletName={activeOutletName}
                                                />
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex gap-2">
                                                    {canUpdateDailyStock ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openDailyStockModal(product)}
                                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                                                        >
                                                            Stok Hari Ini
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrintSingleBarcode(product)}
                                                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                    >
                                                        <IconPrinter size={16} />
                                                    </button>
                                                    {canEditCatalog ? (
                                                        <Button
                                                            type="edit"
                                                            icon={<IconPencilCog size={16} strokeWidth={1.5} />}
                                                            className="border border-warning-200 bg-warning-100 text-warning-600 hover:bg-warning-200 dark:border-warning-800 dark:bg-warning-900/50 dark:text-warning-400"
                                                            href={route("products.edit", product.id)}
                                                        />
                                                    ) : null}
                                                    {canDeleteCatalog ? (
                                                        <Button
                                                            type="delete"
                                                            icon={<IconTrash size={16} strokeWidth={1.5} />}
                                                            className="border border-danger-200 bg-danger-100 text-danger-600 hover:bg-danger-200 dark:border-danger-800 dark:bg-danger-900/50 dark:text-danger-400"
                                                            url={route("products.destroy", product.id)}
                                                        />
                                                    ) : null}
                                                </div>
                                            </Table.Td>
                                        </tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.Card>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <IconDatabaseOff
                                size={32}
                                className="text-slate-400"
                                strokeWidth={1.5}
                            />
                        </div>
                        <h3 className="mb-1 text-lg font-medium text-slate-800 dark:text-slate-200">
                            Belum Ada Produk
                        </h3>
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            Tambahkan produk pertama Anda untuk memulai.
                        </p>
                        {canCreateProducts ? (
                            <Button
                                type="link"
                                icon={<IconCirclePlus size={18} />}
                                className="bg-primary-500 text-white hover:bg-primary-600"
                                label="Tambah Produk"
                                href={route("products.create")}
                            />
                        ) : null}
                    </div>
                )}

                {products.last_page !== 1 ? <Pagination links={products.links} /> : null}

                <BarcodePrintModal
                    isOpen={showBarcodeModal}
                    onClose={() => {
                        setShowBarcodeModal(false);
                        setSingleProductBarcode(null);
                    }}
                    products={selectedProducts}
                    singleProduct={singleProductBarcode}
                />

                {dailyStockModalProduct ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
                        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                                        Update Stok Harian
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                        {dailyStockModalProduct.title}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Outlet aktif: {activeOutletName}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeDailyStockModal}
                                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <form onSubmit={submitDailyStockUpdate} className="mt-5 space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Stok saat ini
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                                        {dailyStockModalProduct.active_outlet_stock ?? dailyStockModalProduct.stock ?? 0}
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Stok fisik hari ini
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={dailyStockForm.stock}
                                        onChange={(event) =>
                                            setDailyStockForm((prev) => ({
                                                ...prev,
                                                stock: event.target.value,
                                            }))
                                        }
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Catatan
                                    </label>
                                    <textarea
                                        value={dailyStockForm.notes}
                                        onChange={(event) =>
                                            setDailyStockForm((prev) => ({
                                                ...prev,
                                                notes: event.target.value,
                                            }))
                                        }
                                        rows={3}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        placeholder="Contoh: stok pagi, restock, atau koreksi fisik."
                                    />
                                </div>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeDailyStockModal}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                                    >
                                        Simpan Stok Hari Ini
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : null}
            </div>

            <Modal
                show={showHelpModal}
                onClose={() => setShowHelpModal(false)}
                title="Bantuan Produk"
                maxWidth="2xl"
            >
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Fungsi Halaman Produk
                        </p>
                        <p className="mt-2">
                            Halaman ini adalah pusat pengelolaan katalog produk. Di sini Anda bisa menambah, mengedit, menghapus, dan mengelola stok serta mapping produk ke tenant foodcourt dan station dapur.
                        </p>
                        <p className="mt-2">
                            Produk yang sudah lengkap mapping-nya akan siap digunakan di transaksi POS, kitchen dispatch, dan settlement tenant foodcourt.
                        </p>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Fitur Utama
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Tambah Produk</strong>: buat produk baru lengkap dengan barcode, SKU, harga beli, harga jual, dan gambar.</li>
                            <li><strong>Edit Produk</strong>: ubah detail produk, stok, atau mapping tenant/kitchen.</li>
                            <li><strong>Hapus Produk</strong>: hapus produk yang sudah tidak digunakan.</li>
                            <li><strong>Cetak Barcode</strong>: cetak label barcode untuk satu produk, produk terpilih, atau semua produk.</li>
                            <li><strong>Buku Menu</strong>: lihat dan cetak buku menu untuk pelanggan.</li>
                            <li><strong>Bulk Mapping</strong>: assign tenant outlet dan station dapur ke banyak produk sekaligus.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Mapping Tenant & Dapur
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Tenant Outlet</strong>: tentukan produk milik tenant mana. Produk tanpa tenant akan tampil sebagai <em>Global</em>.</li>
                            <li><strong>Station Dapur</strong>: tentukan ke station dapur mana produk diarahkan saat transaksi dine-in. Produk tanpa station tidak akan muncul di layar kitchen.</li>
                            <li>Gunakan filter <strong>Status Mapping</strong> untuk cepat menemukan produk yang belum lengkap mapping-nya.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Cara Menggunakan
                        </p>
                        <ol className="mt-2 list-decimal space-y-2 pl-5">
                            <li>Gunakan <strong>Pencarian Cepat</strong> di bagian atas untuk mencari produk berdasarkan nama, barcode, SKU, atau deskripsi.</li>
                            <li>Klik <strong>Filter</strong> untuk pencarian lanjutan dengan kategori, tenant, status stok, status mapping, dan urutan.</li>
                            <li>Pilih tampilan <strong>Grid</strong> atau <strong>List</strong> sesuai preferensi Anda.</li>
                            <li>Gunakan <strong>Buku Menu</strong> untuk mencetak katalog produk yang rapi untuk pelanggan.</li>
                            <li>Manfaatkan <strong>Bulk Mapping</strong> dengan memilih beberapa produk lalu assign tenant dan station dapur sekaligus.</li>
                            <li>Panel <strong>Setup</strong> di bagian atas memberi ringkasan status mapping dan link cepat ke wizard setup.</li>
                        </ol>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Update Stok Harian
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Tombol <strong>Update Stok Hari Ini</strong> muncul pada setiap produk di tampilan grid.</li>
                            <li>Gunakan untuk menyesuaikan stok outlet aktif tanpa masuk ke form edit produk lengkap.</li>
                            <li>Perubahan stok akan tercatat sebagai mutasi dan bisa dilacak di halaman Mutasi Stok.</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Catatan Penting
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Produk tanpa tenant mapping tidak akan muncul di settlement foodcourt.</li>
                            <li>Produk tanpa kitchen station mapping tidak akan muncul di layar dapur saat transaksi dine-in.</li>
                            <li>Jika bekerja sebagai tenant atau dapur, Anda hanya melihat produk milik sendiri.</li>
                            <li>Gunakan Barcode Print Modal untuk mencetak label barcode dalam jumlah banyak.</li>
                            <li>Stok outlet saat ini ditampilkan di setiap kartu produk dan di kolom tabel list view.</li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
