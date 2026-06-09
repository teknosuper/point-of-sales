import { useState, useEffect, useCallback } from 'react';
import { IconSearch, IconX, IconFilter, IconChefHat, IconLayoutGrid, IconList, IconStar, IconDiscount2 } from '@tabler/icons-react';

export default function MenuCatalog({ categories, promoSummary, outlet, store, tenants }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [showPromoOnly, setShowPromoOnly] = useState(false);
    const [sortBy, setSortBy] = useState('title');
    const [showFilters, setShowFilters] = useState(false);
    const [gridView, setGridView] = useState(true);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (selectedTenant) params.append('tenant_outlet_id', selectedTenant);
            if (showPromoOnly) params.append('promo_only', '1');
            params.append('sort', sortBy);
            params.append('include_out_of_stock', '1');
            if (outlet?.code) params.append('outlet_code', outlet.code);

            // Use API route for JSON response
            const response = await fetch(`/api/public/catalog/products?${params.toString()}`);
            const data = await response.json();
            setProducts(data.data || []);
        } catch (error) {
            console.error('Failed to fetch products:', error);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [search, selectedTenant, showPromoOnly, sortBy, outlet?.code]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(debounce);
    }, [fetchProducts]);

    const promoProducts = products.filter(p => p.pricing_badge);
    const regularProducts = products.filter(p => !p.pricing_badge);
    const sortedProducts = showPromoOnly ? promoProducts : [...promoProducts, ...regularProducts];

    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const getBadgeStyle = (badge) => {
        const tones = {
            success: 'bg-emerald-500 text-white',
            danger: 'bg-rose-500 text-white',
            warning: 'bg-amber-500 text-white',
            accent: 'bg-orange-500 text-white',
        };
        return tones[badge?.tone] || 'bg-gray-500 text-white';
    };

    const getPromoGradient = (kind) => {
        const gradients = {
            buy_x_get_y: 'from-emerald-600 to-emerald-400',
            bundle_price: 'from-amber-600 to-orange-400',
            qty_break: 'from-sky-600 to-blue-400',
            standard_discount: 'from-rose-600 to-pink-400',
        };
        return gradients[kind] || 'from-gray-600 to-gray-400';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{store?.name || 'Menu Kami'}</h1>
                            {outlet && (
                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                    <IconChefHat size={14} />
                                    {outlet.name}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setGridView(true)}
                                className={`p-2 rounded-lg transition ${gridView ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <IconLayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => setGridView(false)}
                                className={`p-2 rounded-lg transition ${!gridView ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <IconList size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Cari menu favorit Anda..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-12 py-3 bg-slate-100 rounded-2xl border-0 focus:ring-2 focus:ring-primary/20 focus:bg-white transition text-slate-700 placeholder:text-slate-400"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <IconX size={20} />
                            </button>
                        )}
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 text-slate-600 hover:text-primary transition"
                    >
                        <IconFilter size={18} />
                        <span className="text-sm font-medium">Filter & Urutkan</span>
                    </button>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="mt-4 p-4 bg-white rounded-2xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-wrap gap-3">
                                {/* Promo Toggle */}
                                <button
                                    onClick={() => setShowPromoOnly(!showPromoOnly)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition ${
                                        showPromoOnly
                                            ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <IconDiscount2 size={16} />
                                    Promo Only
                                </button>

                                {/* Sort Options */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="px-4 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-primary/20 border-0"
                                >
                                    <option value="title">Nama A-Z</option>
                                    <option value="price_low">Harga Terendah</option>
                                    <option value="price_high">Harga Tertinggi</option>
                                    <option value="latest">Terbaru</option>
                                    <option value="promo_first">Promo Dulu</option>
                                </select>
                            </div>

                            {/* Tenant Select */}
                            <select
                                value={selectedTenant || ''}
                                onChange={(e) => setSelectedTenant(e.target.value || null)}
                                className="px-4 py-2 bg-slate-100 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-primary/20 border-0"
                            >
                                <option value="">Semua Dapur</option>
                                {tenants?.map((tenant) => (
                                    <option key={tenant.id} value={tenant.id}>
                                        {tenant.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Promo Banner Stats */}
                {promoSummary?.active_rules_count > 0 && (
                    <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 px-4 py-2">
                        <p className="text-white text-sm font-medium flex items-center gap-2">
                            <IconStar size={16} className="fill-current" />
                            {promoSummary.active_rules_count} Promo Aktif • Klik "Promo Only" untuk lihat semua
                        </p>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Loading State */}
                {loading && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                                <div className="aspect-square bg-slate-200" />
                                <div className="p-4 space-y-3">
                                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Products Grid/List */}
                {!loading && (
                    <>
                        {sortedProducts.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <IconSearch size={40} className="text-slate-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">Menu tidak ditemukan</h3>
                                <p className="text-slate-500">Coba ubah kata kunci atau filter pencarian</p>
                            </div>
                        ) : (
                            <div className={gridView
                                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                                : 'space-y-4'
                            }>
                                {sortedProducts.map((product) => (
                                    <div
                                        key={product.id}
                                        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group ${
                                            !gridView ? 'flex' : ''
                                        }`}
                                    >
                                        {/* Product Image */}
                                        <div className={`relative overflow-hidden ${gridView ? 'aspect-square' : 'w-32 h-32 md:w-48 md:h-48 flex-shrink-0'}`}>
                                            {product.image ? (
                                                <img
                                                    src={product.image}
                                                    alt={product.title}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                                    <ChefHatIcon className="w-12 h-12 text-slate-300" />
                                                </div>
                                            )}

                                            {/* Promo Badge */}
                                            {product.pricing_badge && (
                                                <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold shadow-lg ${getBadgeStyle(product.pricing_badge)}`}>
                                                    {product.pricing_badge.name || product.pricing_badge.label}
                                                </div>
                                            )}

                                            {/* Promo Gradient Overlay */}
                                            {product.pricing_badge && (
                                                <div className={`absolute inset-0 bg-gradient-to-t ${getPromoGradient(product.pricing_badge.kind)} opacity-20`} />
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div className={`p-4 flex flex-col ${!gridView ? 'flex-1 justify-center' : ''}`}>
                                            <p className="text-xs text-primary font-medium mb-1">{product.category?.name}</p>
                                            <h3 className={`font-bold text-slate-800 mb-1 line-clamp-2 ${gridView ? 'text-sm md:text-base' : 'text-lg'}`}>
                                                {product.title}
                                            </h3>

                                            {product.pricing_badge ? (
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-400 line-through">
                                                        {formatPrice(product.pricing_badge.base_price || product.sell_price)}
                                                    </p>
                                                    <p className="text-lg font-bold text-rose-600">
                                                        {formatPrice(product.effective_price)}
                                                    </p>
                                                    {product.pricing_badge.detail && (
                                                        <p className="text-xs text-emerald-600 font-medium">
                                                            {product.pricing_badge.detail}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-lg font-bold text-slate-800">
                                                    {formatPrice(product.sell_price)}
                                                </p>
                                            )}

                                            {product.stock <= 5 && product.stock > 0 && (
                                                <p className="text-xs text-amber-500 font-medium mt-2">
                                                    ⚡ Tersisa {product.stock}
                                                </p>
                                            )}
                                            {product.stock === 0 && (
                                                <p className="text-xs text-slate-400 font-medium mt-2">
                                                    Stok habis
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-12 py-8 bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="font-semibold text-lg mb-2">{store?.name || 'Menu Kami'}</p>
                    <p className="text-slate-400 text-sm">© 2024 • All Rights Reserved</p>
                </div>
            </footer>
        </div>
    );
}

function ChefHatIcon({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
            <line x1="6" y1="17" x2="18" y2="17" />
        </svg>
    );
}
