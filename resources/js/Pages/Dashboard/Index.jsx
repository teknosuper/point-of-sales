import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { detectPwaInstalled } from "@/Utils/pwaInstallation";
import {
    IconBooks,
    IconBox,
    IconChecklist,
    IconCategory,
    IconCircleCheck,
    IconMoneybag,
    IconUsers,
    IconCoin,
    IconReceipt,
    IconTrendingUp,
    IconArrowUpRight,
    IconArrowDownRight,
    IconShoppingCart,
    IconChartBar,
    IconClock,
    IconAlertTriangle,
    IconPackageOff,
    IconTarget,
    IconMapPin,
    IconWallet,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

// Stat Card Component
function StatCard({ title, value, subtitle, icon: Icon, gradient, trend }) {
    return (
        <div
            className={`
            relative overflow-hidden rounded-2xl p-5
            bg-gradient-to-br ${gradient}
            text-white shadow-lg
        `}
        >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
                <Icon
                    size={128}
                    strokeWidth={0.5}
                    className="transform translate-x-8 -translate-y-8"
                />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-white/20">
                        <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium opacity-90">
                        {title}
                    </span>
                </div>

                <p className="text-3xl font-bold">{value}</p>

                {subtitle && (
                    <p className="mt-2 text-sm opacity-80 flex items-center gap-1">
                        {trend === "up" && <IconArrowUpRight size={14} />}
                        {trend === "down" && <IconArrowDownRight size={14} />}
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

// Target Progress Card Component
function TargetCard({ title, current, target, icon: Icon }) {
    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const isAchieved = percentage >= 100;

    return (
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
                <Icon
                    size={128}
                    strokeWidth={0.5}
                    className="transform translate-x-8 -translate-y-8"
                />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-white/20">
                        <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium opacity-90">
                        {title}
                    </span>
                </div>

                <p className="text-2xl font-bold">{percentage.toFixed(0)}%</p>

                {/* Progress Bar */}
                <div className="mt-3 w-full h-2 bg-white/30 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            isAchieved ? "bg-green-400" : "bg-white"
                        }`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                <p className="mt-2 text-xs opacity-80">
                    {formatCurrency(current)} / {formatCurrency(target)}
                </p>
            </div>
        </div>
    );
}

// Info Card Component
function InfoCard({ title, value, subtitle, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {title}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {value}
                    </p>
                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Icon size={14} />
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <Icon
                        size={24}
                        className="text-slate-600 dark:text-slate-400"
                        strokeWidth={1.5}
                    />
                </div>
            </div>
        </div>
    );
}

// List Card Component
function ListCard({ title, subtitle, icon: Icon, children, emptyMessage }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                        <Icon
                            size={18}
                            className="text-primary-600 dark:text-primary-400"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-5">
                {children || (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard({
    totalCategories,
    totalProducts,
    totalTransactions,
    totalCustomers,
    walkInTransactions = 0,
    memberTransactions = 0,
    revenueTrend,
    totalRevenue,
    totalProfit,
    averageOrder,
    todayTransactions,
    todaySales = 0,
    todayProfit = 0,
    monthlyTarget = 0,
    currentMonthSales = 0,
    topProducts = [],
    slowMovingProducts = [],
    recentTransactions = [],
    topCustomers = [],
    topLocations = [],
    lowStockProducts = [],
    activeShifts = [],
    onboardingChecklist = [],
    onboardingSummary = {},
}) {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);
    const [pwaInstalled, setPwaInstalled] = useState(false);

    const chartData = useMemo(() => revenueTrend ?? [], [revenueTrend]);
    const effectiveOnboardingChecklist = useMemo(
        () =>
            onboardingChecklist.map((item) =>
                item.key === "pwa_device"
                    ? {
                          ...item,
                          done: pwaInstalled,
                          count: pwaInstalled ? 1 : 0,
                      }
                    : item
            ),
        [onboardingChecklist, pwaInstalled]
    );
    const effectiveOnboardingSummary = useMemo(
        () => ({
            ...onboardingSummary,
            total: effectiveOnboardingChecklist.length,
            completed: effectiveOnboardingChecklist.filter((item) => item.done).length,
        }),
        [onboardingSummary, effectiveOnboardingChecklist]
    );

    useEffect(() => {
        if (typeof window === "undefined") return;

        const syncPwaInstalled = () => {
            setPwaInstalled(detectPwaInstalled());
        };

        syncPwaInstalled();
        window.addEventListener("appinstalled", syncPwaInstalled);
        window.addEventListener("focus", syncPwaInstalled);
        window.addEventListener("pageshow", syncPwaInstalled);

        return () => {
            window.removeEventListener("appinstalled", syncPwaInstalled);
            window.removeEventListener("focus", syncPwaInstalled);
            window.removeEventListener("pageshow", syncPwaInstalled);
        };
    }, []);

    // Setup chart
    useEffect(() => {
        if (!chartRef.current) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }

        if (!chartData.length) return;

        const labels = chartData.map((item) => item.label);
        const totals = chartData.map((item) => item.total);

        const ctx = chartRef.current.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.3)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.01)");

        chartInstance.current = new Chart(chartRef.current, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Pendapatan",
                        data: totals,
                        borderColor: "#6366f1",
                        backgroundColor: gradient,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: "#6366f1",
                        pointHoverBorderColor: "#fff",
                        pointHoverBorderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index",
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#f1f5f9",
                        padding: 12,
                        borderRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => formatCurrency(ctx.raw),
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                            color: "#94a3b8",
                            font: { size: 11 },
                        },
                        grid: {
                            color: "rgba(148, 163, 184, 0.1)",
                            drawBorder: false,
                        },
                        border: { display: false },
                    },
                    x: {
                        ticks: {
                            color: "#94a3b8",
                            font: { size: 11 },
                        },
                        grid: { display: false },
                        border: { display: false },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [chartData]);

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Dashboard
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Ringkasan aktivitas bisnis Anda
                        </p>
                    </div>
                    <Link
                        href={route("transactions.index")}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors shadow-lg shadow-primary-500/30"
                    >
                        <IconShoppingCart size={18} />
                        <span>Transaksi Baru</span>
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-primary-100 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                                    <IconChecklist size={18} />
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Checklist Setup Outlet, Tenant & Kitchen
                                </h2>
                            </div>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Ikuti urutan ini sampai operasional outlet, tenant foodcourt, kitchen, dan settlement siap dipakai.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={route("guides.setup-wizard")}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                <IconChecklist size={16} />
                                Buka Wizard Setup
                            </Link>
                            <Link
                                href={route("guides.outlet-kitchen")}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                <IconBooks size={16} />
                                Buka Panduan Lengkap
                            </Link>
                            <Link
                                href={route("guides.pwa-setup")}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                <IconChecklist size={16} />
                                Setup PWA & Perangkat
                            </Link>
                            <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {effectiveOnboardingSummary.completed ?? 0} / {effectiveOnboardingSummary.total ?? 0} selesai
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {effectiveOnboardingChecklist.map((item, index) => (
                            <div
                                key={item.key}
                                className={`rounded-xl border p-4 ${
                                    item.done
                                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                        : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                                                item.done
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                            }`}
                                        >
                                            {item.done ? <IconCircleCheck size={16} /> : index + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {item.title}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                {item.description}
                                            </p>
                                            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                Jumlah saat ini: {item.count ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                            item.done
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                        }`}
                                    >
                                        {item.done ? "Selesai" : "Belum"}
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <Link
                                        href={item.href}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        {item.action_label}
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Stat Cards - Reorganized */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Penjualan Hari Ini"
                        value={formatCurrency(todaySales)}
                        subtitle="Total penjualan hari ini"
                        icon={IconCoin}
                        gradient="from-primary-500 to-primary-700"
                    />
                    <StatCard
                        title="Profit Hari Ini"
                        value={formatCurrency(todayProfit)}
                        subtitle="Profit bersih hari ini"
                        icon={IconTrendingUp}
                        gradient="from-success-500 to-success-700"
                        trend="up"
                    />
                    <TargetCard
                        title="Target Bulan Ini"
                        current={currentMonthSales}
                        target={monthlyTarget}
                        icon={IconTarget}
                    />
                    <StatCard
                        title="Transaksi Hari Ini"
                        value={todayTransactions}
                        subtitle="Transaksi"
                        icon={IconClock}
                        gradient="from-warning-500 to-warning-600"
                    />
                </div>

                {/* Secondary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard
                        title="Total Kategori"
                        value={totalCategories}
                        icon={IconCategory}
                    />
                    <InfoCard
                        title="Total Produk"
                        value={totalProducts}
                        icon={IconBox}
                    />
                    <InfoCard
                        title="Total Transaksi"
                        value={totalTransactions}
                        icon={IconMoneybag}
                    />
                    <InfoCard
                        title="Total Pelanggan"
                        value={totalCustomers}
                        icon={IconUsers}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard
                        title="Transaksi Umum / Walk-in"
                        value={walkInTransactions}
                        subtitle={`${totalTransactions > 0 ? ((walkInTransactions / totalTransactions) * 100).toFixed(0) : 0}% dari total transaksi`}
                        icon={IconUsers}
                    />
                    <InfoCard
                        title="Transaksi Customer Terdaftar"
                        value={memberTransactions}
                        subtitle={`${totalTransactions > 0 ? ((memberTransactions / totalTransactions) * 100).toFixed(0) : 0}% dari total transaksi`}
                        icon={IconWallet}
                    />
                </div>

                {/* Revenue Chart - Full Width */}
                <ListCard
                    title="Tren Pendapatan"
                    subtitle="12 data terakhir"
                    icon={IconChartBar}
                    emptyMessage="Belum ada data pendapatan"
                >
                    {chartData.length > 0 && (
                        <div className="h-72">
                            <canvas ref={chartRef} />
                        </div>
                    )}
                </ListCard>

                {/* 4-Column Bottom Widgets */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ListCard
                        title="Shift Aktif"
                        subtitle="Pemantauan kasir"
                        icon={IconWallet}
                        emptyMessage="Tidak ada shift aktif"
                    >
                        {activeShifts.length > 0 && (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {activeShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        className="py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {shift.user?.name || "-"}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {shift.transactions_count} transaksi
                                                </p>
                                            </div>
                                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(shift.expected_cash)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ListCard>

                    {/* Top Products */}
                    <ListCard
                        title="Produk Terlaris"
                        subtitle="Best seller"
                        icon={IconBox}
                        emptyMessage="Belum ada data"
                    >
                        {topProducts.length > 0 && (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {topProducts.slice(0, 3).map((product, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-sm font-semibold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                                                    {product.name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    SKU: {product.sku || "-"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-semibold text-primary-600 dark:text-primary-400 leading-tight">
                                                {product.qty}x
                                            </p>
                                            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Terjual
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ListCard>

                    {/* Slow Moving Products */}
                    <ListCard
                        title="Slow Moving"
                        subtitle="Tidak terjual 30 hari"
                        icon={IconPackageOff}
                        emptyMessage="Semua produk laku"
                    >
                        {slowMovingProducts.length > 0 && (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {slowMovingProducts.map((product, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                                                {product.name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-warning-500 font-semibold">
                                            {product.stock} pcs
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ListCard>

                    {/* Top Customers */}
                    <ListCard
                        title="Pelanggan Terbaik"
                        subtitle="Top spender"
                        icon={IconUsers}
                        emptyMessage="Belum ada data"
                    >
                        {topCustomers.length > 0 && (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {topCustomers
                                    .slice(0, 5)
                                    .map((customer, index) => (
                                        <li
                                            key={index}
                                            className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold flex items-center justify-center">
                                                    {index + 1}
                                                </span>
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                    {customer.name}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500 font-semibold">
                                                {customer.orders}x
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </ListCard>

                    {/* Top Locations */}
                    <ListCard
                        title="Lokasi Terbanyak"
                        subtitle="Berdasar kelurahan transaksi"
                        icon={IconMapPin}
                        emptyMessage="Belum ada data"
                    >
                        {topLocations.length > 0 && (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {topLocations.map((loc, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-sm font-semibold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                                                {loc.name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500 font-semibold">
                                            {loc.orders}x
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </ListCard>
                </div>

                {/* Recent Transactions */}
                <ListCard
                    title="Transaksi Terbaru"
                    subtitle="5 transaksi terakhir"
                    icon={IconReceipt}
                    emptyMessage="Belum ada transaksi"
                >
                    {recentTransactions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {recentTransactions.map((trx, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                            {trx.invoice}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {trx.date} • {trx.customer}
                                        </p>
                                    </div>
                                    <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                        {formatCurrency(trx.total)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </ListCard>

                {/* Low Stock Highlight */}
                <ListCard
                    title="Stok Menipis"
                    subtitle="Stok < 10"
                    icon={IconAlertTriangle}
                    emptyMessage="Semua stok aman"
                >
                    {lowStockProducts.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {lowStockProducts.map((product, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm font-semibold text-rose-800 dark:text-rose-200 truncate max-w-[140px]">
                                            {product.name}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                                        {product.stock} pcs
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </ListCard>
            </div>
        </>
    );
}

Dashboard.layout = (page) => <DashboardLayout children={page} />;
