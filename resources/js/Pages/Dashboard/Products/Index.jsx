import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import Button from "@/Components/Dashboard/Button";
import Modal from "@/Components/Dashboard/Modal";
import {
    IconAdjustmentsHorizontal,
    IconBarcode,
    IconCirclePlus,
    IconChevronDown,
    IconChevronUp,
    IconCopy,
    IconDatabaseOff,
    IconInfoCircle,
    IconAlertTriangle,
    IconLayoutGrid,
    IconList,
    IconPackage,
    IconPencilCheck,
    IconPencilCog,
    IconPhoto,
    IconPrinter,
    IconSearch,
    IconStar,
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
    featured: "",
    penalty_status: "",
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
                Belum ada data stok outlet.
            </p>
        );
    }

    return (
        <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Stok terpusat:{" "}
                {product.display_stock ??
                    product.active_outlet_stock ??
                    product.total_outlet_stock ??
                    product.stock ??
                    0}
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
    onToggleFeatured,
    onApplyShadowBan,
    onUpdatePenaltyStatus,
    canViewPenaltyInfo = false,
}) {
    const displayStock = Number(
        product.display_stock ??
            product.active_outlet_stock ??
            product.total_outlet_stock ??
            product.stock ??
            0
    );
    const lowStock = displayStock > 0 && displayStock <= 5;
    const outOfStock = displayStock === 0;
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
                            Stok: {displayStock}
                        </span>
                    ) : (
                        <span className="rounded-full bg-slate-900/60 px-2 py-1 text-xs font-medium text-white">
                            Stok: {displayStock}
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
                        {canUpdate && (
                            <button
                                type="button"
                                onClick={() => onToggleFeatured?.(product)}
                                className={`rounded-xl bg-white p-2.5 shadow-lg transition-colors hover:bg-amber-50 ${
                                    product.is_featured ? "text-amber-600" : "text-slate-400"
                                }`}
                                title={product.is_featured ? "Hapus featured" : "Jadikan featured"}
                            >
                                <IconStar size={18} />
                            </button>
                        )}
                        {canUpdate && (
                            <>
                                {canViewPenaltyInfo && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onApplyShadowBan?.(product)}
                                            className={`rounded-xl bg-white p-2.5 shadow-lg transition-colors ${
                                                product.shadow_banned_at
                                                    ? "hover:bg-blue-50 text-blue-600"
                                                    : "hover:bg-rose-50 text-slate-400"
                                            }`}
                                            title={product.shadow_banned_at ? "Buka shadow ban" : "Shadow ban"}
                                        >
                                            <IconX size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onUpdatePenaltyStatus?.(product)}
                                            className={`rounded-xl bg-white p-2.5 shadow-lg transition-colors hover:bg-amber-50 ${
                                                product.penalty_status
                                                    ? "text-amber-600"
                                                    : "text-slate-400"
                                            }`}
                                            title="Ubah status penalty"
                                        >
                                            <IconAlertTriangle size={18} />
                                        </button>
                                    </>
                                )}
                            </>
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
                    {product.is_featured ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Featured
                        </span>
                    ) : null}
                    {canViewPenaltyInfo && product.shadow_banned_at ? (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                            Shadow Ban
                        </span>
                    ) : null}
                    {canViewPenaltyInfo && product.penalty_status ? (
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            product.penalty_status === 'under_review'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : product.penalty_status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                            {product.penalty_status === 'under_review' ? 'Under Review' : product.penalty_status === 'accepted' ? 'Accepted' : 'Rejected'}
                        </span>
                    ) : null}
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
                            Sesuaikan Stok Hari Ini
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
    const { can, isSuperAdmin } = useAuthorization();
    const { activeOutlet, auth, flash } = usePage().props;
    const canViewPenaltyInfo = isSuperAdmin() ||
        auth.roleNames?.includes('admin-sistem') ||
        (activeOutlet?.outlet_type === 'main' &&
         ['admin-owner-outlet', 'outlet-owner'].some(role => auth.roleNames?.includes(role)));
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
        featured: castFilterValue(filters?.featured),
        penalty_status: castFilterValue(filters?.penalty_status),
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
            featured: castFilterValue(filters?.featured),
            penalty_status: castFilterValue(filters?.penalty_status),
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
    const canOpenCreateProduct = canCreateProducts && !isKitchenWorkspace;
    const canManageCatalog = canCreateProducts && !isTenantWorkspace && !isKitchenWorkspace;
    const canManageModifierStocks =
        canEditProducts && !isTenantWorkspace;
    const canEditCatalog = canEditProducts && !isTenantWorkspace;
    const canOpenTenantProductEdit = canEditProducts && isTenantWorkspace;
    const canDeleteCatalog =
        canDeleteProducts &&
        !isTenantWorkspace &&
        !isKitchenWorkspace &&
        isSuperAdmin();
    const canUpdateDailyStock = canUpdateProductStock && Boolean(activeOutlet?.id);
    const showCostAsPrimary = isKitchenWorkspace || isTenantWorkspace || !canManagePricing;
    const categories = meta?.categories ?? [];
    const tenantOutlets = meta?.tenantOutlets ?? [];
    const modifierSourceProducts = meta?.modifierSourceProducts ?? [];
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
                    filterData.featured ||
                    filterData.penalty_status ||
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
                featured_first: "Featured",
                shadow_banned_desc: "Shadow Ban terbaru",
            };

            chips.push({
                key: "sort",
                label: `Urut: ${sortLabel[filterData.sort] || filterData.sort}`,
            });
        }

        if (filterData.featured !== "") {
            chips.push({
                key: "featured",
                label: filterData.featured === "1" ? "Featured saja" : "Non-featured",
            });
        }

        if (filterData.penalty_status !== "" && canViewPenaltyInfo) {
            const penaltyLabel = {
                shadow_banned: "Shadow Banned",
                active: "Aktif",
                under_review: "Under Review",
                accepted: "Accepted",
                rejected: "Rejected",
            };

            chips.push({
                key: "penalty_status",
                label: `Status: ${penaltyLabel[filterData.penalty_status] || filterData.penalty_status}`,
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

    const submitDailyStockUpdate = async (event) => {
        event.preventDefault();

        if (!dailyStockModalProduct) {
            return;
        }

        const nextStock = Number(dailyStockForm.stock || 0);
        const result = await Swal.fire({
            title: "Simpan Stok Harian?",
            text: `${dailyStockModalProduct.title} akan disesuaikan menjadi ${new Intl.NumberFormat("id-ID").format(nextStock)} item.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Simpan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        router.patch(
            route("products.daily-stock.update", dailyStockModalProduct.id),
            {
                stock: nextStock,
                notes: dailyStockForm.notes,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeDailyStockModal();
                    router.reload({
                        only: ["products"],
                        preserveScroll: true,
                    });
                },
            }
        );
    };

    const handleToggleFeatured = async (product) => {
        const nextFeatured = !product.is_featured;
        const result = await Swal.fire({
            title: nextFeatured ? "Jadikan Featured?" : "Hapus Featured?",
            text: `${product.title} akan ${nextFeatured ? "ditampilkan di bagian atas" : "dikeluarkan dari featured"} daftar menu.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya",
            cancelButtonText: "Batal",
            confirmButtonColor: "#2563eb",
            reverseButtons: true,
        });

        if (!result.isConfirmed) return;

        router.patch(
            route("products.toggle-featured", product.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    router.reload({ only: ["products"], preserveScroll: true });
                },
            }
        );
    };

    const handleApplyShadowBan = async (product) => {
        const result = await Swal.fire({
            title: product.shadow_banned_at ? "Buka Shadow Ban?" : "Shadow Ban produk?",
            text: product.shadow_banned_at
                ? `${product.title} akan muncul kembali di pencarian dan daftar menu publik.`
                : `${product.title} akan disembunyikan dari pencarian dan daftar menu publik.`,
            input: !product.shadow_banned_at ? "text" : undefined,
            inputLabel: !product.shadow_banned_at ? "Alasan shadow ban (opsional)" : undefined,
            inputPlaceholder: !product.shadow_banned_at ? "Contoh: kualitas tidak memenuhi standar" : undefined,
            showCancelButton: true,
            confirmButtonText: product.shadow_banned_at ? "Ya, Buka Ban" : "Ya, Shadow Ban",
            cancelButtonText: "Batal",
            confirmButtonColor: product.shadow_banned_at ? "#2563eb" : "#dc2626",
            reverseButtons: true,
        });

        if (!result.isConfirmed) return;

        if (product.shadow_banned_at) {
            router.patch(
                route("products.penalty-status", product.id),
                { status: "accepted" },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        router.reload({ only: ["products"], preserveScroll: true });
                    },
                }
            );
        } else {
            router.patch(
                route("products.shadow-ban", product.id),
                { reason: result.value || null },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        router.reload({ only: ["products"], preserveScroll: true });
                    },
                }
            );
        }
    };

    const handleUpdatePenaltyStatus = async (product) => {
        const currentStatus = product.penalty_status || "";
        if (!currentStatus) {
            await Swal.fire({
                title: "Status Penalty",
                text: `${product.title} belum memiliki status penalty.`,
                icon: "info",
                confirmButtonText: "OK",
            });
            return;
        }

        const result = await Swal.fire({
            title: "Ubah Status Penalty?",
            text: `${product.title} — Status saat ini: ${currentStatus}`,
            input: "select",
            inputOptions: {
                under_review: "Under Review",
                accepted: "Accepted (unban)",
                rejected: "Rejected (keep banned)",
            },
            inputValue: currentStatus,
            showCancelButton: true,
            confirmButtonText: "Simpan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#2563eb",
            reverseButtons: true,
        });

        if (!result.isConfirmed) return;

        const newStatus = result.value;
        if (!newStatus || newStatus === currentStatus) return;

        router.patch(
            route("products.penalty-status", product.id),
            { status: newStatus },
            {
                preserveScroll: true,
                onSuccess: () => {
                    router.reload({ only: ["products"], preserveScroll: true });
                },
            }
        );
    };

    const [showBulkStockModal, setShowBulkStockModal] = useState(false);
    const [bulkStockEntries, setBulkStockEntries] = useState([]);
    const [bulkStockNotes, setBulkStockNotes] = useState("");
    const [bulkStockApplyAllValue, setBulkStockApplyAllValue] = useState("");
    const [showBulkModifierModal, setShowBulkModifierModal] = useState(false);
    const [bulkModifierSourceId, setBulkModifierSourceId] = useState("");
    const [showBulkModifierStockModal, setShowBulkModifierStockModal] = useState(false);
    const [bulkModifierStockEntries, setBulkModifierStockEntries] = useState([]);
    const [bulkModifierStockApplyAllValue, setBulkModifierStockApplyAllValue] =
        useState("");
    const [bulkModifierStockTargetCount, setBulkModifierStockTargetCount] =
        useState(0);
    const [isLoadingBulkModifierStockPreview, setIsLoadingBulkModifierStockPreview] =
        useState(false);
    const [bulkModifierStockNormalizeNames, setBulkModifierStockNormalizeNames] =
        useState(true);

    const openBulkStockModal = () => {
        const allRows = products?.data ?? [];

        if (allRows.length === 0) {
            return;
        }

        setBulkStockEntries(
            allRows.map((product) => ({
                product_id: product.id,
                title: product.title,
                barcode: product.barcode || "—",
                current_stock: String(
                    product.active_outlet_stock ?? product.stock ?? 0
                ),
                stock: String(
                    product.active_outlet_stock ?? product.stock ?? 0
                ),
            }))
        );
        setBulkStockNotes("");
        setBulkStockApplyAllValue("");
        setShowBulkStockModal(true);
    };

    const closeBulkStockModal = () => {
        setShowBulkStockModal(false);
        setBulkStockEntries([]);
        setBulkStockNotes("");
        setBulkStockApplyAllValue("");
    };

    const availableModifierSourceProducts = useMemo(
        () =>
            modifierSourceProducts.length > 0
                ? modifierSourceProducts
                : rows.filter((product) => Boolean(product.supports_modifiers)),
        [modifierSourceProducts, rows]
    );

    const openBulkModifierModal = () => {
        if (selectedProducts.length === 0) return;

        const firstMatchingSource = availableModifierSourceProducts.find((product) =>
            selectedProducts.some((selected) => selected.id === product.id)
        );

        setBulkModifierSourceId(
            firstMatchingSource ? String(firstMatchingSource.id) : ""
        );
        setShowBulkModifierModal(true);
    };

    const closeBulkModifierModal = () => {
        setShowBulkModifierModal(false);
        setBulkModifierSourceId("");
    };

    const openBulkModifierStockModal = async () => {
        const targetProducts =
            selectedProducts.length > 0 ? selectedProducts : rows;
        const applyFilteredScope = selectedProducts.length === 0;

        if (targetProducts.length === 0) return;

        setIsLoadingBulkModifierStockPreview(true);

        try {
            const response = await axios.post(
                route("products.bulk-modifier-stocks.preview"),
                {
                    target_product_ids: applyFilteredScope
                        ? []
                        : targetProducts.map((product) => product.id),
                    apply_filtered_scope: applyFilteredScope,
                    filters: filterData,
                }
            );

            const payload = response.data;

            setBulkModifierStockEntries(payload.entries || []);
            setBulkModifierStockTargetCount(
                Number(payload.target_count || targetProducts.length)
            );
            setBulkModifierStockApplyAllValue("");
            setShowBulkModifierStockModal(true);
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Gagal membuka data topping",
                text: "Preview stok topping tidak berhasil dimuat.",
            });
        } finally {
            setIsLoadingBulkModifierStockPreview(false);
        }
    };

    const closeBulkModifierStockModal = () => {
        setShowBulkModifierStockModal(false);
        setBulkModifierStockEntries([]);
        setBulkModifierStockApplyAllValue("");
        setBulkModifierStockTargetCount(0);
    };

    const submitBulkModifierCopy = (event) => {
        event.preventDefault();

        if (!bulkModifierSourceId || selectedProducts.length === 0) {
            return;
        }

        router.post(
            route("products.bulk-copy-modifiers"),
            {
                source_product_id: Number(bulkModifierSourceId),
                target_product_ids: selectedProducts.map((product) => product.id),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeBulkModifierModal();
                    setSelectedProducts([]);
                },
            }
        );
    };

    const submitBulkModifierStockUpdate = (event) => {
        event.preventDefault();

        const targetProducts =
            selectedProducts.length > 0 ? selectedProducts : rows;
        const applyFilteredScope = selectedProducts.length === 0;

        const modifierStocks = bulkModifierStockEntries
            .filter((entry) => entry.name && entry.group_name)
            .map((entry) => ({
                group_name: entry.group_name,
                name: entry.name,
                stock:
                    entry.stock === "" || entry.stock === null
                        ? null
                        : Number(entry.stock),
            }));

        if (modifierStocks.length === 0 || targetProducts.length === 0) {
            return;
        }

        Swal.fire({
            title: "Simpan stok topping?",
            text: applyFilteredScope
                ? `Perubahan akan diterapkan ke semua produk sesuai filter aktif (${new Intl.NumberFormat("id-ID").format(total)} produk).`
                : `Perubahan akan diterapkan ke ${new Intl.NumberFormat("id-ID").format(targetProducts.length)} produk terpilih.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Simpan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            reverseButtons: true,
        }).then((result) => {
            if (!result.isConfirmed) {
                return;
            }

            router.post(
                route("products.bulk-modifier-stocks.update"),
                {
                    target_product_ids: applyFilteredScope
                        ? []
                        : targetProducts.map((product) => product.id),
                    apply_filtered_scope: applyFilteredScope,
                    normalize_names: bulkModifierStockNormalizeNames,
                    filters: filterData,
                    modifier_stocks: modifierStocks,
                },
                {
                    preserveScroll: true,
                    onSuccess: (page) => {
                        const successMessage =
                            page?.props?.flash?.success ||
                            flash?.success ||
                            null;
                        const errorMessage =
                            page?.props?.flash?.error || flash?.error || null;

                        if (errorMessage) {
                            Swal.fire({
                                icon: "error",
                                title: "Gagal menyimpan",
                                text: errorMessage,
                            });

                            return;
                        }

                        closeBulkModifierStockModal();
                        setSelectedProducts([]);
                        Swal.fire({
                            icon: "success",
                            title: "Berhasil",
                            text:
                                successMessage ||
                                "Stok topping berhasil disimpan.",
                            timer: 1800,
                            showConfirmButton: false,
                        });
                    },
                    onError: () => {
                        Swal.fire({
                            icon: "error",
                            title: "Gagal menyimpan",
                            text: "Perubahan stok topping tidak berhasil disimpan.",
                        });
                    },
                }
            );
        });
    };

    const applyBulkModifierStockToAll = () => {
        const normalizedValue = String(
            Math.max(0, Number(bulkModifierStockApplyAllValue || 0))
        );

        setBulkModifierStockEntries((prev) =>
            prev.map((entry) => ({
                ...entry,
                stock: normalizedValue,
            }))
        );
    };

    const applyBulkStockToAll = () => {
        const normalizedValue = String(
            Math.max(0, Number(bulkStockApplyAllValue || 0))
        );

        setBulkStockEntries((prev) =>
            prev.map((entry) => ({
                ...entry,
                stock: normalizedValue,
            }))
        );
    };

    const submitBulkStockUpdate = async (event) => {
        event.preventDefault();

        const changedEntries = bulkStockEntries
            .filter(
                (entry) =>
                    Number(entry.stock || 0) !== Number(entry.current_stock || 0)
            )
            .map((entry) => ({
                product_id: entry.product_id,
                stock: Number(entry.stock || 0),
            }));

        if (changedEntries.length === 0) {
            closeBulkStockModal();
            return;
        }

        const totalProducts = changedEntries.length;
        const result = await Swal.fire({
            title: "Simpan Stok Massal?",
            text: `${new Intl.NumberFormat("id-ID").format(totalProducts)} produk akan diperbarui untuk outlet aktif ${activeOutletName}.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Simpan Semua",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        router.post(
            route("products.bulk-stock.update"),
            {
                notes: bulkStockNotes,
                stocks: changedEntries,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeBulkStockModal();
                    router.reload({
                        only: ["products"],
                        preserveScroll: true,
                    });
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

                        {canUpdateProductStock && activeOutlet?.id ? (
                            <button
                                onClick={openBulkStockModal}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 sm:w-auto"
                                type="button"
                            >
                                <IconPencilCheck size={18} />
                                Update Stok Massal
                            </button>
                        ) : null}

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

                        {canOpenCreateProduct ? (
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
                            Halaman ini hanya menampilkan produk yang terhubung ke station dapur Anda. Gunakan aksi <span className="font-semibold">Sesuaikan Stok Hari Ini</span> untuk menyesuaikan stok outlet aktif tanpa membuka form admin produk.
                        </p>
                    </div>
                ) : isTenantWorkspace ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                        <p className="font-semibold">Mode tenant aktif</p>
                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                            Tenant hanya melihat produk miliknya sendiri. Owner tenant dapat mengubah <span className="font-semibold">nama produk</span>, <span className="font-semibold">HPP</span>, <span className="font-semibold">harga jual tenant</span>, dan <span className="font-semibold">stok hari ini</span>, sedangkan harga outlet, mapping, kategori, barcode, dan struktur katalog tetap dikelola outlet owner.
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
                                        Featured
                                    </label>
                                    <select
                                        value={filterData.featured}
                                        onChange={(event) =>
                                            handleChange("featured", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua</option>
                                        <option value="1">Featured</option>
                                        <option value="0">Non-featured</option>
                                    </select>
                                </div>

                                {canViewPenaltyInfo && (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Status Penalty
                                        </label>
                                        <select
                                            value={filterData.penalty_status}
                                            onChange={(event) =>
                                                handleChange("penalty_status", event.target.value)
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        >
                                            <option value="">Semua status</option>
                                            <option value="shadow_banned">Shadow Banned</option>
                                            <option value="active">Aktif</option>
                                            <option value="under_review">Under Review</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>
                                )}

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
                                        <option value="featured_first">Featured</option>
                                        {canViewPenaltyInfo && <option value="shadow_banned_desc">Shadow Ban terbaru</option>}
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
                        {canManageCatalog || canManageModifierStocks ? (
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
                        {canManageCatalog ? (
                            <button
                                onClick={openBulkModifierModal}
                                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
                                type="button"
                                disabled={selectedProducts.length === 0}
                            >
                                <IconCopy size={18} />
                                Salin Topping
                            </button>
                        ) : null}
                        {canManageModifierStocks ? (
                            <button
                                onClick={openBulkModifierStockModal}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                type="button"
                                disabled={rows.length === 0}
                            >
                                <IconPackage size={18} />
                                Stok Topping
                            </button>
                        ) : null}
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

                {canManageModifierStocks ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                        <span className="font-semibold">Manajemen topping terpusat:</span> klik <span className="font-semibold">Stok Topping</span> untuk mengubah topping di semua produk yang sedang tampil. Jika Anda mencentang produk tertentu, update hanya berlaku ke produk terpilih.
                    </div>
                ) : null}

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

                        <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/40 dark:bg-slate-900">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Samakan topping banyak produk
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Pilih satu produk sumber, lalu salin seluruh group dan opsi topping ke semua produk terpilih.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={openBulkModifierModal}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
                                >
                                    <IconCopy size={18} />
                                    Salin Topping Massal
                                </button>
                            </div>
                            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Kelola stok topping terpusat
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Ubah stok topping yang sama ke semua produk terpilih tanpa perlu membuka edit tiap produk.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={openBulkModifierStockModal}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                                >
                                    <IconPackage size={18} />
                                    Stok Topping Terpusat
                                </button>
                            </div>
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
                                    canSelect={canManageCatalog || canManageModifierStocks}
                                    canUpdate={canEditCatalog || canOpenTenantProductEdit}
                                    canDelete={canDeleteCatalog}
                                    canUpdateDailyStock={canUpdateDailyStock}
                                    onDailyStockUpdate={openDailyStockModal}
                                    activeOutletName={activeOutletName}
                                    showCostAsPrimary={showCostAsPrimary}
                                    showSellPrice={canManagePricing}
                                    onToggleFeatured={handleToggleFeatured}
                                    onApplyShadowBan={handleApplyShadowBan}
                                    onUpdatePenaltyStatus={handleUpdatePenaltyStatus}
                                    canViewPenaltyInfo={canViewPenaltyInfo}
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
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {product.is_featured ? (
                                                                <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                                                    Featured
                                                                </span>
                                                            ) : null}
                                                            {canViewPenaltyInfo && product.shadow_banned_at ? (
                                                                <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                                                    Shadow Ban
                                                                </span>
                                                            ) : null}
                                                            {canViewPenaltyInfo && product.penalty_status ? (
                                                                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                                                                    product.penalty_status === 'under_review'
                                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                        : product.penalty_status === 'accepted'
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}>
                                                                    {product.penalty_status === 'under_review' ? 'Under Review' : product.penalty_status === 'accepted' ? 'Accepted' : 'Rejected'}
                                                                </span>
                                                            ) : null}
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
                                                <div className="flex flex-wrap gap-2">
                                                    {(canEditCatalog || canOpenTenantProductEdit) ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleFeatured(product)}
                                                                className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition hover:bg-amber-50 ${
                                                                    product.is_featured
                                                                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                                                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                }`}
                                                                title={product.is_featured ? "Hapus featured" : "Jadikan featured"}
                                                            >
                                                                <IconStar size={16} />
                                                            </button>
                                                            {canViewPenaltyInfo && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApplyShadowBan(product)}
                                                                        className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition hover:bg-rose-50 ${
                                                                            product.shadow_banned_at
                                                                                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                                                                                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                        }`}
                                                                        title={product.shadow_banned_at ? "Buka shadow ban" : "Shadow ban"}
                                                                    >
                                                                        <IconX size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdatePenaltyStatus(product)}
                                                                        className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition hover:bg-amber-50 ${
                                                                            product.penalty_status
                                                                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                                                                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                        }`}
                                                                        title="Ubah status penalty"
                                                                    >
                                                                        <IconAlertTriangle size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : null}
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
                                                    {canEditCatalog || canOpenTenantProductEdit ? (
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

                {showBulkStockModal ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
                        <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                                        Update Stok Massal
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                        {bulkStockEntries.length} produk • Outlet {activeOutletName}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Sesuaikan stok banyak produk sekaligus untuk outlet aktif.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeBulkStockModal}
                                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <form onSubmit={submitBulkStockUpdate} className="flex flex-col min-h-0 flex-1">
                                <div className="flex-1 overflow-y-auto px-6 py-4">
                                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                            Apply ke Semua Produk
                                        </p>
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                            <input
                                                type="number"
                                                min="0"
                                                value={bulkStockApplyAllValue}
                                                onChange={(event) =>
                                                    setBulkStockApplyAllValue(event.target.value)
                                                }
                                                className="h-11 flex-1 rounded-xl border border-emerald-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-slate-200"
                                                placeholder="Masukkan stok yang sama untuk semua"
                                            />
                                            <button
                                                type="button"
                                                onClick={applyBulkStockToAll}
                                                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
                                            >
                                                Terapkan ke Semua
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        {bulkStockEntries.map((entry, index) => (
                                            <div
                                                key={entry.product_id}
                                                className="grid grid-cols-12 gap-3 items-center rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            >
                                                <div className="col-span-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                                                    {index + 1}
                                                </div>
                                                <div className="col-span-5 min-w-0">
                                                    <p className="break-words text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {entry.title}
                                                    </p>
                                                    <p className="break-all text-xs text-slate-400 dark:text-slate-500">
                                                        {entry.barcode}
                                                    </p>
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                                        Stok saat ini
                                                    </span>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                        {entry.current_stock}
                                                    </p>
                                                </div>
                                                <div className="col-span-4">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={entry.stock}
                                                        onChange={(event) =>
                                                            setBulkStockEntries((prev) =>
                                                                prev.map((item) =>
                                                                    item.product_id === entry.product_id
                                                                        ? { ...item, stock: event.target.value }
                                                                        : item
                                                                )
                                                            )
                                                        }
                                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 text-center outline-none transition focus:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800 space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Catatan (opsional)
                                        </label>
                                        <textarea
                                            value={bulkStockNotes}
                                            onChange={(event) => setBulkStockNotes(event.target.value)}
                                            rows={2}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            placeholder="Contoh: stok opname pagi, restock massal, atau koreksi stok outlet."
                                        />
                                    </div>

                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center">
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            Perubahan akan disimpan dengan mutasi stok dan audit log.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={closeBulkStockModal}
                                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                                            >
                                                Simpan Semua Stok
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : null}

                {showBulkModifierModal ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
                        <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
                                        Salin Topping Massal
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                        Terapkan topping ke {selectedProducts.length} produk
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Pilih satu produk sumber. Topping target akan ditimpa mengikuti produk sumber.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeBulkModifierModal}
                                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <form onSubmit={submitBulkModifierCopy} className="mt-5 space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Produk sumber topping
                                    </label>
                                    <select
                                        value={bulkModifierSourceId}
                                        onChange={(event) =>
                                            setBulkModifierSourceId(event.target.value)
                                        }
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-amber-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        required
                                    >
                                        <option value="">Pilih produk sumber</option>
                                        {availableModifierSourceProducts.map((product) => (
                                            <option key={product.id} value={String(product.id)}>
                                                {product.tenant_outlet_name
                                                    ? `${product.title} - ${product.tenant_outlet_name}`
                                                    : product.title}
                                            </option>
                                        ))}
                                    </select>
                                    {availableModifierSourceProducts.length === 0 ? (
                                        <p className="mt-2 text-xs text-rose-500">
                                            Tidak ada produk bertopping yang bisa dijadikan sumber.
                                        </p>
                                    ) : null}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Produk target
                                    </p>
                                    <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                                        {selectedProducts.map((product) => (
                                            <span
                                                key={product.id}
                                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                                            >
                                                {product.title}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeBulkModifierModal}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!bulkModifierSourceId}
                                        className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Terapkan Topping
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : null}

                {showBulkModifierStockModal ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
                        <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                                        Stok Topping Terpusat
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                        Kelola stok topping di{" "}
                                        {selectedProducts.length > 0
                                            ? selectedProducts.length
                                            : bulkModifierStockTargetCount || total}{" "}
                                        produk
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {selectedProducts.length > 0
                                            ? "Setiap baris di bawah akan memperbarui topping dengan nama yang sama ke semua produk terpilih yang memilikinya."
                                            : "Tidak ada produk yang dipilih. Update akan diterapkan ke semua produk dalam workspace aktif yang sesuai filter, tidak dibatasi pagination halaman ini."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeBulkModifierStockModal}
                                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <form
                                onSubmit={submitBulkModifierStockUpdate}
                                className="flex min-h-0 flex-1 flex-col"
                            >
                                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                            Apply ke Semua Topping
                                        </p>
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                            <input
                                                type="number"
                                                min="0"
                                                value={bulkModifierStockApplyAllValue}
                                                onChange={(event) =>
                                                    setBulkModifierStockApplyAllValue(
                                                        event.target.value
                                                    )
                                                }
                                                className="h-11 flex-1 rounded-xl border border-emerald-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-slate-200"
                                                placeholder="Masukkan stok yang sama untuk semua topping"
                                            />
                                            <button
                                                type="button"
                                                onClick={applyBulkModifierStockToAll}
                                                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
                                            >
                                                Terapkan ke Semua
                                            </button>
                                        </div>
                                    </div>

                                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={bulkModifierStockNormalizeNames}
                                            onChange={(e) => setBulkModifierStockNormalizeNames(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                                        />
                                        <span>
                                            Normalisasi nama topping
                                        </span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            — cocokkan meski ada perbedaan spasi, tanda hubung, atau kapitalisasi
                                        </span>
                                    </label>

                                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                                        {isLoadingBulkModifierStockPreview ? (
                                            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                Memuat data topping...
                                            </div>
                                        ) : null}
                                        {bulkModifierStockEntries.length > 0 ? (
                                            bulkModifierStockEntries.map((entry) => (
                                                <div
                                                    key={entry.key}
                                                    className="grid grid-cols-12 items-center gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"
                                                >
                                                    <div className="col-span-7 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {entry.name}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Grup: {entry.group_name} • Dipakai di {entry.product_count} produk • {entry.option_count} baris topping
                                                        </p>
                                                        {entry.variant_count > 1 ? (
                                                            <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                                                                Nama mirip tergabung: {entry.variant_names.join(", ")}
                                                            </p>
                                                        ) : null}
                                                        {entry.has_mixed_stock ? (
                                                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                                                                Stok saat ini berbeda antar produk: {entry.min_stock} - {entry.max_stock}
                                                            </p>
                                                        ) : entry.min_stock !== null ? (
                                                            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                                                                Stok saat ini: {entry.min_stock}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="col-span-5">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={entry.stock}
                                                            onChange={(event) =>
                                                                setBulkModifierStockEntries((prev) =>
                                                                    prev.map((item) =>
                                                                        item.key === entry.key
                                                                            ? { ...item, stock: event.target.value }
                                                                            : item
                                                                    )
                                                                )
                                                            }
                                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-sm text-slate-700 outline-none transition focus:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                            placeholder="Stok topping"
                                                        />
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                Produk terpilih belum memiliki topping yang bisa dikelola terpusat.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={closeBulkModifierStockModal}
                                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={bulkModifierStockEntries.length === 0}
                                            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                                        >
                                            Simpan Stok Topping
                                        </button>
                                    </div>
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
