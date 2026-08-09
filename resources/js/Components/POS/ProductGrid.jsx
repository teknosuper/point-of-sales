import React, { memo, useEffect, useMemo, useRef, useState } from "react";
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
    IconStar,
    IconSparkles,
    IconChecklist,
    IconBox,
    IconTrendingUp,
} from "@/Utils/icons";
import { IconTag } from "@tabler/icons-react";
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

const resolveModifierTone = (product, hasModifierOptions) => {
    if (!hasModifierOptions) {
        return {
            cardClass:
                "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            badgeClass:
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            badgeLabel: "Tanpa topping",
            hintClass: "text-slate-500 dark:text-slate-400",
        };
    }

    if (product.requires_modifier_selection) {
        return {
            cardClass:
                "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/20",
            badgeClass:
                "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
            badgeLabel: "Topping wajib",
            hintClass: "text-amber-700 dark:text-amber-200",
        };
    }

    return {
        cardClass:
            "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:border-sky-900/40 dark:from-sky-950/20 dark:via-slate-900 dark:to-cyan-950/20",
        badgeClass:
            "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
        badgeLabel: "Ada topping",
        hintClass: "text-sky-700 dark:text-sky-200",
    };
};

// Single Product Card
const ProductCard = memo(function ProductCard({
    product,
    onAddToCart,
    isAdding,
    viewMode = "list",
    interactive = true,
    onProductSelect,
    bestSellerIds = [],
}) {
    // Store operational check — treat as unavailable if tenant outlet is closed/outside hours
    const storeClosed = product.store_closed_reason === "store_closed";
    const outsideHours = product.store_closed_reason === "outside_hours";
    const isStoreClosed = storeClosed || outsideHours;
    const tenantHours = product.tenant_store_hours ?? null;
    const hoursLabel =
        tenantHours?.open_time && tenantHours?.close_time
            ? ` (${tenantHours.open_time}–${tenantHours.close_time})`
            : "";
    const storeClosedLabel = storeClosed
        ? "Toko Tutup"
        : outsideHours
          ? `Belum Buka${hoursLabel}`
          : null;
    const hasStock = product.stock > 0 && !isStoreClosed;
    const lowStock = product.stock > 0 && product.stock <= 5 && !isStoreClosed;
    const tenantOpenCountdown =
        outsideHours && product.tenant_open_countdown
            ? String(product.tenant_open_countdown)
            : null;
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
    const modifierTone = resolveModifierTone(product, hasModifierOptions);
    const secondaryLabel =
        product.tenant_outlet?.name || product.category?.name || "-";
    const isBestSeller = bestSellerIds.includes(Number(product.id));
    const isFeatured = Boolean(product.is_featured);
    const soldQty = Number(product.sold_qty || 0);
    const ratingAvg = Number(product.rating_avg || 0);
    const ratingCount = Number(product.rating_count || 0);
    const isSelectable =
        interactive || typeof onProductSelect === "function";
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
                rounded-2xl border
                transition-all duration-200
                ${
                    isSelectable && hasStock
                        ? "hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] cursor-pointer"
                        : hasStock
                          ? ""
                          : "opacity-60"
                } ${modifierTone.cardClass} ${isListMode ? "w-full items-center gap-3 px-3 py-2 text-left" : "flex-col overflow-hidden rounded-2xl"}
            `}
        >
            {!isListMode && (
                <div className="relative aspect-[4/5] overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {product.image ? (
                        <LazyImage
                            src={getProductThumbUrl(product.image, product.title)}
                            fallbackSrc={getProductImageUrl(
                                product.image,
                                product.title
                            )}
                            alt={product.title}
                            className="h-full w-full"
                            imgClassName="object-cover transition-transform duration-500 group-hover:scale-110"
                            fallback={
                                <div className="flex h-full w-full items-center justify-center">
                                    <IconPhoto
                                        size={isListMode ? 18 : 32}
                                        className="text-slate-400"
                                    />
                                </div>
                            }
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <IconPhoto
                                size={36}
                                className="text-slate-300 dark:text-slate-600"
                            />
                        </div>
                    )}

                    {/* Gradient overlay for better badge readability */}
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

                    {/* Badges on image */}
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                        {isBestSeller && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-500/30">
                                <IconStar size={12} fill="white" />
                                Best Seller
                            </span>
                        )}
                        {isFeatured && !isBestSeller && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-primary-500/30">
                                <IconSparkles size={12} />
                                Rekomendasi
                            </span>
                        )}
                        {hasModifierOptions && product.requires_modifier_selection && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-500/30">
                                <IconChecklist size={12} />
                                Topping Wajib
                            </span>
                        )}
                        {showBadge && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-500/30">
                                <IconTag size={12} />
                                {promoBadge.label}
                            </span>
                        )}
                    </div>

                    {/* Low stock indicator */}
                    {lowStock && hasStock && (
                        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-warning-700 shadow-lg backdrop-blur-sm">
                            Sisa {product.stock}
                        </span>
                    )}

                    {/* Category pill at bottom left */}
                    {!isListMode && secondaryLabel !== "-" && (
                        <div className="absolute bottom-3 left-3">
                            <span className="inline-flex rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-lg backdrop-blur-sm">
                                {secondaryLabel}
                            </span>
                        </div>
                    )}

                    {/* Out of stock overlay */}
                    {!hasStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
                            <div className="flex flex-col items-center text-center">
                                <span className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xl ${
                                    isStoreClosed ? "bg-amber-600" : "bg-danger-600"
                                }`}>
                                    {storeClosedLabel ?? "Habis"}
                                </span>
                                {tenantOpenCountdown && (
                                    <span className="mt-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-slate-800 shadow-lg">
                                        Buka dalam {tenantOpenCountdown}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Hover overlay */}
                    {interactive && hasStock && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary-500/0 opacity-0 transition-all duration-300 group-hover:bg-primary-500/10 group-hover:opacity-100">
                            <div className="rounded-full bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-xl translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                Lihat Detail
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Product Info */}
            <div
                className={`flex-1 flex ${
                    isListMode
                        ? "min-w-0 items-center justify-between gap-3 px-3 py-3"
                        : "flex-col justify-between px-2.5 py-2.5"
                }`}
            >
                <div className="min-w-0 flex-1">
                    {/* List mode badges */}
                    {isListMode && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {secondaryLabel !== "-" && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {secondaryLabel}
                                </span>
                            )}
                            {hasModifierOptions && (
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${modifierTone.badgeClass}`}
                                >
                                    {modifierTone.badgeLabel}
                                </span>
                            )}
                            {isBestSeller && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    <IconStar size={10} fill="currentColor" />
                                    Best Seller
                                </span>
                            )}
                            {isFeatured && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                                    <IconSparkles size={10} />
                                    Rekomendasi
                                </span>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <h3 className={`font-bold ${
                        isListMode
                            ? "text-sm leading-snug mt-0.5 break-words"
                            : "mt-2 text-xs leading-snug line-clamp-2 break-words"
                    } text-slate-900 dark:text-slate-100`}>
                        {product.title}
                    </h3>

                    {/* Grid mode meta info */}
                    {!isListMode && (
                        <div className="mt-1.5 flex flex-col gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            {product.stock !== null && (
                                <span className="flex items-center gap-0.5">
                                    <IconBox size={11} className="text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                                        {Number(product.stock || 0)} tersisa
                                    </span>
                                </span>
                            )}
                            {soldQty > 0 && (
                                <span className="flex items-center gap-0.5">
                                    <IconTrendingUp size={11} className="text-primary-500 shrink-0" />
                                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                                        {soldQty.toLocaleString('id-ID')} terjual
                                    </span>
                                </span>
                            )}
                            {ratingCount > 0 ? (
                                <span className="flex items-center gap-0.5 flex-wrap">
                                    <span className="flex items-center gap-0.5 text-amber-500">
                                        {[0,1,2,3,4].map((i) => (
                                            <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={i < Math.round(ratingAvg) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} className="h-3 w-3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.562.562 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.562.562 0 0 0 .475-.345L11.48 3.5Z" />
                                            </svg>
                                        ))}
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{ratingAvg.toFixed(1)}</span>
                                    <span className="text-slate-400">({ratingCount})</span>
                                </span>
                            ) : !interactive ? (
                                <span className="flex items-center gap-0.5">
                                    <span className="flex items-center gap-0.5 text-slate-300 dark:text-slate-600">
                                        {[0,1,2,3,4].map((i) => (
                                            <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3 w-3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.562.562 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.562.562 0 0 0 .475-.345L11.48 3.5Z" />
                                            </svg>
                                        ))}
                                    </span>
                                    <span className="text-slate-400">Belum ada review</span>
                                </span>
                            ) : null}
                        </div>
                    )}

                    {/* List mode meta info */}
                    {isListMode && (
                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                            {product.stock !== null && (
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {Number(product.stock || 0)} tersisa
                                </span>
                            )}
                            {soldQty > 0 && (
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {soldQty.toLocaleString('id-ID')} terjual
                                </span>
                            )}
                            {ratingCount > 0 ? (
                                <span className="flex items-center gap-1">
                                    <span className="flex items-center gap-0.5 text-amber-500">
                                        {[0,1,2,3,4].map((i) => (
                                            <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={i < Math.round(ratingAvg) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.562.562 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.562.562 0 0 0 .475-.345L11.48 3.5Z" />
                                            </svg>
                                        ))}
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{ratingAvg.toFixed(1)}</span>
                                    <span className="text-slate-400">({ratingCount} penilaian)</span>
                                </span>
                            ) : !interactive ? (
                                <span className="flex items-center gap-1">
                                    <span className="flex items-center gap-0.5 text-slate-300 dark:text-slate-600">
                                        {[0,1,2,3,4].map((i) => (
                                            <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.562.562 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.562.562 0 0 0 .475-.345L11.48 3.5Z" />
                                            </svg>
                                        ))}
                                    </span>
                                    <span className="text-slate-400">Belum ada review</span>
                                </span>
                            ) : null}
                            {!interactive && hasModifierOptions && (
                                <span className={`font-medium ${modifierTone.hintClass}`}>
                                    {product.requires_modifier_selection
                                        ? "Pilih detail topping wajib"
                                        : "Klik untuk lihat topping"}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Price section */}
                <div
                    className={`${
                        isListMode
                            ? "flex shrink-0 flex-col items-end text-right"
                            : "mt-2"
                    }`}
                >
                    {showPromo && (
                        <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                                {Math.round(
                                    ((basePrice - promoPrice) / basePrice) * 100
                                )}
                                % OFF
                            </span>
                            <p className={`${isListMode ? "text-xs" : "text-[10px]"} text-slate-400 line-through`}>
                                {formatPrice(basePrice)}
                            </p>
                        </div>
                    )}
                    <p className={`font-bold text-primary-600 dark:text-primary-400 ${
                        isListMode ? "text-sm" : "text-sm"
                    }`}>
                        {formatPrice(showPromo ? promoPrice : product.sell_price)}
                    </p>
                    {promoDetail && (
                        <p
                            className={`mt-0.5 max-w-[180px] break-words text-[10px] leading-4 text-rose-600 dark:text-rose-400 ${
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
});

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
    mainCategories = [],
    categories = [],
    searchQuery,
    onSearchChange,
    onSearch,
    isSearching,
    onAddToCart,
    addingProductId,
    searchInputRef,
    onBarcodeDetected,
    hasMoreProducts = false,
    onLoadMoreProducts,
    isLoadingMoreProducts = false,
    interactive = true,
    searchPlaceholder,
    emptyMessage,
    enableBarcodeScanner = true,
    storageNamespace = "pos:product-grid",
    onProductSelect,
    sortControlVariant = "select",
    filterPanelCollapsible = true,
    mainCategorySectionLabel = "Kategori Utama",
    allMainCategoriesLabel = "Semua Kategori",
    gridLayoutClass = "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2",
    listLayoutClass = "grid grid-cols-1 gap-3 md:grid-cols-2",
    compactHeaderLayout = false,
    showFilterSummary = true,
    groupByCategoryWhenMainCategoryFiltered = false,
    initialViewMode = "list",
    persistViewMode = true,
    embedHeaderInScroll = false,
    scrollIntro = null,
    initialSortMode,
    bestSellerIds = [],
}) {
    const [searchDraft, setSearchDraft] = useState(searchQuery || "");
    const [selectedMainCategoryId, setSelectedMainCategoryId] = useState(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(() => {
        if (typeof window === "undefined") {
            return !compactHeaderLayout;
        }

        const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
        const mobileWidth = (window.innerWidth || 0) < 768;

        if (compactHeaderLayout && coarsePointer && mobileWidth) {
            return false;
        }

        const savedValue = window.localStorage.getItem(
            storageKey(storageNamespace, "filter-panel-expanded")
        );

        return savedValue === null ? true : savedValue === "true";
    });
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window === "undefined") {
            return initialViewMode === "grid" ? "grid" : "list";
        }

        if (!persistViewMode) {
            return initialViewMode === "grid" ? "grid" : "list";
        }

        const savedValue =
            window.localStorage.getItem(
                storageKey(storageNamespace, "view-mode")
            );

        if (savedValue === "grid" || savedValue === "list") {
            return savedValue;
        }

        return initialViewMode === "grid" ? "grid" : "list";
    });
    const [sortMode, setSortMode] = useState(() => {
        if (typeof window === "undefined") {
            return initialSortMode || "featured_first";
        }

        const savedSort =
            window.localStorage.getItem(
                storageKey(storageNamespace, "sort-mode")
            );

        if (savedSort && [
            "cheapest",
            "expensive",
            "promo",
            "best_seller",
            "featured_first",
        ].includes(savedSort)) {
            return savedSort;
        }

        return initialSortMode || "featured_first";
    });
    const toggleCategorySection = (categoryId) => {
        setCollapsedCategoryIds((prev) => ({
            ...prev,
            [categoryId]: !prev[categoryId],
        }));
    };
    const collapseAllCategories = () => {
        setCollapsedCategoryIds(
            groupedCategorySections.reduce((acc, section) => {
                acc[section.categoryId] = true;
                return acc;
            }, {})
        );
    };
    const expandAllCategories = () => {
        setCollapsedCategoryIds({});
    };
    const [isCompactLandscape, setIsCompactLandscape] = useState(false);
    const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = useState(false);
    const [showInlineFloatingCategoryBar, setShowInlineFloatingCategoryBar] =
        useState(false);
    const [collapsedCategoryIds, setCollapsedCategoryIds] = useState(() => {
        if (typeof window === "undefined") return {};
        try {
            const saved = window.localStorage.getItem(
                storageKey(storageNamespace, "collapsed-categories")
            );
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const loadMoreSentinelRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const lastEmittedSearchRef = useRef(searchQuery || "");
    const sortOptions = [
        { value: "featured_first", label: "Menu Rekomendasi" },
        { value: "best_seller", label: "Best Seller" },
        { value: "cheapest", label: "Harga Termurah" },
        { value: "expensive", label: "Harga Termahal" },
        { value: "promo", label: "Promo" },
    ];
    useEffect(() => {
        const nextQuery = searchQuery || "";
        const isSearchInputFocused =
            typeof document !== "undefined" &&
            searchInputRef?.current &&
            document.activeElement === searchInputRef.current;

        lastEmittedSearchRef.current = nextQuery;

        if (!isSearchInputFocused || nextQuery === "") {
            setSearchDraft(nextQuery);
        }
    }, [searchQuery]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (lastEmittedSearchRef.current !== searchDraft) {
                lastEmittedSearchRef.current = searchDraft;
                onSearchChange?.(searchDraft);
            }
        }, 180);

        return () => window.clearTimeout(timerId);
    }, [onSearchChange, searchDraft]);

    const mainCategoryTabs = useMemo(
        () =>
            (mainCategories.length > 0
                ? mainCategories
                : products.map((product) => product.category?.parent || product.category))
                .filter((category, index, array) =>
                    category?.id &&
                    array.findIndex(
                        (item) => Number(item?.id) === Number(category.id)
                    ) === index
                )
                .filter((category) =>
                    products.some(
                        (product) =>
                            Number(product.category?.parent_id || product.category?.id) ===
                            Number(category.id)
                    )
                )
                .sort((a, b) => {
                    const sortOrderDiff =
                        Number(a?.sort_order || 0) -
                        Number(b?.sort_order || 0);

                    if (sortOrderDiff !== 0) {
                        return sortOrderDiff;
                    }

                    return String(a?.name || "").localeCompare(
                        String(b?.name || ""),
                        "id"
                    );
                }),
        [products, mainCategories]
    );

    const tenantCategories = useMemo(() => {
        if (!selectedMainCategoryId || !categories?.length) {
            return [];
        }

        return categories
            .filter(
                (category) =>
                    Number(category?.parent_id) === Number(selectedMainCategoryId)
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
    }, [categories, selectedMainCategoryId]);

    useEffect(() => {
        setSelectedCategoryId(null);
    }, [selectedMainCategoryId]);

    const filteredProducts = useMemo(
        () =>
            products.filter((product) => {
                const matchesMainCategory =
                    selectedMainCategoryId === null ||
                    Number(product.category?.parent_id || product.category?.id) ===
                        Number(selectedMainCategoryId);
                const matchesCategory =
                    selectedCategoryId === null ||
                    Number(product.category?.id) === Number(selectedCategoryId);
                const matchesSearch =
                    !searchDraft ||
                    product.title
                        .toLowerCase()
                        .includes(searchDraft.toLowerCase()) ||
                    product.barcode
                        ?.toLowerCase()
                        .includes(searchDraft.toLowerCase());
                const matchesShadowBan =
                    !product.is_shadow_banned ||
                    (searchDraft &&
                        product.title.toLowerCase() === searchDraft.toLowerCase());
                return matchesMainCategory && matchesCategory && matchesSearch && matchesShadowBan;
            }),
        [products, searchDraft, selectedMainCategoryId, selectedCategoryId]
    );

    const sortedProducts = useMemo(
        () =>
            [...filteredProducts].sort((left, right) => {
                const leftOutOfStock = Number(left?.stock || 0) <= 0;
                const rightOutOfStock = Number(right?.stock || 0) <= 0;

                if (leftOutOfStock !== rightOutOfStock) {
                    return Number(leftOutOfStock) - Number(rightOutOfStock);
                }

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
                    case "featured_first":
                        return (
                            Number(right?.is_featured) -
                                Number(left?.is_featured) ||
                            rightSoldQty - leftSoldQty ||
                            alphabetical
                        );
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
                        return (
                            Number(right?.is_featured) -
                                Number(left?.is_featured) ||
                            rightSoldQty - leftSoldQty ||
                            alphabetical
                        );
                }
            }),
        [filteredProducts, sortMode]
    );

    const groupedCategorySections = useMemo(() => {
        const resolvedGroupByCategory =
            groupByCategoryWhenMainCategoryFiltered ||
            (selectedMainCategoryId !== null && tenantCategories.length > 0);

        if (
            !resolvedGroupByCategory ||
            selectedMainCategoryId === null
        ) {
            return [];
        }

        return sortedProducts.reduce((sections, product) => {
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
        }, []);
    }, [
        groupByCategoryWhenMainCategoryFiltered,
        selectedMainCategoryId,
        sortedProducts,
        tenantCategories.length,
    ]);

    const selectedMainCategoryName = useMemo(() => {
        const mainName =
            selectedMainCategoryId === null
                ? allMainCategoriesLabel
                : mainCategoryTabs.find(
                      (category) =>
                          Number(category.id) === Number(selectedMainCategoryId)
                  )?.name || "Kategori";

        if (!mainName || selectedCategoryId === null) {
            return mainName;
        }

        const tenantName =
            tenantCategories.find(
                (category) => Number(category.id) === Number(selectedCategoryId)
            )?.name || "";

        return tenantName ? `${mainName} / ${tenantName}` : mainName;
    }, [
        allMainCategoriesLabel,
        selectedMainCategoryId,
        selectedCategoryId,
        mainCategoryTabs,
        tenantCategories,
    ]);

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
        if (!persistViewMode) {
            return;
        }

        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            storageKey(storageNamespace, "view-mode"),
            viewMode
        );
    }, [persistViewMode, viewMode, storageNamespace]);

    useEffect(() => {
        if (persistViewMode) {
            return;
        }

        setViewMode(initialViewMode === "grid" ? "grid" : "list");
    }, [initialViewMode, persistViewMode]);

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
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            storageKey(storageNamespace, "collapsed-categories"),
            JSON.stringify(collapsedCategoryIds)
        );
    }, [collapsedCategoryIds, storageNamespace]);

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

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            typeof IntersectionObserver === "undefined" ||
            !hasMoreProducts ||
            isLoadingMoreProducts ||
            typeof onLoadMoreProducts !== "function"
        ) {
            return;
        }

        const sentinel = loadMoreSentinelRef.current;
        if (!sentinel) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting) {
                    onLoadMoreProducts();
                }
            },
            {
                root: sentinel.closest(".overflow-y-auto"),
                rootMargin: "0px 0px 240px 0px",
                threshold: 0.1,
            }
        );

        observer.observe(sentinel);

        return () => {
            observer.disconnect();
        };
    }, [hasMoreProducts, isLoadingMoreProducts, onLoadMoreProducts, sortedProducts.length]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || typeof window === "undefined") {
            return;
        }

        const syncStickyCategoryBar = () => {
            setShowInlineFloatingCategoryBar(
                Boolean(embedHeaderInScroll) &&
                    Boolean(compactHeaderLayout) &&
                    mainCategoryTabs.length > 0 &&
                    container.scrollTop > 24
            );
        };

        syncStickyCategoryBar();
        container.addEventListener("scroll", syncStickyCategoryBar, {
            passive: true,
        });
        window.addEventListener("resize", syncStickyCategoryBar);

        return () => {
            container.removeEventListener("scroll", syncStickyCategoryBar);
            window.removeEventListener("resize", syncStickyCategoryBar);
        };
    }, [compactHeaderLayout, embedHeaderInScroll, mainCategoryTabs.length]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <style>{`
                @keyframes productGridProgress {
                    0% { transform: translateX(-120%); }
                    100% { transform: translateX(320%); }
                }
            `}</style>
            {isMobileFilterSheetOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden"
                    onClick={() => setIsMobileFilterSheetOpen(false)}
                />
            )}
            {/* Search Bar */}
            {!embedHeaderInScroll && (
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
                            value={searchDraft}
                            onChange={setSearchDraft}
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
                    {compactHeaderLayout && (
                        <div className="md:hidden">
                            <button
                                type="button"
                                onClick={() => setIsMobileFilterSheetOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                            >
                                <IconAdjustmentsHorizontal size={15} />
                                Filter
                            </button>
                        </div>
                    )}
                </div>
            </div>
            )}

            {!embedHeaderInScroll && (
            <div className="border-b border-slate-200 dark:border-slate-800">
                <div
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 ${
                        isCompactLandscape ? "py-2.5" : compactHeaderLayout ? "py-2.5" : "py-3"
                    }`}
                >
                    <div className="min-w-0">
                        {showFilterSummary && !compactHeaderLayout && (
                            <>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <IconAdjustmentsHorizontal size={16} />
                                    Filter Produk
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                        {selectedMainCategoryName}
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
                        {compactHeaderLayout && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 md:hidden">
                                {selectedMainCategoryName}
                            </span>
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
                                className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
                                    compactHeaderLayout ? "hidden md:inline-flex" : ""
                                }`}
                            >
                                {isFilterPanelExpanded ? "Ringkas" : "Filter"}
                                {isFilterPanelExpanded ? (
                                    <IconChevronUp size={16} />
                                ) : (
                                    <IconChevronDown size={16} />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {!isFilterPanelExpanded && compactHeaderLayout && (
                    <div className="px-4 pb-2 md:hidden" />
                )}

                {(isSearching || isLoadingMoreProducts) && (
                    <div className="border-t border-slate-200/80 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/80">
                        <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span>
                                {isSearching
                                    ? `Memuat hasil untuk "${searchDraft}"...`
                                    : "Memuat produk tambahan..."}
                            </span>
                            <span>
                                {sortedProducts.length} produk tampil
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div className="h-full w-1/3 animate-[productGridProgress_1.1s_ease-in-out_infinite] rounded-full bg-primary-500" />
                        </div>
                    </div>
                )}

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
                                  {mainCategorySectionLabel}
                             </p>
                             <div className="flex flex-wrap gap-2">
                                 <CategoryTab
                                     category={{
                                         id: null,
                                         name: allMainCategoriesLabel,
                                     }}
                                     isActive={selectedMainCategoryId === null}
                                     onClick={() =>
                                         setSelectedMainCategoryId(null)
                                     }
                                 />
                                 {mainCategoryTabs.map((category) => (
                                     <CategoryTab
                                         key={category.id}
                                         category={{
                                             id: category.id,
                                             name: category.name,
                                         }}
                                         isActive={
                                             Number(selectedMainCategoryId) ===
                                             Number(category.id)
                                         }
                                         onClick={() =>
                                             setSelectedMainCategoryId(
                                                 Number(category.id)
                                             )
                                         }
                                     />
                                  ))}
                              </div>
                          </div>
                    </div>
                )}
            </div>
            )}

            {/* Products Grid */}
            <div
                ref={scrollContainerRef}
                className={`min-h-0 flex-1 overflow-y-auto scrollbar-thin ${
                    isCompactLandscape ? "p-3" : "p-4"
                }`}
            >
                {showInlineFloatingCategoryBar && (
                    <div className="sticky top-0 z-20 mb-3">
                        <div className="rounded-[22px] border border-slate-200/90 bg-white/96 p-2 shadow-[0_16px_34px_-18px_rgba(15,23,42,0.32)] backdrop-blur md:p-3">
                            <div className="mb-2 flex items-center justify-between gap-3 px-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    {mainCategorySectionLabel}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsMobileFilterSheetOpen(true)}
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                                >
                                    Filter
                                    <IconChevronDown size={12} />
                                </button>
                            </div>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 scrollbar-thin whitespace-nowrap md:gap-3">
                                <CategoryTab
                                    category={{ id: null, name: allMainCategoriesLabel }}
                                    isActive={selectedMainCategoryId === null}
                                    onClick={() => setSelectedMainCategoryId(null)}
                                />
                                {mainCategoryTabs.map((category) => (
                                    <CategoryTab
                                        key={`floating-inline-${category.id}`}
                                        category={{
                                            id: category.id,
                                            name: category.name,
                                        }}
                                        isActive={
                                            Number(selectedMainCategoryId) ===
                                            Number(category.id)
                                        }
                                        onClick={() =>
                                            setSelectedMainCategoryId(
                                                Number(category.id)
                                            )
                                        }
                                    />
                                ))}
                                {selectedMainCategoryId && tenantCategories.length > 0 && (
                                    <div className="flex gap-2 border-l border-slate-200 pl-2">
                                        {tenantCategories.map((category) => (
                                            <CategoryTab
                                                key={`floating-tenant-${category.id}`}
                                                category={{
                                                    id: category.id,
                                                    name: category.name,
                                                }}
                                                isActive={
                                                    Number(selectedCategoryId) ===
                                                    Number(category.id)
                                                }
                                                onClick={() =>
                                                    setSelectedCategoryId(
                                                        Number(category.id)
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {embedHeaderInScroll && (
                    <div className="mb-4 space-y-3">
                        {scrollIntro}
                        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                            <div
                                className={`flex gap-3 ${
                                    compactHeaderLayout
                                        ? isCompactLandscape
                                            ? "items-center"
                                            : "flex-col items-stretch"
                                        : "flex-col"
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <SearchInput
                                        value={searchDraft}
                                        onChange={setSearchDraft}
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
                                <div className="flex items-center gap-2">
                                    <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("list")}
                                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                                viewMode === "list"
                                                    ? "bg-primary-500 text-white"
                                                    : "text-slate-500 hover:bg-slate-50"
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
                                                    : "text-slate-500 hover:bg-slate-50"
                                            }`}
                                        >
                                            <IconLayoutGrid size={15} />
                                            Grid
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileFilterSheetOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 md:hidden"
                                    >
                                        <IconAdjustmentsHorizontal size={15} />
                                        Filter
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                    {selectedMainCategoryName}
                                </span>
                                <select
                                    value={sortMode}
                                    onChange={(e) => setSortMode(e.target.value)}
                                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                >
                                    {sortOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
                {isSearching && (
                    <div className="mb-3 rounded-2xl border border-primary-100 bg-primary-50/80 px-4 py-3 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300">
                        Menyiapkan hasil pencarian produk...
                    </div>
                )}
                {sortedProducts.length > 0 ? (
                    groupedCategorySections.length > 0 ? (
                        <>
                            {groupedCategorySections.length >= 2 && (
                                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                    <p className="text-xs font-semibold text-slate-500">
                                        {Object.keys(collapsedCategoryIds).length ===
                                        groupedCategorySections.length
                                            ? "Semua kategori diciutkan"
                                            : Object.keys(collapsedCategoryIds).length > 0
                                              ? `${Object.keys(collapsedCategoryIds).length} kategori diciutkan`
                                              : "Kategori"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {Object.keys(collapsedCategoryIds).length > 0 && (
                                            <button
                                                type="button"
                                                onClick={expandAllCategories}
                                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                                            >
                                                Perluas Semua
                                            </button>
                                        )}
                                        {Object.keys(collapsedCategoryIds).length < groupedCategorySections.length && (
                                            <button
                                                type="button"
                                                onClick={collapseAllCategories}
                                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Ciutkan Semua
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-5">
                                {groupedCategorySections.map((section) => {
                                    const isCollapsed = collapsedCategoryIds[section.categoryId];
                                    return (
                                        <section key={`${selectedMainCategoryId}-${section.categoryId}`}>
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                        {section.categoryName}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {section.products.length} menu
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCategorySection(section.categoryId)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                                >
                                                    {isCollapsed ? "Lihat" : "Sembunyikan"}
                                                    {isCollapsed ? (
                                                        <IconChevronDown size={14} />
                                                    ) : (
                                                        <IconChevronUp size={14} />
                                                    )}
                                                </button>
                                            </div>
                                            {!isCollapsed && (
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
                                                            bestSellerIds={bestSellerIds}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        </>
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
                                    bestSellerIds={bestSellerIds}
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
                                (searchDraft
                                    ? "Produk tidak ditemukan"
                                    : "Tidak ada produk")}
                        </p>
                    </div>
                )}
                {products.length > 0 && hasMoreProducts ? (
                    <div
                        ref={loadMoreSentinelRef}
                        className="mt-4 flex justify-center"
                    >
                        <button
                            type="button"
                            onClick={() => onLoadMoreProducts?.()}
                            disabled={isLoadingMoreProducts}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {isLoadingMoreProducts
                                ? "Memuat produk..."
                                : "Muat lebih banyak"}
                        </button>
                    </div>
                ) : null}
            </div>

            {isMobileFilterSheetOpen && (
                <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
                    <div className="rounded-t-[30px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-[0_-24px_60px_-24px_rgba(15,23,42,0.35)]">
                        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Filter Produk
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-900">
                                    Atur tampilan menu
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMobileFilterSheetOpen(false)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500"
                            >
                                Tutup
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Urutkan
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {sortOptions.map((option) => (
                                        <button
                                            key={`sheet-${option.value}`}
                                            type="button"
                                            onClick={() => {
                                                setSortMode(option.value);
                                                setIsMobileFilterSheetOpen(false);
                                            }}
                                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                                sortMode === option.value
                                                    ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
                                                    : "border border-slate-200 bg-white text-slate-600"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Tampilan
                                </p>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("list")}
                                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                                            viewMode === "list"
                                                ? "bg-primary-500 text-white"
                                                : "text-slate-500"
                                        }`}
                                    >
                                        <IconList size={15} />
                                        List
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("grid")}
                                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                                            viewMode === "grid"
                                                ? "bg-primary-500 text-white"
                                                : "text-slate-500"
                                        }`}
                                    >
                                        <IconLayoutGrid size={15} />
                                        Grid
                                    </button>
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    {mainCategorySectionLabel}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <CategoryTab
                                        category={{ id: null, name: allMainCategoriesLabel }}
                                        isActive={selectedMainCategoryId === null}
                                        onClick={() => {
                                            setSelectedMainCategoryId(null);
                                            setIsMobileFilterSheetOpen(false);
                                        }}
                                    />
                                    {mainCategoryTabs.map((category) => (
                                        <CategoryTab
                                            key={`sheet-category-${category.id}`}
                                            category={{
                                                id: category.id,
                                                name: category.name,
                                            }}
                                            isActive={
                                                Number(selectedMainCategoryId) ===
                                                Number(category.id)
                                            }
                                            onClick={() => {
                                                setSelectedMainCategoryId(
                                                    Number(category.id)
                                                );
                                                setIsMobileFilterSheetOpen(false);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Export sub-components
ProductGrid.Card = ProductCard;
ProductGrid.CategoryTab = CategoryTab;
ProductGrid.SearchInput = SearchInput;
