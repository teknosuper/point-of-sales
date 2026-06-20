import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import InputSelect from "@/Components/Dashboard/InputSelect";
import Button from "@/Components/Dashboard/Button";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    HourlyBreakdownChart,
    DailyBreakdownChart,
    TopProductsChart,
    CategoryBreakdownChart,
    PaymentMethodChart,
    SlowMovingProductsTable,
    DetailedProductsTable,
    ProductDetailModal,
} from "@/Components/Dashboard/Charts/SalesAnalyticsCharts";
import {
    IconChevronDown,
    IconChevronUp,
    IconCoin,
    IconDatabaseOff,
    IconDiscount2,
    IconBuildingStore,
    IconReceipt2,
    IconShoppingBag,
    IconTrendingUp,
    IconUsers,
    IconWallet,
    IconFilter,
    IconX,
    IconSearch,
    IconCalendar,
    IconCheck,
    IconClock,
    IconFileDownload,
    IconPrinter,
} from "@/Utils/icons";
import {
    resolveReportTimezone,
    shiftReportDateInput,
    subtractOneMonthFromReportDateInput,
    toTimeZoneDateInput,
} from "@/Utils/reportTimezone";

// Summary Card Component
const SummaryCard = ({ icon, title, value, description }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {React.cloneElement(icon, { size: 18 })}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            </div>
        </div>
    </div>
);

const defaultFilterState = {
    start_date: "",
    end_date: "",
    invoice: "",
    cashier_id: "",
    customer_id: "",
    tenant_outlet_id: "",
    settlement_status: "",
};

const WALK_IN_REPORT_OPTION = {
    id: "walk_in",
    name: "Transaksi Umum / Walk-in",
};

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const progressWidth = (value) =>
    `${Math.min(100, Math.max(0, Number(value || 0)))}%`;

const castFilterString = (value) =>
    typeof value === "number" ? String(value) : value ?? "";

const Sales = ({
    transactions,
    summary,
    targets,
    tenantSettlement,
    filters,
    cashiers,
    customers,
    tenantOutlets = [],
    workspace = {},
    analytics = {},
    reportMeta = {},
}) => {
    const isTenantWorkspace = Boolean(workspace?.is_tenant_workspace);
    const { timezone: reportTimezone, timezoneLabel: reportTimezoneLabel } =
        resolveReportTimezone(reportMeta);
    const [productDetailModal, setProductDetailModal] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilterState,
        start_date: castFilterString(filters?.start_date),
        end_date: castFilterString(filters?.end_date),
        invoice: castFilterString(filters?.invoice),
        cashier_id: castFilterString(filters?.cashier_id),
        customer_id: castFilterString(filters?.customer_id),
        tenant_outlet_id: castFilterString(filters?.tenant_outlet_id),
        settlement_status: castFilterString(filters?.settlement_status),
    });

    const cashierFromFilters = useMemo(
        () =>
            cashiers.find(
                (c) => castFilterString(c.id) === filterData.cashier_id
            ) ?? null,
        [cashiers, filterData.cashier_id]
    );

    const customerFromFilters = useMemo(
        () =>
            filterData.customer_id === "walk_in"
                ? WALK_IN_REPORT_OPTION
                : customers.find(
                      (c) => castFilterString(c.id) === filterData.customer_id
                  ) ?? null,
        [customers, filterData.customer_id]
    );

    const customerOptions = useMemo(
        () => [WALK_IN_REPORT_OPTION, ...customers],
        [customers]
    );

    const [selectedCashier, setSelectedCashier] = useState(cashierFromFilters);
    const [selectedCustomer, setSelectedCustomer] =
        useState(customerFromFilters);

    useEffect(
        () => setSelectedCashier(cashierFromFilters),
        [cashierFromFilters]
    );
    useEffect(
        () => setSelectedCustomer(customerFromFilters),
        [customerFromFilters]
    );
    useEffect(() => {
        setFilterData({
            ...defaultFilterState,
            start_date: castFilterString(filters?.start_date),
            end_date: castFilterString(filters?.end_date),
            invoice: castFilterString(filters?.invoice),
            cashier_id: castFilterString(filters?.cashier_id),
            customer_id: castFilterString(filters?.customer_id),
            tenant_outlet_id: castFilterString(filters?.tenant_outlet_id),
            settlement_status: castFilterString(filters?.settlement_status),
        });
    }, [filters]);

    const handleChange = (field, value) =>
        setFilterData((prev) => ({ ...prev, [field]: value }));
    const handleSelectCashier = (value) => {
        setSelectedCashier(value);
        handleChange("cashier_id", value ? String(value.id) : "");
    };
    const handleSelectCustomer = (value) => {
        setSelectedCustomer(value);
        handleChange("customer_id", value ? String(value.id) : "");
    };
    const exportQuery = new URLSearchParams(
        Object.entries(filterData).filter(([, value]) => value !== "")
    ).toString();

    const applyFilters = (e) => {
        e.preventDefault();
        router.get(route("reports.sales.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilterState);
        setSelectedCashier(null);
        setSelectedCustomer(null);
        router.get(route("reports.sales.index"), defaultFilterState, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const rows = transactions?.data ?? [];
    const paginationLinks = transactions?.links ?? [];
    const currentPage = transactions?.current_page ?? 1;
    const perPage = transactions?.per_page
        ? Number(transactions?.per_page)
        : rows.length || 1;

    const hasActiveFilters =
        filterData.invoice ||
        filterData.start_date ||
        filterData.end_date ||
        filterData.cashier_id ||
        filterData.customer_id ||
        filterData.tenant_outlet_id ||
        filterData.settlement_status;

    // Date presets
    const datePresets = [
        { label: 'Hari Ini', value: 'today' },
        { label: 'Kemarin', value: 'yesterday' },
        { label: '7 Hari Terakhir', value: '7days' },
        { label: '1 Bulan Terakhir', value: '1month' },
    ];

    const applyDatePreset = (preset) => {
        const today = new Date();
        const todayInReportTimezone = toTimeZoneDateInput(
            today,
            reportTimezone
        );
        let startDate = '';
        let endDate = todayInReportTimezone;

        switch (preset) {
            case 'today':
                startDate = endDate;
                break;
            case 'yesterday':
                startDate = shiftReportDateInput(todayInReportTimezone, -1);
                endDate = startDate;
                break;
            case '7days':
                startDate = shiftReportDateInput(todayInReportTimezone, -6);
                break;
            case '1month':
                startDate = subtractOneMonthFromReportDateInput(
                    todayInReportTimezone
                );
                break;
        }

        setFilterData((prev) => ({
            ...prev,
            start_date: startDate,
            end_date: endDate,
        }));
    };

    const safeSummary = {
        orders_count: summary?.orders_count ?? 0,
        revenue_total: summary?.revenue_total ?? 0,
        discount_total: summary?.discount_total ?? 0,
        tenant_discount_total: summary?.tenant_discount_total ?? 0,
        owner_discount_total: summary?.owner_discount_total ?? 0,
        items_sold: summary?.items_sold ?? 0,
        profit_total: summary?.profit_total ?? 0,
        average_order: summary?.average_order ?? 0,
        walk_in_count: summary?.walk_in_count ?? 0,
        registered_customer_count: summary?.registered_customer_count ?? 0,
    };
    const tenantSummary = {
        allocation_count: tenantSettlement?.summary?.allocation_count ?? 0,
        tenant_count: tenantSettlement?.summary?.tenant_count ?? 0,
        revenue_total: tenantSettlement?.summary?.revenue_total ?? 0,
        settled_total: tenantSettlement?.summary?.settled_total ?? 0,
        outstanding_total: tenantSettlement?.summary?.outstanding_total ?? 0,
        cost_total: tenantSettlement?.summary?.cost_total ?? 0,
        profit_total: tenantSettlement?.summary?.profit_total ?? 0,
        management_fee_total:
            tenantSettlement?.summary?.management_fee_total ?? 0,
        tenant_payout_total:
            tenantSettlement?.summary?.tenant_payout_total ?? 0,
        margin_percentage: tenantSettlement?.summary?.margin_percentage ?? 0,
    };
    const topTenants = tenantSettlement?.top_tenants ?? [];
    const dailyRecap = tenantSettlement?.daily_recap ?? [];

    const summaryCards = [
        {
            title: "Pendapatan Bersih",
            value: formatCurrency(safeSummary.revenue_total),
            description: "Total setelah diskon",
            icon: <IconReceipt2 />,
        },
        {
            title: "Total Profit",
            value: formatCurrency(safeSummary.profit_total),
            description: isTenantWorkspace
                ? `Selisih harga beli outlet vs HPP tenant`
                : `Rata-rata ${formatCurrency(safeSummary.average_order)}`,
            icon: <IconCoin />,
        },
        {
            title: "Item Terjual",
            value: safeSummary.items_sold.toLocaleString("id-ID"),
            description: `${safeSummary.orders_count} transaksi`,
            icon: <IconShoppingBag />,
        },
        {
            title: "Diskon Diberikan",
            value: formatCurrency(safeSummary.discount_total),
            description: isTenantWorkspace
                ? `Diskon tenant ${formatCurrency(safeSummary.tenant_discount_total)}`
                : `Tenant ${formatCurrency(safeSummary.tenant_discount_total)} • Owner ${formatCurrency(safeSummary.owner_discount_total)}`,
            icon: <IconDiscount2 />,
        },
        {
            title: "Transaksi Walk-in",
            value: safeSummary.walk_in_count.toLocaleString("id-ID"),
            description: `${safeSummary.orders_count > 0 ? ((safeSummary.walk_in_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
            icon: <IconUsers />,
        },
        {
            title: "Customer Terdaftar",
            value: safeSummary.registered_customer_count.toLocaleString("id-ID"),
            description: `${safeSummary.orders_count > 0 ? ((safeSummary.registered_customer_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
            icon: <IconWallet />,
        },
    ];

    return (
        <>
            <Head title="Laporan Penjualan" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Laporan Penjualan
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {isTenantWorkspace
                                ? "Cek omzet tenant, diskon tenant, HPP tenant, dan profit tenant aktif."
                                : "Cek hasil penjualan, target, dan settlement tenant."}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                                showFilters || hasActiveFilters
                                    ? "bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-950/50 dark:border-primary-800 dark:text-primary-400"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            }`}
                        >
                            <IconFilter size={18} />
                            <span>{showFilters ? "Sembunyikan filter" : "Buka filter"}</span>
                            {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                            )}
                        </button>
                        <a
                            href={`${route("reports.sales.tenant-settlement.export")}${exportQuery ? `?${exportQuery}` : ""}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                            <IconFileDownload size={18} />
                            Export Settlement CSV
                        </a>
                        <a
                            href={`${route("reports.sales.tenant-settlement.print")}${exportQuery ? `?${exportQuery}&autoprint=1` : "?autoprint=1"}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconPrinter size={18} />
                            Cetak Batch Settlement
                        </a>
                    </div>
                </div>

                {/* Filters Panel - Collapsible */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <IconCalendar size={20} className="text-slate-400" />
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Filter Laporan
                                    </h3>
                                    {hasActiveFilters && (
                                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-400">
                                            Aktif
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                    Semua tanggal dan waktu mengikuti {reportTimezone} ({reportTimezoneLabel}).
                                </p>
                            </div>
                            {/* Date Presets - Quick filters */}
                            <div className="flex items-center gap-2">
                                {datePresets.map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => applyDatePreset(preset.value)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <IconX size={14} />
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tanggal Mulai
                                    </label>
                                    <input
                                        type="date"
                                        value={filterData.start_date}
                                        onChange={(e) =>
                                            handleChange(
                                                "start_date",
                                                e.target.value
                                            )
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        Tanggal lokal {reportTimezoneLabel}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tanggal Akhir
                                    </label>
                                    <input
                                        type="date"
                                        value={filterData.end_date}
                                        onChange={(e) =>
                                            handleChange(
                                                "end_date",
                                                e.target.value
                                            )
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        Tanggal lokal {reportTimezoneLabel}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Invoice
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="TRX-..."
                                        value={filterData.invoice}
                                        onChange={(e) =>
                                            handleChange(
                                                "invoice",
                                                e.target.value
                                            )
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                </div>
                                <InputSelect
                                    label="Kasir"
                                    data={cashiers}
                                    selected={selectedCashier}
                                    setSelected={handleSelectCashier}
                                    placeholder="Semua kasir"
                                    searchable
                                />
                                <InputSelect
                                    label="Pelanggan"
                                    data={customerOptions}
                                    selected={selectedCustomer}
                                    setSelected={handleSelectCustomer}
                                    placeholder="Semua pelanggan / umum"
                                    searchable
                                />
                                {!isTenantWorkspace ? (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Tenant
                                        </label>
                                        <select
                                            value={filterData.tenant_outlet_id}
                                            onChange={(e) =>
                                                handleChange(
                                                    "tenant_outlet_id",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        >
                                            <option value="">Semua tenant</option>
                                            {tenantOutlets.map((tenant) => (
                                                <option
                                                    key={tenant.id}
                                                    value={tenant.id}
                                                >
                                                    {tenant.name}
                                                    {tenant.code
                                                        ? ` (${tenant.code})`
                                                        : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : null}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status Settlement
                                    </label>
                                    <select
                                        value={filterData.settlement_status}
                                        onChange={(e) =>
                                            handleChange(
                                                "settlement_status",
                                                e.target.value
                                            )
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua status</option>
                                        <option value="outstanding">
                                            Outstanding
                                        </option>
                                        <option value="settled">
                                            Settled
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
                                >
                                    <IconSearch size={18} />
                                    Terapkan Filter
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {summaryCards.map((card) => (
                        <SummaryCard key={card.title} {...card} />
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Pencapaian Target
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Membandingkan hasil periode aktif dengan target bulanan outlet.
                            </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {targets?.period_label || "Periode berjalan"}
                        </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Target Omzet
                                    </p>
                                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(targets?.sales_actual ?? 0)}
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        targets?.sales_met
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                    }`}
                                >
                                    {targets?.sales_target > 0
                                        ? `${targets?.sales_progress_percent ?? 0}%`
                                        : "Belum diatur"}
                                </span>
                            </div>
                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className="h-full rounded-full bg-primary-500"
                                    style={{
                                        width: progressWidth(
                                            targets?.sales_progress_percent
                                        ),
                                    }}
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Target {formatCurrency(targets?.sales_target ?? 0)}
                                </span>
                                <span
                                    className={`font-semibold ${
                                        Number(targets?.sales_gap ?? 0) >= 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-rose-600 dark:text-rose-400"
                                    }`}
                                >
                                    {Number(targets?.sales_gap ?? 0) >= 0
                                        ? "Lebih "
                                        : "Kurang "}
                                    {formatCurrency(
                                        Math.abs(Number(targets?.sales_gap ?? 0))
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Target Profit
                                    </p>
                                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(targets?.profit_actual ?? 0)}
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        targets?.profit_met
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                    }`}
                                >
                                    {targets?.profit_target > 0
                                        ? `${targets?.profit_progress_percent ?? 0}%`
                                        : "Belum diatur"}
                                </span>
                            </div>
                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{
                                        width: progressWidth(
                                            targets?.profit_progress_percent
                                        ),
                                    }}
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Target {formatCurrency(targets?.profit_target ?? 0)}
                                </span>
                                <span
                                    className={`font-semibold ${
                                        Number(targets?.profit_gap ?? 0) >= 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-rose-600 dark:text-rose-400"
                                    }`}
                                >
                                    {Number(targets?.profit_gap ?? 0) >= 0
                                        ? "Lebih "
                                        : "Kurang "}
                                    {formatCurrency(
                                        Math.abs(Number(targets?.profit_gap ?? 0))
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Settlement Tenant Foodcourt
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Rekap pendapatan tenant dari nota gabungan.
                                </p>
                            </div>
                            <div className="rounded-xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                                <IconBuildingStore size={20} />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Total Tenant
                                </p>
                                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                    {tenantSummary.tenant_count}
                                </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Allocation
                                </p>
                                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                    {tenantSummary.allocation_count}
                                </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Revenue Tenant
                                </p>
                                <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(tenantSummary.revenue_total)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                    Sudah Settled
                                </p>
                                <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                    {formatCurrency(tenantSummary.settled_total)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                    Outstanding
                                </p>
                                <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                                    {formatCurrency(
                                        tenantSummary.outstanding_total
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Cost Tenant
                                </p>
                                <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(tenantSummary.cost_total)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-cyan-50 p-4 dark:bg-cyan-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
                                    Profit Tenant
                                </p>
                                <p className="mt-2 text-base font-bold text-cyan-700 dark:text-cyan-300">
                                    {formatCurrency(
                                        tenantSummary.profit_total
                                    )}
                                </p>
                            </div>
                            <div className="rounded-xl bg-violet-50 p-4 dark:bg-violet-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                                    Margin Tenant
                                </p>
                                <p className="mt-2 text-base font-bold text-violet-700 dark:text-violet-300">
                                    {tenantSummary.margin_percentage}%
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-rose-50 p-4 dark:bg-rose-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                                    Management Fee
                                </p>
                                <p className="mt-2 text-base font-bold text-rose-700 dark:text-rose-300">
                                    {formatCurrency(
                                        tenantSummary.management_fee_total
                                    )}
                                </p>
                            </div>
                            <div className="rounded-xl bg-teal-50 p-4 dark:bg-teal-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                                    Net Payout Tenant
                                </p>
                                <p className="mt-2 text-base font-bold text-teal-700 dark:text-teal-300">
                                    {formatCurrency(
                                        tenantSummary.tenant_payout_total
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4">
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Top Tenant
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Tenant dengan omzet tertinggi pada filter aktif.
                            </p>
                        </div>

                        {topTenants.length > 0 ? (
                            <div className="space-y-3">
                                {topTenants.map((tenant, index) => (
                                    <div
                                        key={tenant.tenant_outlet_id}
                                        className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
                                    >
                                        <div>
                                            <Link
                                                href={route(
                                                    "reports.sales.tenant-statement",
                                                    tenant.tenant_outlet_id
                                                )}
                                                className="text-sm font-semibold text-slate-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-300"
                                            >
                                                {index + 1}.{" "}
                                                {tenant.tenant_outlet?.name ||
                                                    tenant.tenant_outlet?.code ||
                                                    `Tenant ${tenant.tenant_outlet_id}`}
                                            </Link>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {tenant.orders_count ?? 0} nota tenant
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Profit{" "}
                                                {formatCurrency(
                                                    tenant.profit_total ?? 0
                                                )}{" "}
                                                • Margin{" "}
                                                {tenant.margin_percentage ?? 0}%
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Fee{" "}
                                                {formatCurrency(
                                                    tenant.management_fee_total ??
                                                        0
                                                )}{" "}
                                                • Payout{" "}
                                                {formatCurrency(
                                                    tenant.tenant_payout_total ??
                                                        0
                                                )}
                                            </p>
                                        </div>
                                        <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                            {formatCurrency(
                                                tenant.revenue_total ?? 0
                                            )}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                                Belum ada data tenant pada filter ini.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                            Rekap Settlement Harian
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Ringkasan payout tenant per hari berdasarkan filter aktif.
                        </p>
                    </div>

                    {dailyRecap.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tanggal</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tenant</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Allocation</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Revenue</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Payout</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Settled</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Outstanding</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {dailyRecap.map((row) => (
                                        <tr key={row.date}>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{row.label}</td>
                                            <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">{row.tenant_count}</td>
                                            <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">{row.allocations_count}</td>
                                            <td className="px-4 py-3 text-right text-sm text-slate-900 dark:text-white">{formatCurrency(row.revenue_total)}</td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-teal-600 dark:text-teal-300">{formatCurrency(row.tenant_payout_total)}</td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(row.settled_payout_total)}</td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-amber-600 dark:text-amber-300">{formatCurrency(row.outstanding_payout_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                            Belum ada rekap settlement harian untuk filter ini.
                        </div>
                    )}
                </div>

                {/* Analytics Charts Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Grafik Analisis Penjualan
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Gambaran umum data penjualan untuk memahami pola dan tren bisnis
                            </p>
                        </div>
                    </div>

                    {/* Top Charts Row */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <DailyBreakdownChart data={analytics?.daily_breakdown || []} />
                        <HourlyBreakdownChart data={analytics?.hourly_breakdown || []} />
                    </div>

                    {/* Products and Category Row */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        <TopProductsChart data={analytics?.top_products || []} />
                        <CategoryBreakdownChart data={analytics?.category_breakdown || []} />
                        <PaymentMethodChart data={analytics?.payment_method_breakdown || []} />
                    </div>

                    {/* Detailed Products Table */}
                    <DetailedProductsTable 
                        data={analytics?.top_products || []} 
                        onProductClick={setProductDetailModal} 
                    />

                    {/* Slow Moving Products */}
                    <SlowMovingProductsTable data={analytics?.slow_moving_products || []} />
                </div>

                {/* Product Detail Modal */}
                <ProductDetailModal 
                    product={productDetailModal} 
                    onClose={() => setProductDetailModal(null)} 
                />

                {/* Table */}
                {/* Header */}
                {rows.length > 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            No
                                        </th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Invoice
                                        </th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Tanggal
                                        </th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Pelanggan
                                        </th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Kasir
                                        </th>
                                        <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Item
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Total
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                                            Profit
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {rows.map((trx, i) => (
                                        <React.Fragment key={trx.id}>
                                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {i +
                                                        1 +
                                                        (currentPage - 1) * perPage}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                                                    {trx.invoice}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {trx.created_at}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {trx.customer?.name ?? "Umum / Walk-in"}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {trx.cashier?.name ?? "-"}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-full">
                                                        {trx.total_items ?? 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">
                                                    <div>
                                                        {formatCurrency(
                                                            trx.grand_total ?? 0
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        Sebelum promo{" "}
                                                        {formatCurrency(
                                                            trx.pre_promo_subtotal ??
                                                                trx.grand_total ??
                                                                0
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        Diskon{" "}
                                                        {formatCurrency(
                                                            trx.tenant_discount_total ??
                                                                0
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-semibold text-success-600 dark:text-success-400">
                                                    <div>
                                                        {formatCurrency(
                                                            trx.total_profit ?? 0
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        Harga beli outlet{" "}
                                                        {formatCurrency(
                                                            trx.tenant_net_total ?? 0
                                                        )}
                                                    </div>
                                                    {isTenantWorkspace ? (
                                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            HPP tenant{" "}
                                                            {formatCurrency(
                                                                trx.base_cost_total ?? 0
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            Owner net{" "}
                                                            {formatCurrency(
                                                                trx.owner_net_total ?? 0
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {Array.isArray(trx.detail_items) && trx.detail_items.length > 0 ? (
                                                <tr className="bg-slate-50/70 dark:bg-slate-950/30">
                                                    <td colSpan={8} className="px-4 pb-4 pt-0">
                                                        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                Rincian Item
                                                            </div>
                                                            <div className="space-y-2">
                                                                {trx.detail_items.map((item) => (
                                                                    <div
                                                                        key={item.id}
                                                                        className="grid gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs dark:border-slate-800 md:grid-cols-[1.3fr,0.8fr,0.8fr,0.8fr]"
                                                                    >
                                                                        <div>
                                                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                                                {item.product_name}
                                                                            </div>
                                                                            <div className="text-slate-500 dark:text-slate-400">
                                                                                {item.qty} item
                                                                                {item.pricing_rule_name ? ` • ${item.pricing_rule_name}` : ""}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-slate-600 dark:text-slate-300">
                                                                            <div>Sblm promo {formatCurrency(item.pre_promo_total ?? item.line_total ?? 0)}</div>
                                                                            <div>Line total {formatCurrency(item.line_total ?? 0)}</div>
                                                                        </div>
                                                                        <div className="text-slate-600 dark:text-slate-300">
                                                                            <div>Diskon {formatCurrency(item.tenant_discount_total ?? 0)}</div>
                                                                            <div>Harga beli outlet {formatCurrency(item.tenant_net_total ?? 0)}</div>
                                                                        </div>
                                                                        <div className="text-slate-600 dark:text-slate-300">
                                                                            {isTenantWorkspace ? (
                                                                                <div>HPP tenant {formatCurrency(item.base_cost_total ?? 0)}</div>
                                                                            ) : (
                                                                                <>
                                                                                    <div>Owner cut {formatCurrency(item.owner_discount_total ?? 0)}</div>
                                                                                    <div>Owner net {formatCurrency(item.owner_net_total ?? 0)}</div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <IconDatabaseOff
                                size={32}
                                className="text-slate-400"
                            />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                            Tidak Ada Data
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Tidak ada transaksi sesuai filter.
                        </p>
                    </div>
                )}

                {paginationLinks.length > 3 && (
                    <Pagination links={paginationLinks} />
                )}

            </div>
        </>
    );
};

Sales.layout = (page) => <DashboardLayout children={page} />;

export default Sales;
