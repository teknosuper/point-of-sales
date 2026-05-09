import React, { useState } from "react";
import {
    IconShoppingBag,
    IconPhoto,
    IconSearch,
    IconCamera,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";
import CameraBarcodeScanner from "./CameraBarcodeScanner";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

// Single Product Card
function ProductCard({ product, onAddToCart, isAdding }) {
    const hasStock = product.stock > 0;
    const lowStock = product.stock > 0 && product.stock <= 5;
    const promoBadge = product.pricing_badge;
    const promoPrice = Number(promoBadge?.promo_price || 0);
    const basePrice = Number(promoBadge?.base_price || product.sell_price || 0);
    const showPromo = promoBadge && promoPrice > 0 && promoPrice < basePrice;
    const showBadge = Boolean(promoBadge?.label);

    return (
        <button
            onClick={() => hasStock && onAddToCart(product)}
            disabled={!hasStock || isAdding}
            className={`
                group relative flex flex-col bg-white dark:bg-slate-900
                rounded-2xl border border-slate-200 dark:border-slate-800
                overflow-hidden transition-all duration-200
                ${
                    hasStock
                        ? "hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                        : "opacity-60 cursor-not-allowed"
                }
            `}
        >
            {/* Product Image */}
            <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {product.image ? (
                    <img
                        src={getProductImageUrl(product.image, product.title)}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = getProductImageUrl(
                                null,
                                product.title
                            );
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <IconPhoto
                            size={32}
                            className="text-slate-300 dark:text-slate-600"
                        />
                    </div>
                )}

                {/* Stock Badge */}
                {lowStock && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400 rounded-full">
                        Sisa {product.stock}
                    </span>
                )}

                {showBadge && (
                    <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg">
                        {promoBadge.label}
                    </span>
                )}

                {/* Out of Stock Overlay */}
                {!hasStock && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <span className="px-3 py-1 bg-danger-500 text-white text-xs font-semibold rounded-full">
                            Habis
                        </span>
                    </div>
                )}

                {/* Hover Add Indicator (centered on image) */}
                {hasStock && (
                    <div className="absolute inset-0 bg-primary-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                        <div className="bg-primary-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                            + Tambah
                        </div>
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="flex-1 p-3 flex flex-col justify-between min-h-[80px]">
                {product.tenant_outlet?.name && (
                    <div className="mb-2">
                        <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <span className="truncate">
                                {product.tenant_outlet.name}
                            </span>
                        </span>
                    </div>
                )}
                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                    {product.title}
                </h3>
                <div className="mt-2">
                    {showPromo && (
                        <p className="text-xs text-slate-400 line-through">
                            {formatPrice(basePrice)}
                        </p>
                    )}
                    <p className="text-base font-bold text-primary-600 dark:text-primary-400">
                        {formatPrice(showPromo ? promoPrice : product.sell_price)}
                    </p>
                    {showBadge && !showPromo && (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Promo tersedia
                        </p>
                    )}
                </div>
            </div>

        </button>
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
                    "Cari produk atau scan barcode... (/ untuk fokus)"
                }
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200
                    placeholder-slate-400 dark:placeholder-slate-500
                    focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500
                    transition-all text-base"
                disabled={isSearching}
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary-400"
                    title="Scan dengan kamera"
                >
                    <IconCamera size={18} />
                </button>
                {isSearching ? (
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <IconSearch size={18} className="text-slate-400" />
                )}
            </div>
        </div>
        <CameraBarcodeScanner
            open={cameraOpen}
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
    categories = [],
    selectedCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
    onSearch,
    isSearching,
    onAddToCart,
    addingProductId,
    searchInputRef,
    onBarcodeDetected,
}) {
    const normalizedSelectedCategory =
        selectedCategory === null ? null : Number(selectedCategory);
    const [selectedTenantOutletId, setSelectedTenantOutletId] = useState(null);
    const tenantTabs = products
        .map((product) => product.tenant_outlet)
        .filter((tenant, index, array) =>
            tenant?.id &&
            array.findIndex((item) => Number(item?.id) === Number(tenant.id)) ===
                index
        )
        .sort((a, b) =>
            String(a?.name || "").localeCompare(String(b?.name || ""), "id")
        );

    // Filter products by category, tenant, and search
    const filteredProducts = products.filter((product) => {
        const matchesCategory =
            normalizedSelectedCategory === null ||
            Number(product.category_id) === normalizedSelectedCategory;
        const matchesTenant =
            selectedTenantOutletId === null ||
            Number(product.tenant_outlet?.id) ===
                Number(selectedTenantOutletId);
        const matchesSearch =
            !searchQuery ||
            product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesTenant && matchesSearch;
    });

    return (
        <div className="h-full flex flex-col">
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <SearchInput
                    value={searchQuery}
                    onChange={onSearchChange}
                    onSearch={onSearch}
                    isSearching={isSearching}
                    placeholder="Cari produk atau scan barcode... (tekan / untuk fokus)"
                    inputRef={searchInputRef}
                    onBarcodeDetected={onBarcodeDetected}
                />
            </div>

            {/* Category Tabs */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                    <CategoryTab
                        category={{ id: null, name: "Semua" }}
                        isActive={normalizedSelectedCategory === null}
                        onClick={() => onCategoryChange(null)}
                    />
                    {categories.map((category) => (
                        <CategoryTab
                            key={category.id}
                            category={category}
                            isActive={
                                normalizedSelectedCategory ===
                                Number(category.id)
                            }
                            onClick={() => onCategoryChange(Number(category.id))}
                        />
                    ))}
                </div>
            </div>

            {/* Tenant Tabs */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                    <CategoryTab
                        category={{ id: null, name: "Semua Dapur" }}
                        isActive={selectedTenantOutletId === null}
                        onClick={() => setSelectedTenantOutletId(null)}
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
                                setSelectedTenantOutletId(Number(tenant.id))
                            }
                        />
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filteredProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={onAddToCart}
                                isAdding={addingProductId === product.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                        <IconShoppingBag
                            size={48}
                            strokeWidth={1.5}
                            className="mb-3"
                        />
                        <p className="text-sm">
                            {searchQuery
                                ? "Produk tidak ditemukan"
                                : "Tidak ada produk"}
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
