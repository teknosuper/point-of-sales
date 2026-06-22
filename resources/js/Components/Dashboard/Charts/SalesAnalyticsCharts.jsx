import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { IconX, IconTrendingUp, IconShoppingCart, IconReceipt2, IconCoin } from '@tabler/icons-react';

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value);

// Product Detail Modal Component
export const ProductDetailModal = ({ product, onClose }) => {
    if (!product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {product.product_name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            SKU: {product.product_sku || '-'} • {product.category_name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Summary Stats */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <IconShoppingCart size={16} />
                                <span className="text-xs font-medium uppercase">Total Terjual</span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                {product.total_qty}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">item</p>
                        </div>

                        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <IconReceipt2 size={16} />
                                <span className="text-xs font-medium uppercase">Grand Total</span>
                            </div>
                            <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(product.total_revenue)}
                            </p>
                            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">omzet produk</p>
                        </div>

                        <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <IconTrendingUp size={16} />
                                <span className="text-xs font-medium uppercase">Harga Rata-rata</span>
                            </div>
                            <p className="mt-2 text-xl font-bold text-blue-700 dark:text-blue-300">
                                {formatCurrency(product.avg_price)}
                            </p>
                            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">per item</p>
                        </div>

                        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                <IconCoin size={16} />
                                <span className="text-xs font-medium uppercase">Stock</span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
                                {product.current_stock}
                            </p>
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">unit tersedia</p>
                        </div>
                    </div>

                    {/* Transaction Stats */}
                    <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Statistik Transaksi
                        </h3>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Jumlah Transaksi</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{product.transaction_count} kali</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Rata-rata per Transaksi</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {product.average_qty_per_transaction ?? 0} item
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Rata-rata Grand Total per Transaksi</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {formatCurrency(product.average_revenue_per_transaction)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Kontribusi ke Omzet</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {product.revenue_share_percent ?? 0}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Kontribusi ke Qty</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {product.qty_share_percent ?? 0}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Harga Termurah</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(product.min_price)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Harga Termahal</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(product.max_price)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stock Alert */}
                    {product.current_stock <= 5 && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                                ⚠️ Peringatan Stock Rendah
                            </p>
                            <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                                Stock hanya tersisa {product.current_stock} unit. Pertimbangkan untuk restok.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChartCard = ({ title, subtitle, children, isEmpty = false }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {isEmpty ? (
            <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data</p>
            </div>
        ) : (
            children
        )}
    </div>
);

export const HourlyBreakdownChart = ({ data = [] }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current || !data.length) return;

        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.label),
                datasets: [
                    {
                        label: 'Pendapatan',
                        data: data.map(item => item.revenue_total),
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = data[index];
                                return [
                                    `Pendapatan: ${formatCurrency(item.revenue_total)}`,
                                    `Transaksi: ${item.orders_count}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                        },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [data]);

    return (
        <ChartCard
            title="Penjualan per Jam"
            subtitle="Pola penjualan berdasarkan jam transaksi"
            isEmpty={data.length === 0}
        >
            <div className="h-64">
                <canvas ref={chartRef}></canvas>
            </div>
        </ChartCard>
    );
};

export const DailyBreakdownChart = ({ data = [] }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current || !data.length) return;

        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.label),
                datasets: [
                    {
                        label: 'Pendapatan Harian',
                        data: data.map(item => item.revenue_total),
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = data[index];
                                return [
                                    `Pendapatan: ${formatCurrency(item.revenue_total)}`,
                                    `Transaksi: ${item.orders_count}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                        },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [data]);

    return (
        <ChartCard
            title="Tren Penjualan Harian"
            subtitle="Penjualan harian dalam 30 hari terakhir"
            isEmpty={data.length === 0}
        >
            <div className="h-64">
                <canvas ref={chartRef}></canvas>
            </div>
        </ChartCard>
    );
};

export const TopProductsChart = ({ data = [] }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current || !data.length) return;

        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.product_name),
                datasets: [
                    {
                        label: 'Pendapatan',
                        data: data.map(item => item.total_revenue),
                        backgroundColor: 'rgba(139, 92, 246, 0.8)',
                        borderColor: 'rgba(139, 92, 246, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = data[index];
                                return [
                                    `Pendapatan: ${formatCurrency(item.total_revenue)}`,
                                    `Qty Terjual: ${item.total_qty}`,
                                    `Transaksi: ${item.transaction_count}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                        },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [data]);

    return (
        <ChartCard
            title="Produk Terlaris"
            subtitle="Top 10 produk berdasarkan pendapatan"
            isEmpty={data.length === 0}
        >
            <div className="h-80">
                <canvas ref={chartRef}></canvas>
            </div>
        </ChartCard>
    );
};

export const CategoryBreakdownChart = ({ data = [] }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current || !data.length) return;

        const colors = [
            'rgba(239, 68, 68, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(20, 184, 166, 0.8)',
            'rgba(251, 146, 60, 0.8)',
        ];

        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item.category_name),
                datasets: [
                    {
                        data: data.map(item => item.total_revenue),
                        backgroundColor: colors,
                        borderColor: colors.map(c => c.replace('0.8', '1')),
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = data[index];
                                const total = data.reduce((sum, d) => sum + d.total_revenue, 0);
                                const percentage = ((item.total_revenue / total) * 100).toFixed(1);
                                return [
                                    `${item.category_name}`,
                                    `Pendapatan: ${formatCurrency(item.total_revenue)} (${percentage}%)`,
                                    `Qty: ${item.total_qty}`,
                                ];
                            },
                        },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [data]);

    return (
        <ChartCard
            title="Penjualan per Kategori"
            subtitle="Breakdown pendapatan berdasarkan kategori produk"
            isEmpty={data.length === 0}
        >
            <div className="h-64">
                <canvas ref={chartRef}></canvas>
            </div>
        </ChartCard>
    );
};

export const PaymentMethodChart = ({ data = [] }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current || !data.length) return;

        const colors = [
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(236, 72, 153, 0.8)',
        ];

        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(item => item.payment_method_label),
                datasets: [
                    {
                        data: data.map(item => item.revenue_total),
                        backgroundColor: colors,
                        borderColor: colors.map(c => c.replace('0.8', '1')),
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = data[index];
                                const total = data.reduce((sum, d) => sum + d.revenue_total, 0);
                                const percentage = ((item.revenue_total / total) * 100).toFixed(1);
                                return [
                                    `${item.payment_method_label}`,
                                    `Pendapatan: ${formatCurrency(item.revenue_total)} (${percentage}%)`,
                                    `Transaksi: ${item.orders_count}`,
                                ];
                            },
                        },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [data]);

    return (
        <ChartCard
            title="Metode Pembayaran"
            subtitle="Distribusi transaksi berdasarkan metode pembayaran"
            isEmpty={data.length === 0}
        >
            <div className="h-64">
                <canvas ref={chartRef}></canvas>
            </div>
        </ChartCard>
    );
};

// Detailed Products Table with Clickable Rows
export const DetailedProductsTable = ({ data = [], onProductClick }) => {
    const [sortField, setSortField] = useState('total_revenue');
    const [sortOrder, setSortOrder] = useState('desc');

    const sortedData = [...data].sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';

        if (typeof aVal === 'string' || typeof bVal === 'string') {
            const comparison = String(aVal).localeCompare(String(bVal), 'id', {
                numeric: true,
                sensitivity: 'base',
            });

            return sortOrder === 'desc' ? comparison * -1 : comparison;
        }

        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    const totalProducts = data.length;
    const totalQtySold = data.reduce((sum, item) => sum + (item.total_qty || 0), 0);
    const grandRevenueTotal = data.reduce((sum, item) => sum + (item.total_revenue || 0), 0);
    const totalTransactions = data.reduce((sum, item) => sum + (item.transaction_count || 0), 0);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null;
        return sortOrder === 'desc' ? ' ↓' : ' ↑';
    };

    if (data.length === 0) {
        return (
            <ChartCard
                title="Daftar Produk Lengkap"
                subtitle="Semua produk terjual dengan statistik penjualan lengkap"
                isEmpty={true}
            />
        );
    }

    return (
        <ChartCard title="Daftar Produk Lengkap" subtitle="Klik produk untuk melihat detail statistik lengkap">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Produk Terjual</div>
                    <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{totalProducts}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Jumlah Item Terjual</div>
                    <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{totalQtySold}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Grand Total</div>
                    <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(grandRevenueTotal)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Total Transaksi Produk</div>
                    <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{totalTransactions}</div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                #
                            </th>
                            <th 
                                className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('product_name')}
                            >
                                Nama Produk<SortIcon field="product_name" />
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                Kategori
                            </th>
                            <th 
                                className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('total_qty')}
                            >
                                Qty Terjual<SortIcon field="total_qty" />
                            </th>
                            <th 
                                className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('transaction_count')}
                            >
                                Transaksi<SortIcon field="transaction_count" />
                            </th>
                            <th 
                                className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('avg_price')}
                            >
                                Harga Rata-rata<SortIcon field="avg_price" />
                            </th>
                            <th 
                                className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('average_revenue_per_transaction')}
                            >
                                Rata-rata / Transaksi<SortIcon field="average_revenue_per_transaction" />
                            </th>
                            <th 
                                className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('total_revenue')}
                            >
                                Grand Total<SortIcon field="total_revenue" />
                            </th>
                            <th 
                                className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-pointer hover:text-primary-500"
                                onClick={() => handleSort('revenue_share_percent')}
                            >
                                Kontribusi<SortIcon field="revenue_share_percent" />
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                Stock
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedData.map((item, index) => (
                            <tr 
                                key={item.product_id} 
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                onClick={() => onProductClick?.(item)}
                            >
                                <td className="px-4 py-3 text-sm text-slate-400">
                                    {index + 1}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900 dark:text-white">
                                        {item.product_name}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        SKU: {item.product_sku || '-'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                                        {item.category_name}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className="inline-flex rounded-full bg-primary-100 px-2 py-1 text-xs font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-400">
                                        {item.total_qty}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                    {item.transaction_count}×
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                    {formatCurrency(item.avg_price)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                    <div>{formatCurrency(item.average_revenue_per_transaction)}</div>
                                    <div className="text-xs text-slate-400">
                                        {item.average_qty_per_transaction} item / trx
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(item.total_revenue)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                    {item.revenue_share_percent}%
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                        item.current_stock > 10
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : item.current_stock > 0
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    }`}>
                                        {item.current_stock}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onProductClick?.(item);
                                        }}
                                        className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-400 dark:hover:bg-primary-950/60"
                                    >
                                        Detail
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ChartCard>
    );
};

export const SlowMovingProductsTable = ({ data = [] }) => {
    if (data.length === 0) {
        return (
            <ChartCard
                title="Produk Slow Moving"
                subtitle="Produk dengan penjualan terendah perlu perhatian"
                isEmpty={true}
            />
        );
    }

    return (
        <ChartCard
            title="Produk Slow Moving"
            subtitle="Produk dengan penjualan terendah perlu perhatian"
        >
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Produk</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Kategori</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Qty Terjual</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Stock</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                    {item.product_name}
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                                    {item.category_name}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        {item.total_qty}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                        item.current_stock > 10
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    }`}>
                                        {item.current_stock}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                                    {formatCurrency(item.total_revenue)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ChartCard>
    );
};
