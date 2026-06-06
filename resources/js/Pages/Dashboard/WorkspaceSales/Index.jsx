import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import Modal from "@/Components/Dashboard/Modal";
import Pagination from "@/Components/Dashboard/Pagination";
import Chart from "chart.js/auto";
import {
    IconCalendar,
    IconChartBar,
    IconChartLine,
    IconDatabaseOff,
    IconFilter,
    IconChevronDown,
    IconChevronUp,
    IconInfoCircle,
    IconReceipt2,
    IconSearch,
    IconShoppingBag,
    IconSparkles,
    IconWallet,
    IconX,
} from "@/Utils/icons";

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
        emerald: "border-emerald-200 bg-white text-slate-900 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-white",
        blue: "border-blue-200 bg-white text-slate-900 dark:border-blue-900/40 dark:bg-slate-900 dark:text-white",
        violet: "border-violet-200 bg-white text-slate-900 dark:border-violet-900/40 dark:bg-slate-900 dark:text-white",
        amber: "border-amber-200 bg-white text-slate-900 dark:border-amber-900/40 dark:bg-slate-900 dark:text-white",
        slate: "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    };

    return (
        <div className={`rounded-3xl border p-5 ${tones[tone]}`}>
            <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-primary-600 dark:bg-slate-800 dark:text-primary-300">{icon}</div>
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
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
    productPerformance = {},
    tenantPromoBreakdown = [],
    promoTrend = [],
    cashiers = [],
    meta = {},
}) {
    const { auth } = usePage().props;
    const isKitchenWorkspace =
        meta?.metric_mode === "base_cost" || meta?.metric_mode === "tenant_sales" || auth?.user?.preferred_workspace === "kitchen";
    const primaryMetricLabel = isKitchenWorkspace ? "Penjualan Tenant" : "Penjualan";
    const primaryContextLabel = isKitchenWorkspace ? "penjualan murni tenant (tanpa markup owner)" : "penjualan operasional";
    const settlementRecipientLabel = meta?.settlement_recipient?.name || "Admin / owner belum diatur";
    const bestSeller = productPerformance?.best_sellers?.[0] ?? null;
    const unsoldHint = productPerformance?.unsold_products?.[0] ?? null;
    const slowMoverHint = productPerformance?.slow_movers?.[0] ?? null;
    const [showFilters, setShowFilters] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
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
    const promoChartRef = useRef(null);
    const promoChartInstanceRef = useRef(null);

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

    useEffect(() => {
        if (!promoChartRef.current) return;
        promoChartInstanceRef.current?.destroy();

        if (!promoTrend.length || isKitchenWorkspace) return;

        promoChartInstanceRef.current = new Chart(promoChartRef.current, {
            type: "line",
            data: {
                labels: promoTrend.map((item) => item.label),
                datasets: [
                    {
                        label: "Promo Tenant",
                        data: promoTrend.map((item) => item.promo_total),
                        borderColor: "#e11d48",
                        backgroundColor: "rgba(225,29,72,0.14)",
                        fill: true,
                        tension: 0.35,
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

        return () => promoChartInstanceRef.current?.destroy();
    }, [promoTrend, isKitchenWorkspace]);

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
                            Lihat ringkasan {primaryContextLabel} untuk {outletLabel}.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/40"
                        >
                            <IconInfoCircle size={16} />
                            Bantuan
                        </button>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Filter aktif: {activeFilterCount}
                        </div>
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

                {!isKitchenWorkspace ? (
                    <div className="grid gap-4 md:grid-cols-3">
                        <SummaryCard
                            icon={<IconSparkles size={20} />}
                            title="Promo Tenant"
                            value={formatCurrency(summary?.filtered_promo_total ?? 0)}
                            description="Akumulasi diskon tenant pada filter aktif"
                            tone="amber"
                        />
                        <SummaryCard
                            icon={<IconReceipt2 size={20} />}
                            title="Sebelum Promo"
                            value={formatCurrency(summary?.filtered_pre_discount_total ?? 0)}
                            description="Nilai transaksi sebelum promo tenant"
                            tone="slate"
                        />
                        <SummaryCard
                            icon={<IconWallet size={20} />}
                            title="Setelah Promo"
                            value={formatCurrency(summary?.filtered_total ?? 0)}
                            description="Omzet akhir yang masuk laporan admin"
                            tone="emerald"
                        />
                    </div>
                ) : null}

                {isKitchenWorkspace ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Insight Cepat</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Arah tindakan yang bisa langsung dipakai tenant dari data saat ini.</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Pertahankan</p>
                                <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                                    {bestSeller ? `${bestSeller.product_title} adalah pendorong utama omzet saat ini.` : "Belum ada best seller pada filter ini."}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">Evaluasi</p>
                                <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                                    {slowMoverHint ? `${slowMoverHint.product_title} masih terjual rendah. Pertimbangkan bundling atau ubah display.` : "Belum ada produk yang masuk kategori kurang laku."}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Perlu Aksi</p>
                                <p className="mt-2 text-sm font-medium text-rose-900 dark:text-rose-100">
                                    {unsoldHint ? `${unsoldHint.product_title} belum terjual. Cek harga, stok, atau aktifkan promo.` : "Tidak ada produk mati pada filter ini."}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {isKitchenWorkspace ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pusat Report Tenant</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Halaman ini dibuat ringan untuk ringkasan. Breakdown detail dibuka di halaman terpisah.</p>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <Link
                                href={meta?.detail_routes?.daily || "#"}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-primary-300 hover:bg-primary-50 dark:border-slate-800 dark:bg-slate-950/40"
                            >
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Breakdown Harian</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lihat berapa terjual per hari, transaksi, rata-rata order, dan tunai vs non tunai.</p>
                            </Link>
                            <Link
                                href={meta?.detail_routes?.hourly || "#"}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-primary-300 hover:bg-primary-50 dark:border-slate-800 dark:bg-slate-950/40"
                            >
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Breakdown Per Jam</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lihat tenant paling ramai jam berapa dan nilai penjualan di tiap slot waktu.</p>
                            </Link>
                            <Link
                                href={meta?.detail_routes?.products || "#"}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-primary-300 hover:bg-primary-50 dark:border-slate-800 dark:bg-slate-950/40"
                            >
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Breakdown Produk</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lihat best seller, kurang laku, tidak laku, dan kontribusi omzet per produk.</p>
                            </Link>
                        </div>
                    </div>
                ) : null}

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

                {isKitchenWorkspace ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            icon={<IconShoppingBag size={20} />}
                            title="Produk Aktif"
                            value={Number(productPerformance?.catalog_count ?? 0).toLocaleString("id-ID")}
                            description="Produk tenant yang terlihat di workspace ini"
                            tone="slate"
                        />
                        <SummaryCard
                            icon={<IconSparkles size={20} />}
                            title="Produk Laku"
                            value={Number(productPerformance?.sold_count ?? 0).toLocaleString("id-ID")}
                            description="Produk yang terjual pada filter aktif"
                            tone="emerald"
                        />
                        <SummaryCard
                            icon={<IconDatabaseOff size={20} />}
                            title="Tidak Laku"
                            value={Number(productPerformance?.unsold_count ?? 0).toLocaleString("id-ID")}
                            description="Produk yang belum terjual sama sekali"
                            tone="amber"
                        />
                        <SummaryCard
                            icon={<IconReceipt2 size={20} />}
                            title="Rata-rata Order"
                            value={formatCurrency(summary?.average_order_value ?? 0)}
                            description="Nilai rata-rata per transaksi tenant"
                            tone="violet"
                        />
                    </div>
                ) : null}

                {isKitchenWorkspace ? (
                    <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex items-center gap-2">
                                <IconSparkles size={20} className="text-emerald-500" />
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ringkasan Produk Tenant</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Mudah dibaca untuk melihat produk pendorong omzet dan produk yang perlu perhatian.</p>
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Best Seller</p>
                                    <p className="mt-2 text-base font-bold text-emerald-900 dark:text-emerald-100">
                                        {bestSeller?.product_title || "Belum ada"}
                                    </p>
                                    <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                                        {bestSeller
                                            ? `${bestSeller.sold_qty} item • ${formatCurrency(bestSeller.sold_value)}`
                                            : "Belum ada transaksi pada filter ini."}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">Produk Tidak Laku</p>
                                    <p className="mt-2 text-base font-bold text-amber-900 dark:text-amber-100">
                                        {Number(productPerformance?.unsold_count ?? 0).toLocaleString("id-ID")} produk
                                    </p>
                                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                                        Gunakan daftar di bawah untuk evaluasi menu, harga, atau stok.
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Produk Laku</p>
                                    <p className="mt-2 text-base font-bold text-blue-900 dark:text-blue-100">
                                        {Number(productPerformance?.sold_count ?? 0).toLocaleString("id-ID")} produk
                                    </p>
                                    <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                                        Dari total {Number(productPerformance?.catalog_count ?? 0).toLocaleString("id-ID")} produk aktif.
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">Rata-rata Order</p>
                                    <p className="mt-2 text-base font-bold text-violet-900 dark:text-violet-100">
                                        {formatCurrency(summary?.average_order_value ?? 0)}
                                    </p>
                                    <p className="mt-1 text-sm text-violet-800 dark:text-violet-200">
                                        Nilai rata-rata dari {summary?.filtered_orders_count ?? 0} transaksi pada filter aktif.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kontribusi Omzet Produk</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Produk mana yang paling besar menyumbang omzet tenant.</p>
                            </div>
                            <div className="space-y-3">
                                {(productPerformance?.revenue_mix ?? []).length ? (
                                    productPerformance.revenue_mix.map((product, index) => (
                                        <div key={`${product.product_id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">{product.product_title}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{product.sold_qty} item • {formatCurrency(product.sold_value)}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{product.share_percentage}%</p>
                                            </div>
                                            <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                                                <div
                                                    className="h-2 rounded-full bg-primary-500"
                                                    style={{ width: `${Math.min(100, Number(product.share_percentage || 0))}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-800">
                                        Belum ada kontribusi omzet karena belum ada transaksi pada filter ini.
                                    </div>
                                )}
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
                                    {showFilters ? "Sembunyikan filter" : "Buka filter"}
                                    {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
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

                {!isKitchenWorkspace ? (
                    <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-3">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tren Promo Tenant</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Nilai promo tenant per hari pada filter transaksi admin.</p>
                            </div>
                            <div className="h-80">
                                {promoTrend.length ? <canvas ref={promoChartRef} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data promo tenant.</div>}
                            </div>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex items-center gap-2">
                                <IconSparkles size={20} className="text-rose-500" />
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Breakdown Promo per Tenant</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Tenant dengan dampak promo terbesar pada periode aktif.</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {tenantPromoBreakdown.length ? tenantPromoBreakdown.map((tenant, index) => (
                                    <div key={`${tenant.tenant_outlet_id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{tenant.tenant_outlet?.name || tenant.tenant_outlet?.code || `Tenant ${tenant.tenant_outlet_id}`}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{tenant.orders_count} transaksi</p>
                                            </div>
                                            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(tenant.promo_total)}</p>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-400">
                                            <div className="flex justify-between gap-3">
                                                <span>Sebelum promo</span>
                                                <span>{formatCurrency(tenant.pre_promo_subtotal)}</span>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <span>Sesudah promo</span>
                                                <span>{formatCurrency(tenant.after_promo_total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-800">
                                        Belum ada promo tenant untuk filter ini.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

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

                {isKitchenWorkspace ? (
                    <div className="grid gap-4 xl:grid-cols-3">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex items-center gap-2">
                                <IconSparkles size={20} className="text-emerald-500" />
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Best Seller</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Produk paling laku pada periode aktif.</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(productPerformance?.best_sellers ?? []).length ? (
                                    productPerformance.best_sellers.map((product, index) => (
                                        <div key={`${product.product_id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">{product.product_title}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{product.sold_qty} item terjual</p>
                                                </div>
                                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(product.sold_value)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-800">
                                        Belum ada best seller karena belum ada transaksi.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex items-center gap-2">
                                <IconChartBar size={20} className="text-amber-500" />
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kurang Laku</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Masih terjual, tapi paling rendah performanya.</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(productPerformance?.slow_movers ?? []).length ? (
                                    productPerformance.slow_movers.map((product, index) => (
                                        <div key={`${product.product_id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">{product.product_title}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{product.sold_qty} item • {product.share_percentage}% omzet</p>
                                                </div>
                                                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(product.sold_value)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-800">
                                        Belum ada data produk kurang laku.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex items-center gap-2">
                                <IconDatabaseOff size={20} className="text-rose-500" />
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tidak Laku</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Produk aktif yang belum terjual sama sekali.</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(productPerformance?.unsold_products ?? []).length ? (
                                    productPerformance.unsold_products.map((product, index) => (
                                        <div key={`${product.product_id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-medium text-slate-900 dark:text-white">{product.product_title}</p>
                                                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                                    Belum terjual
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-800">
                                        Semua produk aktif sudah pernah terjual pada filter ini.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

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
                                        {!isKitchenWorkspace ? <th className="px-4 py-3 text-right">Sebelum Promo</th> : null}
                                        {!isKitchenWorkspace ? <th className="px-4 py-3 text-right">Promo</th> : null}
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
                                            {!isKitchenWorkspace ? (
                                                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                    {formatCurrency(row.pre_discount_total || row.display_total)}
                                                </td>
                                            ) : null}
                                            {!isKitchenWorkspace ? (
                                                <td className="px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-400">
                                                    {row.promo_total > 0 ? `- ${formatCurrency(row.promo_total)}` : formatCurrency(0)}
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

            <Modal
                show={showHelpModal}
                onClose={() => setShowHelpModal(false)}
                title="Bantuan Statistik Penjualan"
                maxWidth="2xl"
            >
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Fungsi Halaman Statistik Penjualan
                        </p>
                        <p className="mt-2">
                            Halaman ini menampilkan ringkasan penjualan tenant atau outlet Anda dalam bentuk dashboard visual. Data yang ditampilkan berasal dari transaksi yang sudah selesai (delivered/diantar).
                        </p>
                        <p className="mt-2">
                            Untuk outlet owner, halaman ini menampilkan penjualan operasional lengkap dengan profit kotor, promo tenant, dan komposisi pembayaran. Untuk tenant/dapur, fokus pada penjualan murni tenant tanpa markup owner.
                        </p>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Kartu Ringkasan
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Hari Ini</strong>: total penjualan dan jumlah transaksi hari ini.</li>
                            <li><strong>Kemarin</strong>: perbandingan dengan hari sebelumnya.</li>
                            <li><strong>Bulan Ini</strong>: akumulasi penjualan sepanjang bulan berjalan.</li>
                            <li><strong>Sesuai Filter</strong>: total yang sesuai dengan filter tanggal, metode bayar, dan status yang sedang aktif.</li>
                            <li>Untuk outlet owner: tambahan <strong>Promo Tenant</strong>, <strong>Sebelum Promo</strong>, dan <strong>Setelah Promo</strong>.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Grafik & Analisis
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Tren Penjualan</strong>: grafik garis pergerakan penjualan dari waktu ke waktu beserta jumlah transaksi.</li>
                            <li><strong>Metode Pembayaran</strong>: diagram batang komposisi pembayaran (tunai, transfer, QRIS, dll).</li>
                            <li><strong>Jam Ramai</strong>: pola transaksi per jam untuk mengetahui peak hour operasional.</li>
                            <li><strong>Produk Terlaris</strong>: daftar produk dengan penjualan tertinggi pada periode aktif.</li>
                            <li><strong>Tren Promo Tenant</strong> (outlet owner): nilai promo tenant per hari.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Insight Cepat (Tenant/Kitchen)
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Pertahankan</strong>: produk best seller yang jadi pendorong utama omzet.</li>
                            <li><strong>Evaluasi</strong>: produk yang masih terjual rendah, pertimbangkan bundling atau display.</li>
                            <li><strong>Perlu Aksi</strong>: produk yang belum terjual sama sekali, cek harga atau stok.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Cara Menggunakan Filter
                        </p>
                        <ol className="mt-2 list-decimal space-y-2 pl-5">
                            <li>Gunakan tombol <strong>Hari Ini / Kemarin / 7 Hari / 30 Hari / Bulan Ini</strong> untuk filter cepat.</li>
                            <li>Klik <strong>Buka filter</strong> untuk filter lanjutan: tanggal spesifik, metode bayar, status bayar, jenis pesanan, dan kasir.</li>
                            <li>Gunakan <strong>Rows</strong> untuk mengatur jumlah transaksi yang tampil per halaman.</li>
                            <li>Pencarian teks bisa mencari invoice, nama pelanggan, nama kasir, atau metode bayar.</li>
                        </ol>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Breakdown Report
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Breakdown Harian</strong>: lihat detail penjualan per hari, rata-rata order, dan tunai vs non tunai.</li>
                            <li><strong>Breakdown Per Jam</strong>: lihat jam paling ramai dan nilai penjualan di tiap slot waktu.</li>
                            <li><strong>Breakdown Produk</strong>: lihat best seller, kurang laku, tidak laku, dan kontribusi omzet per produk.</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Catatan Penting
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Data hanya menampilkan transaksi yang sudah <strong>selesai diantar/diambil</strong> pelanggan.</li>
                            <li>Untuk tenant, angka yang ditampilkan adalah <strong>penjualan murni tenant</strong> tanpa markup owner.</li>
                            <li>Pembayaran tunai = kasir menerima uang cash. Non tunai = transfer, QRIS, atau digital.</li>
                            <li>Profit kotor = selisih harga jual dan harga beli (hanya tampil di mode outlet owner).</li>
                            <li>Refresh halaman untuk mendapatkan data terbaru setelah transaksi baru selesai.</li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </>
    );
}

WorkspaceSalesIndex.layout = (page) =>
    page.props?.auth?.user?.preferred_workspace === "kitchen" ? (
        <KitchenLayout children={page} />
    ) : (
        <DashboardLayout children={page} />
    );
