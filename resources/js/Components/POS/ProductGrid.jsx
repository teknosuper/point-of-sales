import React, { useEffect, useState } from "react";
import {
    IconShoppingBag,
    IconPhoto,
    IconSearch,
    IconCamera,
    IconChevronDown,
    IconChevronUp,
    IconAdjustmentsHorizontal,
    IconLayoutGrid,
    IconList,
} from "@/Utils/icons";
import { getProductImageUrl, getProductThumbUrl } from "@/Utils/imageUrl";
import LazyImage from "@/Components/Dashboard/LazyImage";
import CameraBarcodeScanner from "./CameraBarcodeScanner";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const storageKey = (namespace, suffix) =>
    `${namespace || "pos:product-grid"}:${suffix}`;

const promoExplanation = (badge) => {
    if (!badge) {
        return null;
    }

    return badge.detail || badge.rule_name || badge.label || null;
};

// Single Product Card
function ProductCard({
    product,
    onAddToCart,
    isAdding,
    viewMode = "list",
    interactive = true,
    onProductSelect,
}) {
    const hasStock = product.stock > 0;
    const lowStock = product.stock > 0 && product.stock <= 5;
    const promoBadge = product.pricing_badge;
    const basePrice = Number(promoBadge?.base_price || product.sell_price || 0);
    const effectivePrice = Number(
        product.effective_price ?? promoBadge?.promo_price ?? product.sell_price ?? 0
    );
    const promoPriceCandidates = [
        Number(promoBadge?.promo_price || 0),
        effectivePrice,
    ].filter(
        (value) => Number.isFinite(value) && value > 0 && value < basePrice
    );
    const promoPrice =
        promoPriceCandidates.length > 0
            ? Math.min(...promoPriceCandidates)
            : 0;
    const showPromo = promoBadge && promoPrice > 0 && promoPrice < basePrice;
    const showBadge = Boolean(promoBadge?.label);
    const promoDetail = promoExplanation(promoBadge);
    const isListMode = viewMode === "list";
    const hasModifierOptions = Array.isArray(product?.modifier_options)
        && product.modifier_options.length > 0;
    const secondaryLabel =
        product.tenant_outlet?.name || product.category?.name || "-";
    const isSelectable =
        interactive ||
        (typeof onProductSelect === "function" && hasModifierOptions);
    const CardTag = isSelectable ? "button" : "div";
    const cardProps = isSelectable
        ? {
              onClick: () => {
                  if (interactive && hasStock) {
                      onAddToCart?.(product);
                      return;
                  }

                  onProductSelect?.(product);
              },
              disabled: interactive ? !hasStock || isAdding : false,
              type: "button",
          }
        : {};

    return (
        <CardTag
            {...cardProps}
            className={`
                group relative flex bg-white dark:bg-slate-900
                rounded-2xl border border-slate-200 dark:border-slate-800
                transition-all duration-200
                ${
                    isSelectable && hasStock
                        ? "hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                        : hasStock
                          ? ""
                          : "opacity-60"
                } ${isListMode ? "w-full items-center gap-2 px-2.5 py-1.5 text-left" : "flex-col overflow-hidden rounded-xl"}
            `}
        >
            {!isListMode && (
                <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {product.image ? (
                        <LazyImage
                            src={getProductThumbUrl(product.image, product.title)}
                            fallbackSrc={getProductImageUrl(
                                product.image,
                                product.title
                            )}
                            alt={product.title}
                            className="h-full w-full"
                            imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
                            fallback={
                                <div className="flex h-full w-full items-center justify-center">
                                    <IconPhoto
                                        size={isListMode ? 18 : 24}
                                        className="text-slate-400"
                                    />
                                </div>
                            }
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <IconPhoto
                                size={32}
                                className="text-slate-300 dark:text-slate-600"
                            />
                        </div>
                    )}

                    {lowStock && (
                        <span className="absolute top-2 right-2 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-900/50 dark:text-warning-400">
                            Sisa {product.stock}
                        </span>
                    )}

                    {showBadge && (
                        <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg">
                            {promoBadge.label}
                        </span>
                    )}

                    {!hasStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                            <span className="rounded-full bg-danger-500 px-3 py-1 text-xs font-semibold text-white">
                                Habis
                            </span>
                        </div>
                    )}

                    {interactive && hasStock && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary-500/10 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                                Pilih Menu
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Product Info */}
            <div
                className={`flex-1 p-3 flex ${
                    isListMode
                        ? "min-w-0 items-center justify-between gap-2 p-0"
                        : "min-h-0 flex-col justify-between p-2"
                }`}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                        {!isListMode && secondaryLabel !== "-" && (
                            <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <span className="truncate">
                                    {secondaryLabel}
                                </span>
                            </span>
                        )}
                        {showBadge && !showPromo && (
                            <span className="inline-flex rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                                Promo
                            </span>
                        )}
                        {!hasStock && (
                            <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Habis
                            </span>
                        )}
                        {lowStock && hasStock && (
                            <span className="inline-flex rounded-full bg-warning-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning-700 dark:bg-warning-900/50 dark:text-warning-400">
                                Sisa {product.stock}
                            </span>
                        )}
                    </div>
                    <h3 className={`font-semibold truncate ${
                        isListMode 
                            ? "text-xs leading-tight" 
                            : "mt-1 text-[13px] leading-tight"
                    } text-slate-800 dark:text-slate-200`}>
                        {product.title}
                    </h3>
                    <div className={`${isListMode ? "mt-0.5" : "mt-0.5"} space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400`}>
                        <p className="truncate">
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                {secondaryLabel}
                            </span>
                        </p>
                        <p>
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                {Number(product.stock || 0)} tersisa
                            </span>
                        </p>
                        {!interactive && hasModifierOptions && (
                            <p className="font-medium text-primary-600 dark:text-primary-300">
                                Ada topping, klik untuk detail topping
                            </p>
                        )}
                    </div>
                </div>
                <div
                    className={`${
                        isListMode
                            ? "flex shrink-0 flex-col items-end text-right"
                            : "mt-1.5"
                    }`}
                >
                    {showPromo && (
                        <p className={`${isListMode ? "text-[11px]" : "text-[10px]"} text-slate-400 line-through`}>
                            {formatPrice(basePrice)}
                        </p>
                    )}
                    <p className={`font-bold text-primary-600 dark:text-primary-400 ${
                        isListMode ? "text-xs" : "text-[13px]"
                    }`}>
                        {formatPrice(showPromo ? promoPrice : product.sell_price)}
                    </p>
                    {promoDetail && (
                        <p
                            className={`mt-0.5 max-w-[180px] text-[10px] leading-3 ${
                                isListMode
                                    ? "text-right text-rose-600 dark:text-rose-300"
                                    : "text-rose-600 dark:text-rose-300"
                            }`}
                        >
                            {promoDetail}
                        </p>
                    )}
                    {interactive && isListMode && hasStock && (
                        <span className="mt-1 inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                            Tambah
                        </span>
                    )}
                </div>
            </div>

        </CardTag>
    );
}

// Category Tab Button
function CategoryTab({ category, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap
                transition-all duration-200 min-h-touch
                ${
                    isActive
                        ? "bg-primary-500 text-white shadow-md shadow-primary-500/30"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                }
            `}
        >
            {category.name}
        </button>
    );
}

// Search Input
function SearchInput({
    value,
    onChange,
    onSearch,
    isSearching,
    placeholder,
    inputRef,
    onBarcodeDetected,
    enableBarcodeScanner = true,
}) {
    const [cameraOpen, setCameraOpen] = useState(false);

    return (
        <>
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch?.()}
                placeholder={
                    placeholder ||
                    "Cari menu favorit atau scan barcode... (/ untuk fokus)"
                }
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200
                    placeholder-slate-400 dark:placeholder-slate-500
                    focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500
                    transition-all text-base"
                disabled={isSearching}
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {enableBarcodeScanner && (
                    <button
                        type="button"
                        onClick={() => setCameraOpen(true)}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary-400"
                        title="Scan dengan kamera"
                    >
                        <IconCamera size={18} />
                    </button>
                )}
                {isSearching ? (
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <IconSearch size={18} className="text-slate-400" />
                )}
            </div>
        </div>
        <CameraBarcodeScanner
            open={enableBarcodeScanner && cameraOpen}
            onClose={() => setCameraOpen(false)}
            onDetected={(barcode) => {
                onChange?.(barcode);
                onBarcodeDetected?.(barcode);
            }}
        />
        </>
    );
}

// Main ProductGrid Component
export default function ProductGrid({
    products = [],
    searchQuery,
    onSearchChange,
    onSearch,
    isSearching,
    onAddToCart,
    addingProductId,
    searchInputRef,
    onBarcodeDetected,
    interactive = true,
    searchPlaceholder,
    emptyMessage,
    enableBarcodeScanner = true,
    storageNamespace = "pos:product-grid",
    onProductSelect,
    sortControlVariant = "select",
    filterPanelCollapsible = true,
    tenantSectionLabel = "Tenant",
    allTenantLabel = "Semua Tenant",
    gridLayoutClass = "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2",
    listLayoutClass = "grid grid-cols-1 gap-3 md:grid-cols-2",
    compactHeaderLayout = false,
    showFilterSummary = true,
    groupByCategoryWhenTenantFiltered = false,
}) {
    const [selectedTenantOutletId, setSelectedTenantOutletId] = useState(null);
    const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(() => {
        if (typeof window === "undefined") {
            return true;
        }

        const savedValue = window.localStorage.getItem(
            storageKey(storageNamespace, "filter-panel-expanded")
        );

        return savedValue === null ? true : savedValue === "true";
    });
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window === "undefined") {
            return "list";
        }

        const savedValue =
            window.localStorage.getItem(
                storageKey(storageNamespace, "view-mode")
            );

        return savedValue === "grid" ? "grid" : "list";
    });
    const [sortMode, setSortMode] = useState(() => {
        if (typeof window === "undefined") {
            return "alphabetical";
        }

        return (
            window.localStorage.getItem(
                storageKey(storageNamespace, "sort-mode")
            ) ||
            "alphabetical"
        );
    });
    const [isCompactLandscape, setIsCompactLandscape] = useState(false);
    const sortOptions = [
        { value: "alphabetical", label: "Urutan A-Z" },
        { value: "cheapest", label: "Harga Termurah" },
        { value: "expensive", label: "Harga Termahal" },
        { value: "promo", label: "Promo" },
        { value: "best_seller", label: "Best Seller" },
    ];
    const tenantTabs = products
        .map((product) => product.tenant_outlet)
        .filter((tenant, index, array) =>
            tenant?.id &&
            array.findIndex((item) => Number(item?.id) === Number(tenant.id)) ===
                index
        )
        .sort((a, b) => {
            const sortOrderDiff =
                Number(a?.sort_order || 0) - Number(b?.sort_order || 0);

            if (sortOrderDiff !== 0) {
                return sortOrderDiff;
            }

            return String(a?.name || "").localeCompare(
                String(b?.name || ""),
                "id"
            );
        });

    // Filter products by tenant and search
    const filteredProducts = products.filter((product) => {
        const matchesTenant =
            selectedTenantOutletId === null ||
            Number(product.tenant_outlet?.id) ===
                Number(selectedTenantOutletId);
        const matchesSearch =
            !searchQuery ||
            product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTenant && matchesSearch;
    });
    const sortedProducts = [...filteredProducts].sort((left, right) => {
        const leftName = String(left?.title || "");
        const rightName = String(right?.title || "");
        const alphabetical = leftName.localeCompare(rightName, "id");
        const leftPrice = Number(
            left?.pricing_badge?.promo_price ?? left?.sell_price ?? 0
        );
        const rightPrice = Number(
            right?.pricing_badge?.promo_price ?? right?.sell_price ?? 0
        );
        const leftHasPromo = Boolean(left?.pricing_badge?.label);
        const rightHasPromo = Boolean(right?.pricing_badge?.label);
        const leftSoldQty = Number(left?.sold_qty || 0);
        const rightSoldQty = Number(right?.sold_qty || 0);

        switch (sortMode) {
            case "cheapest":
                return leftPrice - rightPrice || alphabetical;
            case "expensive":
                return rightPrice - leftPrice || alphabetical;
            case "promo":
                return (
                    Number(rightHasPromo) - Number(leftHasPromo) ||
                    leftPrice - rightPrice ||
                    alphabetical
                );
            case "best_seller":
                return rightSoldQty - leftSoldQty || alphabetical;
            default:
                return alphabetical;
        }
    });
    const groupedCategorySections =
        groupByCategoryWhenTenantFiltered && selectedTenantOutletId !== null
            ? sortedProducts.reduce((sections, product) => {
                  const categoryId = Number(product?.category?.id || 0);
                  const categoryName = String(
                      product?.category?.name || "Tanpa Kategori"
                  );
                  const existingSection = sections.find(
                      (section) => section.categoryId === categoryId
                  );

                  if (existingSection) {
                      existingSection.products.push(product);
                      return sections;
                  }

                  sections.push({
                      categoryId,
                      categoryName,
                      products: [product],
                  });

                  return sections;
              }, [])
            : [];

    const selectedTenantName =
        selectedTenantOutletId === null
            ? allTenantLabel
            : tenantTabs.find(
                  (tenant) =>
                      Number(tenant.id) === Number(selectedTenantOutletId)
              )?.name || "Tenant";

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            storageKey(storageNamespace, "filter-panel-expanded"),
            String(isFilterPanelExpanded)
        );
    }, [isFilterPanelExpanded, storageNamespace]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            storageKey(storageNamespace, "view-mode"),
            viewMode
        );
    }, [viewMode, storageNamespace]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            storageKey(storageNamespace, "sort-mode"),
            sortMode
        );
    }, [sortMode, storageNamespace]);

    useEffect(() => {
        if (!filterPanelCollapsible) {
            setIsFilterPanelExpanded(true);
        }
    }, [filterPanelCollapsible]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const syncViewportMode = () => {
            const width = window.innerWidth || 0;
            const height = window.innerHeight || 0;
            const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
            const compactLandscape =
                width >= 640 &&
                width > height &&
                height <= 560 &&
                Boolean(coarsePointer);

            setIsCompactLandscape(compactLandscape);
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
        <div className="flex h-full min-h-0 flex-col">
            {/* Search Bar */}
            <div
                className={`border-b border-slate-200 dark:border-slate-800 ${
                    isCompactLandscape ? "p-3" : "p-4"
                }`}
            >
                <div
                    className={`flex gap-3 ${
                        compactHeaderLayout
                            ? isCompactLandscape
                                ? "items-center"
                                : "flex-col items-stretch sm:flex-row sm:items-center"
                            : "flex-col"
                    }`}
                >
                    <div className="min-w-0 flex-1">
                        <SearchInput
                            value={searchQuery}
                            onChange={onSearchChange}
                            onSearch={onSearch}
                            isSearching={isSearching}
                            placeholder={
                                searchPlaceholder ||
                                "Cari produk atau scan barcode... (tekan / untuk fokus)"
                            }
                            inputRef={searchInputRef}
                            onBarcodeDetected={onBarcodeDetected}
                            enableBarcodeScanner={enableBarcodeScanner}
                        />
                    </div>
                    {compactHeaderLayout && (
                        <div
                            className={`inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 ${
                                isCompactLandscape ? "self-start" : ""
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                    viewMode === "list"
                                        ? "bg-primary-500 text-white"
                                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                                <IconList size={15} />
                                List
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("grid")}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                    viewMode === "grid"
                                        ? "bg-primary-500 text-white"
                                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                                <IconLayoutGrid size={15} />
                                Grid
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-800">
                <div
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 ${
                        isCompactLandscape ? "py-2.5" : "py-3"
                    }`}
                >
                    <div className="min-w-0">
                        {showFilterSummary && (
                            <>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <IconAdjustmentsHorizontal size={16} />
                                    Filter Produk
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                        {selectedTenantName}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {sortControlVariant === "chips" ? null : (
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                                {sortOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        {!compactHeaderLayout && (
                            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("list")}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                        viewMode === "list"
                                            ? "bg-primary-500 text-white"
                                            : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <IconList size={15} />
                                    List
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("grid")}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                        viewMode === "grid"
                                            ? "bg-primary-500 text-white"
                                            : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <IconLayoutGrid size={15} />
                                    Grid
                                </button>
                            </div>
                        )}
                        {filterPanelCollapsible && (
                            <button
                                type="button"
                                onClick={() =>
                                    setIsFilterPanelExpanded((current) => !current)
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                {isFilterPanelExpanded ? "Ringkas" : "Tampilkan"}
                                {isFilterPanelExpanded ? (
                                    <IconChevronUp size={16} />
                                ) : (
                                    <IconChevronDown size={16} />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {isFilterPanelExpanded && (
                    <div
                        className={`px-4 pb-3 ${
                            isCompactLandscape && sortControlVariant === "chips"
                                ? "grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(0,1.1fr)]"
                                : "space-y-3"
                        }`}
                    >
                        {sortControlVariant === "chips" && (
                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                    Urutkan
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {sortOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setSortMode(option.value)}
                                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                                sortMode === option.value
                                                    ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
                                                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                {tenantSectionLabel}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <CategoryTab
                                    category={{
                                        id: null,
                                        name: allTenantLabel,
                                    }}
                                    isActive={selectedTenantOutletId === null}
                                    onClick={() =>
                                        setSelectedTenantOutletId(null)
                                    }
                                />
                                {tenantTabs.map((tenant) => (
                                    <CategoryTab
                                        key={tenant.id}
                                        category={{
                                            id: tenant.id,
                                            name: tenant.name,
                                        }}
                                        isActive={
                                            Number(selectedTenantOutletId) ===
                                            Number(tenant.id)
                                        }
                                        onClick={() =>
                                            setSelectedTenantOutletId(
                                                Number(tenant.id)
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Products Grid */}
            <div
                className={`min-h-0 flex-1 overflow-y-auto scrollbar-thin ${
                    isCompactLandscape ? "p-3" : "p-4"
                }`}
            >
                {sortedProducts.length > 0 ? (
                    groupedCategorySections.length > 0 ? (
                        <div className="space-y-5">
                            {groupedCategorySections.map((section) => (
                                <section key={`${selectedTenantOutletId}-${section.categoryId}`}>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {section.categoryName}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {section.products.length} menu
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className={
                                            viewMode === "grid"
                                                ? gridLayoutClass
                                                : listLayoutClass
                                        }
                                    >
                                        {section.products.map((product) => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                onAddToCart={onAddToCart}
                                                isAdding={addingProductId === product.id}
                                                viewMode={viewMode}
                                                interactive={interactive}
                                                onProductSelect={onProductSelect}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : (
                        <div
                            className={
                                viewMode === "grid"
                                    ? gridLayoutClass
                                    : listLayoutClass
                            }
                        >
                            {sortedProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={onAddToCart}
                                    isAdding={addingProductId === product.id}
                                    viewMode={viewMode}
                                    interactive={interactive}
                                    onProductSelect={onProductSelect}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                        <IconShoppingBag
                            size={48}
                            strokeWidth={1.5}
                            className="mb-3"
                        />
                        <p className="text-sm">
                            {emptyMessage ||
                                (searchQuery
                                    ? "Produk tidak ditemukan"
                                    : "Tidak ada produk")}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Export sub-components
ProductGrid.Card = ProductCard;
ProductGrid.CategoryTab = CategoryTab;
ProductGrid.SearchInput = SearchInput;
