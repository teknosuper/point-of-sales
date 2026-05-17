import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import Chart from "chart.js/auto";
import {
    IconCalendar,
    IconChartBar,
    IconChartLine,
    IconDatabaseOff,
    IconFilter,
    IconReceipt2,
    IconSearch,
    IconShoppingBag,
    IconSparkles,
    IconWallet,
    IconX,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const defaultFilters = {
    q: "",
    start_date: "",
    end_date: "",
    quick_range: "",
    payment_method: "",
    payment_status: "",
    order_type: "",
    cashier_id: "",
    per_page: "15",
};

const compactFilters = (filters = {}) =>
    Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined)
    );

const SummaryCard = ({ icon, title, value, description, tone = "slate" }) => {
    const tones = {
        emerald: "from-emerald-500 to-emerald-700",
        blue: "from-blue-500 to-blue-700",
        violet: "from-violet-500 to-violet-700",
        amber: "from-amber-500 to-amber-600",
        slate: "from-slate-700 to-slate-900",
    };

    return (
        <div className={`rounded-3xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-lg`}>
            <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/15 p-3">{icon}</div>
                <div>
                    <p className="text-sm font-medium text-white/80">{title}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-white/75">{description}</p>
                </div>
            </div>
        </div>
    );
};

export default function WorkspaceSalesIndex({
    filters = {},
    transactions = {},
    summary = {},
    trend = [],
    hourlyTrend = [],
    paymentBreakdown = [],
    topProducts = [],
    cashiers = [],
    meta = {},
}) {
    const { auth } = usePage().props;
    const isKitchenWorkspace =
        meta?.metric_mode === "base_cost" || meta?.metric_mode === "tenant_sales" || auth?.user?.preferred_workspace === "kitchen";
    const primaryMetricLabel = isKitchenWorkspace ? "Penjualan Tenant" : "Penjualan";
    const primaryContextLabel = isKitchenWorkspace ? "penjualan murni tenant (tanpa markup owner)" : "penjualan operasional";
    const settlementRecipientLabel = meta?.settlement_recipient?.name || "Admin / owner belum diatur";
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        q: filters?.q ?? "",
        start_date: filters?.start_date ?? "",
        end_date: filters?.end_date ?? "",
        quick_range: filters?.quick_range ?? "",
        payment_method: filters?.payment_method ?? "",
        payment_status: filters?.payment_status ?? "",
        order_type: filters?.order_type ?? "",
        cashier_id: filters?.cashier_id ? String(filters.cashier_id) : "",
        per_page: String(filters?.per_page ?? 15),
    });
    const salesChartRef = useRef(null);
    const salesChartInstanceRef = useRef(null);
    const paymentChartRef = useRef(null);
    const paymentChartInstanceRef = useRef(null);
    const hourlyChartRef = useRef(null);
    const hourlyChartInstanceRef = useRef(null);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            q: filters?.q ?? "",
            start_date: filters?.start_date ?? "",
            end_date: filters?.end_date ?? "",
            quick_range: filters?.quick_range ?? "",
            payment_method: filters?.payment_method ?? "",
            payment_status: filters?.payment_status ?? "",
            order_type: filters?.order_type ?? "",
            cashier_id: filters?.cashier_id ? String(filters.cashier_id) : "",
            per_page: String(filters?.per_page ?? 15),
        });
    }, [filters]);

    const rows = transactions?.data ?? [];
    const paginationLinks = transactions?.links ?? [];
    const activeFilterCount = useMemo(
        () =>
            Object.entries(filterData).filter(
                ([key, value]) => key !== "per_page" && value !== ""
            ).length,
        [filterData]
    );

    useEffect(() => {
        if (!salesChartRef.current) return;
        salesChartInstanceRef.current?.destroy();

        if (!trend.length) return;

        salesChartInstanceRef.current = new Chart(salesChartRef.current, {
            type: "line",
            data: {
                labels: trend.map((item) => item.label),
                datasets: [
                    {
                        label: primaryMetricLabel,
                        data: trend.map((item) => item.total_value),
                        borderColor: "#2563eb",
                        backgroundColor: "rgba(37,99,235,0.18)",
                        fill: true,
                        tension: 0.35,
                    },
                    {
                        label: "Jumlah Transaksi",
                        data: trend.map((item) => item.orders_count),
                        borderColor: "#16a34a",
                        backgroundColor: "rgba(22,163,74,0.12)",
                        fill: false,
                        tension: 0.35,
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => `Rp ${Number(value).toLocaleString("id-ID")}`,
                        },
                    },
                    y1: {
                        position: "right",
                        grid: { drawOnChartArea: false },
                    },
                },
            },
        });

        return () => salesChartInstanceRef.current?.destroy();
    }, [trend]);

    useEffect(() => {
        if (!paymentChartRef.current) return;
        paymentChartInstanceRef.current?.destroy();

        if (!paymentBreakdown.length) return;

        paymentChartInstanceRef.current = new Chart(paymentChartRef.current, {
            type: "bar",
            data: {
                labels: paymentBreakdown.map((item) => item.payment_method || "lainnya"),
                datasets: [
                    {
                        label: `${primaryMetricLabel} per Metode Bayar`,
                        data: paymentBreakdown.map((item) => item.total_value),
                        backgroundColor: ["#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444"],
                        borderRadius: 10,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => `Rp ${Number(value).toLocaleString("id-ID")}`,
                        },
                    },
                },
            },
        });

        return () => paymentChartInstanceRef.current?.destroy();
    }, [paymentBreakdown]);

    useEffect(() => {
        if (!hourlyChartRef.current) return;
        hourlyChartInstanceRef.current?.destroy();

        if (!hourlyTrend.length) return;

        hourlyChartInstanceRef.current = new Chart(hourlyChartRef.current, {
            type: "bar",
            data: {
                labels: hourlyTrend.map((item) => item.label),
                datasets: [
                    {
                        label: primaryMetricLabel,
                        data: hourlyTrend.map((item) => item.total_value),
                        backgroundColor: "#0ea5e9",
                        borderRadius: 10,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => `Rp ${Number(value).toLocaleString("id-ID")}`,
                        },
                    },
                },
            },
        });

        return () => hourlyChartInstanceRef.current?.destroy();
    }, [hourlyTrend]);

    const handleChange = (field, value) => {
        setFilterData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("workspace-sales.index"), compactFilters(filterData), {
            preserveScroll: true,
            preserveState: false,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        setShowFilters(false);
        router.get(route("workspace-sales.index"), {}, {
            preserveScroll: false,
            preserveState: false,
            replace: true,
        });
    };

    const quickSearch = (event) => {
        event.preventDefault();
        router.get(route("workspace-sales.index"), compactFilters(filterData), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const applyQuickRange = (quickRange) => {
        const nextFilters = {
            ...filterData,
            quick_range: quickRange,
        };

        setFilterData(nextFilters);
        router.get(route("workspace-sales.index"), compactFilters(nextFilters), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const outletLabel = meta?.outlet?.name || "Outlet aktif";

    return (
        <>
            <Head title="Statistik Penjualan" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <IconChartLine size={28} className="text-primary-500" />
                            Statistik Penjualan
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Ringkasan {primaryContextLabel} untuk {outletLabel}.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        Filter aktif: {activeFilterCount}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        icon={<IconWallet size={20} />}
                        title="Hari Ini"
                        value={formatCurrency(summary?.today_total ?? 0)}
                        description={
                            isKitchenWorkspace
                                ? `${summary?.today_orders ?? 0} transaksi`
                                : `${summary?.today_orders ?? 0} transaksi • profit kotor ${formatCurrency(summary?.today_markup_total ?? 0)}`
                        }
                        tone="emerald"
                    />
                    <SummaryCard
                        icon={<IconCalendar size={20} />}
                        title="Kemarin"
                        value={formatCurrency(summary?.yesterday_total ?? 0)}
                        description={
                            isKitchenWorkspace
                                ? `${summary?.yesterday_orders ?? 0} transaksi`
                                : `${summary?.yesterday_orders ?? 0} transaksi • profit kotor ${formatCurrency(summary?.yesterday_markup_total ?? 0)}`
                        }
                        tone="blue"
                    />
                    <SummaryCard
                        icon={<IconChartBar size={20} />}
                        title="Bulan Ini"
                        value={formatCurrency(summary?.month_total ?? 0)}
                        description={
                            isKitchenWorkspace
                                ? `${summary?.month_orders ?? 0} transaksi`
                                : `${summary?.month_orders ?? 0} transaksi • profit kotor ${formatCurrency(summary?.month_markup_total ?? 0)}`
                        }
                        tone="violet"
                    />
                    <SummaryCard
                        icon={<IconReceipt2 size={20} />}
                        title="Sesuai Filter"
                        value={formatCurrency(summary?.filtered_total ?? 0)}
                        description={
                            isKitchenWorkspace
                                ? `${summary?.filtered_orders_count ?? 0} transaksi`
                                : `${summary?.filtered_orders_count ?? 0} transaksi • profit kotor ${formatCurrency(summary?.filtered_markup_total ?? 0)}`
                        }
                        tone="amber"
                    />
                </div>

                {isKitchenWorkspace ? (
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                                    Settlement Tenant
                                </h2>
                                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">
                                    Laporan ini hanya menghitung transaksi tenant yang sudah <span className="font-semibold">selesai diantar / diambil pelanggan</span>.
                                    Angka yang ditampilkan adalah <span className="font-semibold">penjualan murni tenant</span> (tanpa markup owner outlet).
                                </p>
                                <p className="text-sm text-emerald-900 dark:text-emerald-100">
                                    Pembayaran pelanggan tetap dipisah jelas:
                                    <span className="font-semibold"> tunai</span> berarti kasir menerima uang cash,
                                    sedangkan <span className="font-semibold">non tunai</span> berarti pelanggan membayar lewat transfer, QRIS, atau metode digital lain.
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                                    Penerima setoran: <span className="font-semibold">{settlementRecipientLabel}</span>
                                </div>
                                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                                    Hari ini: <span className="font-semibold">{summary?.today_cash_count ?? 0} tunai</span> • <span className="font-semibold">{summary?.today_non_cash_count ?? 0} non tunai</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-wrap gap-2">
                        {[
                            { value: "today", label: "Hari Ini" },
                            { value: "yesterday", label: "Kemarin" },
                            { value: "7d", label: "7 Hari" },
                            { value: "30d", label: "30 Hari" },
                            { value: "month", label: "Bulan Ini" },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => applyQuickRange(option.value)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    filterData.quick_range === option.value
                                        ? "bg-primary-600 text-white"
                                        : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <form onSubmit={quickSearch} className="flex flex-1 flex-col gap-3 sm:flex-row">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={filterData.q}
                                    onChange={(event) => handleChange("q", event.target.value)}
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="Cari invoice, customer, kasir, metode bayar..."
                                />
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                    <IconSearch size={18} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-600"
                                >
                                    Cari
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowFilters((value) => !value)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <IconFilter size={18} />
                                    Filter Lanjutan
                                </button>
                            </div>
                        </form>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-500 dark:text-slate-400">Rows:</label>
                            <select
                                value={filterData.per_page}
                                onChange={(event) => {
                                    const nextFilters = {
                                        ...filterData,
                                        per_page: event.target.value,
                                    };
                                    setFilterData(nextFilters);
                                    router.get(route("workspace-sales.index"), compactFilters(nextFilters), {
                                        preserveScroll: true,
                                        preserveState: false,
                                    });
                                }}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                {(meta?.per_page_options || [10, 15, 25, 50]).map((option) => (
                                    <option key={option} value={String(option)}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {showFilters ? (
                        <form onSubmit={applyFilters} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Mulai</label>
                                <input type="date" value={filterData.start_date} onChange={(e) => handleChange("start_date", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Akhir</label>
                                <input type="date" value={filterData.end_date} onChange={(e) => handleChange("end_date", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Rentang Cepat</label>
                                <select value={filterData.quick_range} onChange={(e) => handleChange("quick_range", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <option value="">Manual</option>
                                    <option value="today">Hari Ini</option>
                                    <option value="yesterday">Kemarin</option>
                                    <option value="7d">7 Hari</option>
                                    <option value="30d">30 Hari</option>
                                    <option value="month">Bulan Ini</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Metode Bayar</label>
                                <select value={filterData.payment_method} onChange={(e) => handleChange("payment_method", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <option value="">Semua</option>
                                    <option value="cash">Tunai</option>
                                    <option value="transfer">Transfer</option>
                                    <option value="qris">QRIS</option>
                                    <option value="debt">Bayar belakangan</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Status Bayar</label>
                                <select value={filterData.payment_status} onChange={(e) => handleChange("payment_status", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <option value="">Semua</option>
                                    <option value="paid">Lunas</option>
                                    <option value="pending">Pending</option>
                                    <option value="failed">Gagal</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Pesanan</label>
                                <select value={filterData.order_type} onChange={(e) => handleChange("order_type", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <option value="">Semua</option>
                                    <option value="dine_in">Makan di Tempat</option>
                                    <option value="takeaway">Bawa Pulang</option>
                                    <option value="delivery">Delivery</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Kasir</label>
                                <select value={filterData.cashier_id} onChange={(e) => handleChange("cashier_id", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <option value="">Semua kasir</option>
                                    {cashiers.map((cashier) => (
                                        <option key={cashier.id} value={String(cashier.id)}>
                                            {cashier.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <button type="submit" className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-600">Terapkan</button>
                                <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                                    <IconX size={16} />
                                    Reset
                                </button>
                            </div>
                        </form>
                    ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-3">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tren {primaryMetricLabel}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Pergerakan {primaryContextLabel} dan jumlah transaksi delivered.</p>
                        </div>
                        <div className="h-80">
                            {trend.length ? <canvas ref={salesChartRef} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data tren.</div>}
                        </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-3">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Metode Pembayaran</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Komposisi pembayaran pelanggan untuk transaksi tenant yang sudah selesai diantar.</p>
                        </div>
                        <div className="h-80">
                            {paymentBreakdown.length ? <canvas ref={paymentChartRef} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data pembayaran.</div>}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-3">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Jam Ramai Hari Ini</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Pola transaksi delivered per jam untuk tenant aktif.</p>
                        </div>
                        <div className="h-80">
                            {hourlyTrend.length ? <canvas ref={hourlyChartRef} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data penjualan hari ini.</div>}
                        </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconSparkles size={20} className="text-primary-500" />
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Produk Terlaris</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Produk tenant yang paling sering terjual dari transaksi yang sudah selesai diantar.</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {topProducts.length ? topProducts.map((product, index) => (
                                <div key={`${product.product_id}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">{product.product_title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{product.total_qty} item terjual</p>
                                    </div>
                                    <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(product.total_value)}</p>
                                </div>
                            )) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-800">
                                    Belum ada data produk terlaris untuk filter ini.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Daftar Transaksi</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Menampilkan {transactions?.from || 0}-{transactions?.to || 0} dari {transactions?.total || 0} transaksi.
                            </p>
                        </div>
                        {transactions?.last_page > 1 ? <Pagination links={paginationLinks} /> : null}
                    </div>

                    {rows.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                        <th className="px-4 py-3">Invoice</th>
                                        <th className="px-4 py-3">Waktu</th>
                                        <th className="px-4 py-3">Pelanggan</th>
                                        <th className="px-4 py-3">Kasir</th>
                                        <th className="px-4 py-3">Order</th>
                                        <th className="px-4 py-3">Bayar</th>
                                        <th className="px-4 py-3">Status</th>
                                        {isKitchenWorkspace ? <th className="px-4 py-3">Status Antar</th> : null}
                                        <th className="px-4 py-3 text-right">{isKitchenWorkspace ? "Penjualan Tenant" : "Total"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.invoice}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {(isKitchenWorkspace ? row.delivered_at : row.created_at)
                                                    ? new Date(isKitchenWorkspace ? row.delivered_at : row.created_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                                    : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.customer_name}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.cashier_name}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.order_type_label || row.order_type || "-"}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.payment_method_label || row.payment_method || "-"}</td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    {row.payment_status_label || row.payment_status || "-"}
                                                </span>
                                            </td>
                                            {isKitchenWorkspace ? (
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                        {row.service_status_label || "-"}
                                                    </span>
                                                </td>
                                            ) : null}
                                            <td className="px-4 py-3 text-right font-semibold text-primary-600 dark:text-primary-400">
                                                {formatCurrency(isKitchenWorkspace ? row.tenant_sale_total : row.display_total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
                                <IconDatabaseOff size={32} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">Belum ada transaksi</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Coba ubah filter pencarian atau rentang tanggal.
                            </p>
                        </div>
                    )}

                    {transactions?.last_page > 1 ? (
                        <div className="mt-4">
                            <Pagination links={paginationLinks} />
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );
}

WorkspaceSalesIndex.layout = (page) =>
    page.props?.auth?.user?.preferred_workspace === "kitchen" ? (
        <KitchenLayout children={page} />
    ) : (
        <DashboardLayout children={page} />
    );
