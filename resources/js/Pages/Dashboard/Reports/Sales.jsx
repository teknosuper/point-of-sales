import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import InputSelect from "@/Components/Dashboard/InputSelect";
import Button from "@/Components/Dashboard/Button";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import {
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
} from "@tabler/icons-react";

// Summary Card Component
const SummaryCard = ({ icon, title, value, description, gradient }) => (
    <div
        className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg`}
    >
        <div className="absolute top-0 right-0 w-24 h-24 opacity-20">
            {React.cloneElement(icon, {
                size: 96,
                strokeWidth: 0.5,
                className: "transform translate-x-4 -translate-y-4",
            })}
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-white/20">
                    {React.cloneElement(icon, { size: 18 })}
                </div>
                <span className="text-sm font-medium opacity-90">{title}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm opacity-80 mt-1">{description}</p>
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

const castFilterString = (value) =>
    typeof value === "number" ? String(value) : value ?? "";

const defaultSettlementForm = {
    payout_reference: "",
    payout_notes: "",
    payout_paid_at: "",
    payout_cash_amount: "",
    payout_transfer_amount: "",
    payout_other_amount: "",
    payout_other_label: "",
    payout_recipient_name: "",
};

const Sales = ({
    transactions,
    summary,
    tenantSettlement,
    filters,
    cashiers,
    customers,
    tenantOutlets = [],
}) => {
    const [settlementModal, setSettlementModal] = useState({
        open: false,
        allocation: null,
    });
    const [settlementForm, setSettlementForm] = useState(defaultSettlementForm);
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

    const openSettlementModal = (allocation) => {
        setSettlementModal({
            open: true,
            allocation,
        });
        setSettlementForm({
            payout_reference: allocation.payout_reference ?? "",
            payout_notes: allocation.payout_notes ?? "",
            payout_paid_at: allocation.payout_paid_at
                ? new Date(allocation.payout_paid_at).toISOString().slice(0, 16)
                : "",
            payout_cash_amount: String(allocation.payout_cash_amount ?? 0),
            payout_transfer_amount: String(allocation.payout_transfer_amount ?? 0),
            payout_other_amount: String(allocation.payout_other_amount ?? 0),
            payout_other_label: allocation.payout_other_label ?? "",
            payout_recipient_name: allocation.payout_recipient_name ?? allocation.tenant_outlet?.name ?? "",
        });
    };

    const closeSettlementModal = () => {
        setSettlementModal({
            open: false,
            allocation: null,
        });
        setSettlementForm(defaultSettlementForm);
    };

    const settlementBreakdownTotal =
        Number(settlementForm.payout_cash_amount || 0) +
        Number(settlementForm.payout_transfer_amount || 0) +
        Number(settlementForm.payout_other_amount || 0);
    const settlementExpectedTotal = Number(
        settlementModal.allocation?.tenant_payout_total || 0
    );
    const settlementDifference =
        settlementBreakdownTotal - settlementExpectedTotal;

    const submitSettlement = (event) => {
        event.preventDefault();
        if (!settlementModal.allocation) return;

        router.patch(
            route(
                "reports.sales.tenant-allocations.settle",
                settlementModal.allocation.id
            ),
            settlementForm,
            {
                preserveScroll: true,
                onSuccess: () => closeSettlementModal(),
            }
        );
    };

    const printSettlementReceipt = (allocation) => {
        window.open(
            route("reports.sales.tenant-allocations.receipt", {
                allocation: allocation.id,
                autoprint: 1,
            }),
            "_blank",
            "noopener,noreferrer"
        );
    };

    const unsettleAllocation = (allocation) => {
        router.patch(
            route("reports.sales.tenant-allocations.unsettle", allocation.id),
            {},
            {
                preserveScroll: true,
            }
        );
    };

    const updateSettlementField = (field, value) => {
        setSettlementForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

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

    const safeSummary = {
        orders_count: summary?.orders_count ?? 0,
        revenue_total: summary?.revenue_total ?? 0,
        discount_total: summary?.discount_total ?? 0,
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
    const tenantAllocations = tenantSettlement?.allocations ?? [];
    const dailyRecap = tenantSettlement?.daily_recap ?? [];

    const summaryCards = [
        {
            title: "Pendapatan Bersih",
            value: formatCurrency(safeSummary.revenue_total),
            description: "Total setelah diskon",
            icon: <IconReceipt2 />,
            gradient: "from-primary-500 to-primary-700",
        },
        {
            title: "Total Profit",
            value: formatCurrency(safeSummary.profit_total),
            description: `Rata-rata ${formatCurrency(
                safeSummary.average_order
            )}`,
            icon: <IconCoin />,
            gradient: "from-success-500 to-success-700",
        },
        {
            title: "Item Terjual",
            value: safeSummary.items_sold.toLocaleString("id-ID"),
            description: `${safeSummary.orders_count} transaksi`,
            icon: <IconShoppingBag />,
            gradient: "from-accent-500 to-accent-700",
        },
        {
            title: "Diskon Diberikan",
            value: formatCurrency(safeSummary.discount_total),
            description: "Akumulasi promo",
            icon: <IconDiscount2 />,
            gradient: "from-warning-500 to-warning-600",
        },
        {
            title: "Transaksi Walk-in",
            value: safeSummary.walk_in_count.toLocaleString("id-ID"),
            description: `${safeSummary.orders_count > 0 ? ((safeSummary.walk_in_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
            icon: <IconUsers />,
            gradient: "from-slate-500 to-slate-700",
        },
        {
            title: "Customer Terdaftar",
            value: safeSummary.registered_customer_count.toLocaleString("id-ID"),
            description: `${safeSummary.orders_count > 0 ? ((safeSummary.registered_customer_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
            icon: <IconWallet />,
            gradient: "from-cyan-500 to-cyan-700",
        },
    ];

    return (
        <>
            <Head title="Laporan Penjualan" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconTrendingUp
                                size={28}
                                className="text-primary-500"
                            />
                            Laporan Penjualan
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Analisis dan ringkasan penjualan
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
                            <span>Filter</span>
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

                {/* Summary Cards */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                        <SummaryCard key={card.title} {...card} />
                    ))}
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

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 animate-slide-up">
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
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <IconX size={18} />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
                                >
                                    <IconSearch size={18} />
                                    Terapkan
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Table */}
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
                                        <tr
                                            key={trx.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
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
                                                {formatCurrency(
                                                    trx.grand_total ?? 0
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm font-semibold text-success-600 dark:text-success-400">
                                                {formatCurrency(
                                                    trx.total_profit ?? 0
                                                )}
                                            </td>
                                        </tr>
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

                {settlementModal.open ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
                        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        Validasi Settlement Tenant
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {settlementModal.allocation?.allocation_number} •{" "}
                                        {settlementModal.allocation?.tenant_outlet?.name ||
                                            settlementModal.allocation?.tenant_outlet?.code}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeSettlementModal}
                                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Tutup
                                </button>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Payout Tenant
                                    </p>
                                    <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(
                                            settlementModal.allocation?.tenant_payout_total ?? 0
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                                        Revenue Tenant
                                    </p>
                                    <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                                        {formatCurrency(
                                            settlementModal.allocation?.grand_total ?? 0
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                                        Management Fee
                                    </p>
                                    <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                        {formatCurrency(
                                            settlementModal.allocation?.management_fee_total ?? 0
                                        )}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={submitSettlement} className="mt-6 space-y-5">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Penerima uang
                                        </label>
                                        <input
                                            value={settlementForm.payout_recipient_name}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_recipient_name",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            placeholder="Nama tenant / PIC penerima"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Tanggal bayar
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={settlementForm.payout_paid_at}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_paid_at",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Cash
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={settlementForm.payout_cash_amount}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_cash_amount",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Transfer
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={settlementForm.payout_transfer_amount}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_transfer_amount",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Lainnya
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={settlementForm.payout_other_amount}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_other_amount",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Label metode lainnya
                                        </label>
                                        <input
                                            value={settlementForm.payout_other_label}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_other_label",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            placeholder="Contoh: E-wallet / Giro"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Referensi payout
                                        </label>
                                        <input
                                            value={settlementForm.payout_reference}
                                            onChange={(e) =>
                                                updateSettlementField(
                                                    "payout_reference",
                                                    e.target.value
                                                )
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            placeholder="Nomor transfer / referensi admin"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Catatan settlement
                                    </label>
                                    <textarea
                                        value={settlementForm.payout_notes}
                                        onChange={(e) =>
                                            updateSettlementField(
                                                "payout_notes",
                                                e.target.value
                                            )
                                        }
                                        rows={3}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        placeholder="Contoh: Pembayaran gabungan cash dan transfer sesuai permintaan tenant"
                                    />
                                </div>

                                <div
                                    className={`rounded-2xl border px-4 py-3 text-sm ${
                                        settlementDifference === 0
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                                    }`}
                                >
                                    Total metode bayar:{" "}
                                    <span className="font-semibold">
                                        {formatCurrency(settlementBreakdownTotal)}
                                    </span>
                                    {" • "}
                                    Target payout:{" "}
                                    <span className="font-semibold">
                                        {formatCurrency(settlementExpectedTotal)}
                                    </span>
                                    {settlementDifference !== 0 ? (
                                        <>
                                            {" • "}
                                            Selisih{" "}
                                            <span className="font-semibold">
                                                {formatCurrency(
                                                    Math.abs(settlementDifference)
                                                )}
                                            </span>
                                        </>
                                    ) : null}
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={closeSettlementModal}
                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={settlementDifference !== 0}
                                        className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Validasi & Simpan Settlement
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                            Detail Allocation Tenant
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Breakdown pendapatan per tenant untuk nota yang masuk filter.
                        </p>
                    </div>

                    {tenantAllocations.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Nota
                                        </th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Tenant
                                        </th>
                                        <th className="px-4 py-4 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Item
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Subtotal
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Discount
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Cost
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Profit
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Fee
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Payout
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Margin
                                        </th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Grand Total
                                        </th>
                                        <th className="px-4 py-4 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                            Settlement
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {tenantAllocations.map((allocation) => {
                                        const totalDiscount = Number(
                                            allocation.total_discount_total ?? 0
                                        );

                                        const isSettled = Boolean(
                                            allocation.settled_at
                                        );

                                        return (
                                            <tr
                                                key={allocation.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <td className="px-4 py-4">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {allocation.transaction
                                                            ?.invoice || "-"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {allocation.transaction
                                                            ?.created_at || "-"}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                                                    <Link
                                                        href={route(
                                                            "reports.sales.tenant-statement",
                                                            allocation.tenant_outlet_id
                                                        )}
                                                        className="font-medium hover:text-primary-600 dark:hover:text-primary-300"
                                                    >
                                                        {allocation.tenant_outlet
                                                            ?.name ||
                                                            allocation.tenant_outlet
                                                                ?.code ||
                                                            `Tenant ${allocation.tenant_outlet_id}`}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                                                        {allocation.total_items ??
                                                            0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(
                                                        allocation.subtotal ?? 0
                                                    )}
                                                    {Number(
                                                        allocation.pre_promo_subtotal ??
                                                            0
                                                    ) >
                                                    Number(
                                                        allocation.subtotal ?? 0
                                                    ) ? (
                                                        <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                                                            Sebelum promo{" "}
                                                            {formatCurrency(
                                                                allocation.pre_promo_subtotal ??
                                                                    0
                                                            )}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-rose-600 dark:text-rose-400">
                                                    -{" "}
                                                    {formatCurrency(
                                                        totalDiscount
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(
                                                        allocation.cost_total ??
                                                            0
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-cyan-600 dark:text-cyan-400">
                                                    {formatCurrency(
                                                        allocation.profit_total ??
                                                            0
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(
                                                        allocation.management_fee_total ??
                                                            0
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-teal-600 dark:text-teal-400">
                                                    {formatCurrency(
                                                        allocation.tenant_payout_total ??
                                                            0
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-medium text-violet-600 dark:text-violet-400">
                                                    {allocation.margin_percentage ??
                                                        0}
                                                    %
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-bold text-primary-600 dark:text-primary-400">
                                                    {formatCurrency(
                                                        allocation.grand_total ??
                                                            0
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                isSettled
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                            }`}
                                                        >
                                                            {isSettled ? (
                                                                <IconCheck
                                                                    size={12}
                                                                />
                                                            ) : (
                                                                <IconClock
                                                                    size={12}
                                                                />
                                                            )}
                                                            {isSettled
                                                                ? "Settled"
                                                                : "Outstanding"}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                isSettled
                                                                    ? unsettleAllocation(
                                                                          allocation
                                                                      )
                                                                    : openSettlementModal(
                                                                          allocation
                                                                      )
                                                            }
                                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                                isSettled
                                                                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                    : "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-950/60"
                                                            }`}
                                                        >
                                                            {isSettled
                                                                ? "Buka Lagi"
                                                                : "Validasi & Bayar"}
                                                        </button>
                                                        {isSettled ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    printSettlementReceipt(
                                                                        allocation
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                                                            >
                                                                <IconPrinter size={12} />
                                                                Cetak Bukti
                                                            </button>
                                                        ) : null}
                                                        {allocation.payout_reference ? (
                                                            <p className="max-w-[140px] text-center text-[11px] text-slate-500 dark:text-slate-400">
                                                                Ref: {allocation.payout_reference}
                                                            </p>
                                                        ) : null}
                                                        {allocation.validated_by ? (
                                                            <p className="max-w-[160px] text-center text-[11px] text-slate-500 dark:text-slate-400">
                                                                Validasi: {allocation.validated_by?.name || "-"}
                                                            </p>
                                                        ) : null}
                                                        {isSettled ? (
                                                            <p className="max-w-[160px] text-center text-[11px] text-slate-500 dark:text-slate-400">
                                                                Cash {formatCurrency(allocation.payout_cash_amount ?? 0)}
                                                                <br />
                                                                Transfer {formatCurrency(allocation.payout_transfer_amount ?? 0)}
                                                                {Number(allocation.payout_other_amount ?? 0) > 0 ? (
                                                                    <>
                                                                        <br />
                                                                        {(allocation.payout_other_label || "Lainnya")} {formatCurrency(allocation.payout_other_amount ?? 0)}
                                                                    </>
                                                                ) : null}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                            Belum ada allocation tenant pada filter ini.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

Sales.layout = (page) => <DashboardLayout children={page} />;

export default Sales;
