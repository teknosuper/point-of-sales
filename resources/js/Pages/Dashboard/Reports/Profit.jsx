import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, router } from "@inertiajs/react";
import axios from "axios";
import Chart from "chart.js/auto";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconChevronDown,
    IconChevronUp,
    IconDatabaseOff,
    IconFilter,
    IconSearch,
    IconX,
} from "@/Utils/icons";
import {
    resolveReportTimezone,
    shiftReportDateInput,
    subtractOneMonthFromReportDateInput,
    toTimeZoneDateInput,
} from "@/Utils/reportTimezone";

const defaultFilters = {
    start_date: "",
    end_date: "",
    invoice: "",
    cashier_id: "",
    customer_id: "",
    tenant_outlet_id: "",
    item_keyword: "",
    pricing_rule_kind: "",
};

const reportTabs = [
    { key: "overview", label: "Overview" },
    { key: "products", label: "Produk" },
    { key: "analysis", label: "Analisis" },
    { key: "transactions", label: "Transaksi" },
];

const WALK_IN_CUSTOMER_OPTION = {
    id: "walk_in",
    name: "Transaksi Tanpa Profil Customer",
};

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const formatNumber = (value = 0) =>
    new Intl.NumberFormat("id-ID").format(Number(value || 0));

const datePresets = (timeZone) => {
    const today = new Date();
    const todayInput = toTimeZoneDateInput(today, timeZone);

    return [
        {
            key: "today",
            label: "Hari Ini",
            start_date: todayInput,
            end_date: todayInput,
        },
        {
            key: "yesterday",
            label: "Kemarin",
            start_date: shiftReportDateInput(todayInput, -1),
            end_date: shiftReportDateInput(todayInput, -1),
        },
        {
            key: "last_7_days",
            label: "7 Hari",
            start_date: shiftReportDateInput(todayInput, -6),
            end_date: todayInput,
        },
        {
            key: "last_30_days",
            label: "1 Bulan",
            start_date: subtractOneMonthFromReportDateInput(todayInput),
            end_date: todayInput,
        },
    ];
};

const BreakdownPanel = ({ title, rows = [] }) => (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <div className="mt-4 space-y-3">
            {rows.map((row) => (
                <div key={row.label}>
                    <div className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0 break-words text-slate-600 dark:text-slate-300">
                            {row.label}
                        </span>
                        <span className="max-w-[45%] shrink-0 break-words text-right font-semibold text-slate-900 dark:text-white">
                            {row.value}
                        </span>
                    </div>
                    {row.progress !== undefined ? (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                                className={`h-full rounded-full ${row.progressClassName || "bg-primary-500"}`}
                                style={{ width: `${Math.max(0, Math.min(100, Number(row.progress || 0)))}%` }}
                            />
                        </div>
                    ) : null}
                    {row.note ? (
                        <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                            {row.note}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
    </div>
);

const SectionCard = ({ title, description, actions = null, children }) => (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">{actions}</div> : null}
        </div>
        {children}
    </div>
);

const StatementTable = ({ rows = [] }) => (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Keterangan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nilai
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Catatan
                    </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                    <tr key={row.label} className={row.emphasis ? "bg-slate-50/70 dark:bg-slate-800/30" : ""}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                            {row.label}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-semibold ${row.valueClassName || "text-slate-900 dark:text-white"}`}>
                            {row.value}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                            {row.note}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const TrendChartCard = ({ title, subtitle, chartRef, isEmpty = false }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {title}
            </h3>
            {subtitle ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {subtitle}
                </p>
            ) : null}
        </div>
        {isEmpty ? (
            <div className="flex h-72 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500 dark:bg-slate-950/30 dark:text-slate-400">
                Belum ada data tren.
            </div>
        ) : (
            <div className="h-72">
                <canvas ref={chartRef} />
            </div>
        )}
    </div>
);

const toneBadge = (value) =>
    value >= 25
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
        : value >= 10
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
        : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300";

const RemoteSelect = ({
    label,
    placeholder,
    type,
    selected,
    onSelect,
    allowWalkIn = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsLoading(true);

            try {
                const response = await axios.get(
                    route("reports.profits.filter-options"),
                    {
                        params: { type, q: query },
                        signal: controller.signal,
                    }
                );

                const items = Array.isArray(response.data?.data)
                    ? response.data.data
                    : [];

                setOptions(
                    allowWalkIn && type === "customer"
                        ? [WALK_IN_CUSTOMER_OPTION, ...items]
                        : items
                );
            } catch (error) {
                if (
                    axios.isCancel?.(error) ||
                    error?.name === "CanceledError"
                ) {
                    return;
                }

                setOptions(
                    allowWalkIn && type === "customer"
                        ? [WALK_IN_CUSTOMER_OPTION]
                        : []
                );
            } finally {
                setIsLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [allowWalkIn, isOpen, query, type]);

    return (
        <div ref={wrapperRef} className="relative">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
            </label>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
                <span className="truncate">
                    {selected?.name || placeholder}
                </span>
                <span className="text-xs text-slate-400">
                    {isOpen ? "Tutup" : "Pilih"}
                </span>
            </button>

            {isOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={`Cari ${label.toLowerCase()}...`}
                        className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <div className="max-h-64 overflow-y-auto pr-1">
                        {isLoading ? (
                            <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                Memuat...
                            </div>
                        ) : options.length > 0 ? (
                            <div className="space-y-1">
                                {options.map((option) => (
                                    <button
                                        key={`${type}-${option.id}`}
                                        type="button"
                                        onClick={() => {
                                            onSelect(option);
                                            setIsOpen(false);
                                        }}
                                        className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                            {option.name}
                                        </p>
                                        {option.subtitle ? (
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {option.subtitle}
                                            </p>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                Tidak ada hasil.
                            </div>
                        )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onSelect(null);
                                setIsOpen(false);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            Kosongkan
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProfitReport = ({
    transactions,
    itemBreakdown,
    summary,
    targets,
    cashierSummary = [],
    dailyProfitTrend = [],
    tenantBreakdown = [],
    ownerMarkupBreakdown = [],
    filters,
    cashiers = [],
    customers = [],
    pricingRuleKinds = [],
    tenantOutlets = [],
    workspace = {},
    activeTab = "overview",
    reportMeta = {},
}) => {
    const isTenantWorkspace = Boolean(workspace?.is_tenant_workspace);
    const { timezone: reportTimezone, timezoneLabel: reportTimezoneLabel } =
        resolveReportTimezone(reportMeta);
    const [showFilters, setShowFilters] = useState(true);
    const sanitizeFilters = (raw) =>
        Object.fromEntries(
            Object.entries({ ...defaultFilters, ...raw }).map(([key, value]) => [
                key,
                value ?? "",
            ])
        );

    const [filterData, setFilterData] = useState(() => sanitizeFilters(filters));
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedTenantOutlet, setSelectedTenantOutlet] = useState(null);
    const [activeDay, setActiveDay] = useState(null);
    const [activeTenantId, setActiveTenantId] = useState(null);
    const [activeTransactionDetail, setActiveTransactionDetail] = useState(null);
    const [activeTransactionRecord, setActiveTransactionRecord] = useState(null);
    const [isTransactionDetailLoading, setIsTransactionDetailLoading] = useState(false);
    const profitTrendChartRef = useRef(null);
    const profitTrendChartInstance = useRef(null);
    const compositionTrendChartRef = useRef(null);
    const compositionTrendChartInstance = useRef(null);
    const customerOptions = [WALK_IN_CUSTOMER_OPTION, ...customers];
    const quickDatePresets = useMemo(
        () => datePresets(reportTimezone),
        [reportTimezone]
    );

    useEffect(() => {
        setFilterData(sanitizeFilters(filters));
        setSelectedCashier(
            cashiers.find((item) => String(item.id) === String(filters.cashier_id)) ||
                null
        );
        setSelectedCustomer(
            String(filters.customer_id || "") === "walk_in"
                ? WALK_IN_CUSTOMER_OPTION
                : customerOptions.find(
                      (item) => String(item.id) === String(filters.customer_id)
                  ) || null
        );
        setSelectedTenantOutlet(
            tenantOutlets.find(
                (item) => String(item.id) === String(filters.tenant_outlet_id)
            ) || null
        );
    }, [filters, cashiers, customers, tenantOutlets]);

    useEffect(() => {
        if (!dailyProfitTrend.length) {
            setActiveDay(null);
            return;
        }

        setActiveDay((current) =>
            dailyProfitTrend.some((item) => item.day === current)
                ? current
                : dailyProfitTrend[dailyProfitTrend.length - 1]?.day ?? null
        );
    }, [dailyProfitTrend]);

    useEffect(() => {
        if (!tenantBreakdown.length) {
            setActiveTenantId(null);
            return;
        }

        setActiveTenantId((current) =>
            tenantBreakdown.some(
                (item) => Number(item.tenant_outlet_id) === Number(current)
            )
                ? current
                : tenantBreakdown[0]?.tenant_outlet_id ?? null
        );
    }, [tenantBreakdown]);

    const handleChange = (field, value) =>
        setFilterData((prev) => ({ ...prev, [field]: value }));

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("reports.profits.index"), { ...filterData, tab: activeTab }, {
            preserveState: true,
            preserveScroll: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        setSelectedCashier(null);
        setSelectedCustomer(null);
        setSelectedTenantOutlet(null);
        router.get(route("reports.profits.index"), { ...defaultFilters, tab: activeTab }, {
            replace: true,
            preserveScroll: true,
        });
    };

    const changeTab = (tab) => {
        router.get(
            route("reports.profits.index"),
            { ...filterData, tab },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const rows = transactions?.data ?? [];
    const links = transactions?.links ?? [];
    const currentPage = transactions?.current_page ?? 1;
    const perPage = transactions?.per_page
        ? Number(transactions?.per_page)
        : rows.length || 1;
    const itemRows = itemBreakdown?.data ?? [];
    const itemLinks = itemBreakdown?.links ?? [];
    const itemCurrentPage = itemBreakdown?.current_page ?? 1;
    const itemPerPage = itemBreakdown?.per_page
        ? Number(itemBreakdown?.per_page)
        : itemRows.length || 1;

    const hasActiveFilters =
        filterData.invoice ||
        filterData.start_date ||
        filterData.end_date ||
        filterData.cashier_id ||
        filterData.customer_id ||
        filterData.tenant_outlet_id ||
        filterData.item_keyword ||
        filterData.pricing_rule_kind;

    const exportItemQuery = new URLSearchParams(
        Object.entries(filterData).filter(([, value]) => value !== "")
    ).toString();

    const activeDaySummary = useMemo(
        () => dailyProfitTrend.find((item) => item.day === activeDay) || null,
        [dailyProfitTrend, activeDay]
    );

    const activeTenantSummary = useMemo(
        () =>
            tenantBreakdown.find(
                (item) => Number(item.tenant_outlet_id) === Number(activeTenantId)
            ) || null,
        [tenantBreakdown, activeTenantId]
    );

    const costBasisLabel = isTenantWorkspace
        ? "Harga Pokok Penjualan"
        : "Basis Harga Tenant / Modal Owner";
    const costBasisShortLabel = isTenantWorkspace
        ? "HPP"
        : "Basis Harga Tenant";
    const grossMarginLabel = isTenantWorkspace
        ? "Margin Tenant"
        : "Markup Owner";

    const statementRows = useMemo(() => {
        const tenantDiscountTotal = Number(summary?.tenant_discount_total ?? 0);
        const ownerDiscountTotal = Number(summary?.owner_discount_total ?? 0);
        const totalDiscount = tenantDiscountTotal + ownerDiscountTotal;
        const grossSales = Number(summary?.revenue_total ?? 0) + totalDiscount;

        const rows = [
            {
                label: "Penjualan Bruto",
                value: formatCurrency(grossSales),
                note: "Nilai penjualan sebelum seluruh promo dan diskon.",
            },
            {
                label: "Potongan Penjualan",
                value: formatCurrency(totalDiscount),
                note: "Akumulasi diskon tenant dan owner.",
                valueClassName: "text-rose-600 dark:text-rose-400",
            },
            {
                label: "Penjualan Bersih / Omzet",
                value: formatCurrency(summary?.revenue_total ?? 0),
                note: "Pendapatan setelah potongan penjualan.",
            },
            {
                label: costBasisLabel,
                value: formatCurrency(summary?.base_cost_total ?? 0),
                note: isTenantWorkspace
                    ? "Akumulasi HPP tenant dari item yang terjual."
                    : "Akumulasi dasar harga tenant atau modal owner setelah split pricing.",
            },
            {
                label: grossMarginLabel,
                value: formatCurrency(summary?.markup_total ?? 0),
                note: isTenantWorkspace
                    ? "Selisih harga jual tenant terhadap HPP tenant."
                    : "Selisih penjualan bersih terhadap basis harga tenant atau modal owner.",
            },
            {
                label: "Diskon Tenant",
                value: formatCurrency(tenantDiscountTotal),
                note: "Porsi diskon yang dibebankan ke sisi tenant.",
            },
        ];

        if (!isTenantWorkspace) {
            rows.push({
                label: "Markup Produk Owner",
                value: formatCurrency(summary?.owner_product_markup_total ?? 0),
                note: "Markup dari selisih harga produk tenant yang dijual owner.",
            });
            rows.push({
                label: "Markup Topping Owner",
                value: formatCurrency(summary?.owner_topping_markup_total ?? 0),
                note: "Markup dari topping/modifier tenant yang dijual owner.",
            });
            rows.push({
                label: "Diskon Owner",
                value: formatCurrency(ownerDiscountTotal),
                note: "Porsi diskon yang dibebankan ke sisi owner.",
            });
            rows.push({
                label: "Pendapatan Bersih Owner",
                value: formatCurrency(summary?.owner_direct_revenue_total ?? 0),
                note: "Penjualan langsung yang menjadi sisi owner.",
            });
            rows.push({
                label: "Pendapatan Bersih Tenant",
                value: formatCurrency(summary?.tenant_revenue_total ?? 0),
                note: "Penjualan setelah promo pada lini tenant.",
            });
            rows.push({
                label: "Payout Tenant Sudah Dibayar",
                value: formatCurrency(summary?.tenant_payout_approved_total ?? 0),
                note: `Setoran tenant yang sudah dibayar owner pada periode aktif. Saldo tenant ${formatCurrency(summary?.tenant_payout_balance_total ?? 0)}.`,
            });
            rows.push({
                label: "Outstanding ke Tenant",
                value: formatCurrency(summary?.tenant_payout_outstanding_total ?? 0),
                note: "Saldo tenant periode aktif dikurangi setoran yang sudah dibayar.",
            });
            rows.push({
                label: "Pengajuan Payout Tenant Pending",
                value: formatCurrency(summary?.tenant_payout_pending_approval_total ?? 0),
                note: "Pengajuan tenant yang belum disetujui owner.",
            });
        }

        rows.push({
            label: "Expense Operasional",
            value: formatCurrency(summary?.expense_total ?? 0),
            note: `Paid ${formatCurrency(summary?.expense_paid_total ?? 0)} • Unpaid ${formatCurrency(summary?.expense_unpaid_total ?? 0)}`,
            valueClassName: "text-rose-600 dark:text-rose-400",
        });

        rows.push({
            label: "Laba Bersih",
            value: formatCurrency(summary?.profit_total ?? 0),
            note: `${formatNumber(summary?.orders_count ?? 0)} transaksi • margin ${summary?.margin ?? 0}%`,
            emphasis: true,
            valueClassName: "text-emerald-600 dark:text-emerald-400",
        });
        if (!isTenantWorkspace) {
            rows.push({
                label: "Markup Owner Periode Aktif",
                value: formatCurrency(summary?.markup_total ?? 0),
                note: `Produk ${formatCurrency(summary?.owner_product_markup_total ?? 0)} • Topping ${formatCurrency(summary?.owner_topping_markup_total ?? 0)} • Direct owner ${formatCurrency(summary?.owner_direct_markup_total ?? 0)}`,
                valueClassName: "text-emerald-600 dark:text-emerald-400",
            });
        }
        rows.push({
            label: "Laba Setelah Expense",
            value: formatCurrency(summary?.profit_after_expense_total ?? 0),
            note: "Laba owner / tenant setelah dikurangi expense operasional.",
            emphasis: true,
            valueClassName: "text-blue-600 dark:text-blue-400",
        });

        if (!isTenantWorkspace) {
            rows.push({
                label: "Sisa Uang Setelah Pengeluaran Aktual",
                value: formatCurrency(summary?.remaining_cash_after_paid_total ?? 0),
                note: `Periode aktif: omzet ${formatCurrency(summary?.revenue_total ?? 0)} dikurangi payout tenant approved terbayar ${formatCurrency(summary?.tenant_payout_paid_period_total ?? 0)} dan expense paid ${formatCurrency(summary?.expense_paid_total ?? 0)}.`,
                emphasis: true,
                valueClassName: "text-violet-600 dark:text-violet-400",
            });
            rows.push({
                label: "Sisa Uang Aktual s/d Tanggal Akhir",
                value: formatCurrency(summary?.remaining_cash_after_paid_cumulative_total ?? 0),
                note: `Kumulatif s/d end date: omzet periode ${formatCurrency(summary?.revenue_total ?? 0)} dikurangi payout tenant approved s/d tanggal akhir ${formatCurrency(summary?.tenant_payout_paid_cumulative_total ?? 0)} dan expense paid s/d tanggal akhir ${formatCurrency(summary?.expense_paid_cumulative_total ?? 0)}.`,
                emphasis: true,
                valueClassName: "text-fuchsia-600 dark:text-fuchsia-400",
            });
            rows.push({
                label: "Sisa Uang Setelah Semua Kewajiban Disetujui",
                value: formatCurrency(summary?.remaining_cash_after_approved_total ?? 0),
                note: `Omzet periode ${formatCurrency(summary?.revenue_total ?? 0)} dikurangi saldo tenant kumulatif s/d tanggal akhir ${formatCurrency(summary?.tenant_payout_balance_total ?? 0)} dan seluruh expense periode aktif ${formatCurrency(summary?.expense_total ?? 0)}.`,
                emphasis: true,
                valueClassName: "text-amber-600 dark:text-amber-400",
            });
        }

        return rows;
    }, [costBasisLabel, grossMarginLabel, isTenantWorkspace, summary]);

    const supportingRows = useMemo(() => {
        return [
            {
                label: "Jumlah Transaksi",
                value: formatNumber(summary?.orders_count ?? 0),
                note: "Jumlah invoice pada filter aktif.",
            },
            {
                label: "Item Terjual",
                value: formatNumber(summary?.items_sold ?? 0),
                note: "Akumulasi kuantitas item terjual.",
            },
            {
                label: "Transaksi Tanpa Profil Customer",
                value: formatNumber(summary?.walk_in_count ?? 0),
                note:
                    Number(summary?.orders_count ?? 0) > 0
                        ? `${(
                              (Number(summary?.walk_in_count ?? 0) /
                                  Number(summary?.orders_count ?? 1)) *
                              100
                          ).toFixed(1)}% dari transaksi`
                        : "Belum ada transaksi",
            },
            {
                label: "Transaksi Dengan Profil Customer",
                value: formatNumber(summary?.registered_customer_count ?? 0),
                note:
                    Number(summary?.orders_count ?? 0) > 0
                        ? `${(
                              (Number(summary?.registered_customer_count ?? 0) /
                                  Number(summary?.orders_count ?? 1)) *
                              100
                          ).toFixed(1)}% dari transaksi`
                        : "Belum ada transaksi",
            },
            {
                label: "Expense Operasional",
                value: formatCurrency(summary?.expense_total ?? 0),
                note: `Paid ${formatCurrency(summary?.expense_paid_total ?? 0)} • Unpaid ${formatCurrency(summary?.expense_unpaid_total ?? 0)}`,
            },
            ...(!isTenantWorkspace
                ? [
                      {
                          label: "Saldo dan Payout Tenant",
                          value: formatCurrency(summary?.tenant_payout_balance_total ?? 0),
                          note: `Paid periode ${formatCurrency(summary?.tenant_payout_paid_period_total ?? 0)} • Paid kumulatif ${formatCurrency(summary?.tenant_payout_paid_cumulative_total ?? 0)} • Outstanding ${formatCurrency(summary?.tenant_payout_outstanding_total ?? 0)}`,
                      },
                  ]
                : []),
        ];
    }, [isTenantWorkspace, summary]);

    const ratioRows = useMemo(() => {
        const revenue = Number(summary?.revenue_total ?? 0);
        const cost = Number(summary?.base_cost_total ?? 0);
        const avgOrder = Number(summary?.orders_count ?? 0) > 0
            ? Math.round(revenue / Number(summary?.orders_count ?? 1))
            : 0;

        return [
            {
                label: "Gross Margin Ratio",
                value: `${Number(summary?.margin ?? 0)}%`,
                note: "Laba dibagi omzet bersih.",
            },
            {
                label: isTenantWorkspace
                    ? "Rasio HPP terhadap Penjualan"
                    : "Rasio Basis Harga Tenant terhadap Penjualan",
                value: revenue > 0 ? `${((cost / revenue) * 100).toFixed(2)}%` : "0%",
                note: isTenantWorkspace
                    ? "Persentase biaya pokok terhadap omzet."
                    : "Persentase dasar harga tenant/modal owner terhadap omzet.",
            },
            {
                label: "Rata-rata Laba per Invoice",
                value: formatCurrency(summary?.average_profit ?? 0),
                note: `Rata-rata omzet/order ${formatCurrency(avgOrder)}`,
            },
            {
                label: "Invoice Profit Tertinggi",
                value: summary?.best_invoice || "-",
                note: `Laba tertinggi ${formatCurrency(summary?.best_profit ?? 0)}`,
            },
        ];
    }, [isTenantWorkspace, summary]);

    const targetRows = useMemo(
        () => [
            {
                label: "Target Omzet",
                value: formatCurrency(targets?.sales_target ?? 0),
                note: `Aktual ${formatCurrency(targets?.sales_actual ?? 0)} • Progress ${
                    targets?.sales_progress_percent != null
                        ? `${targets.sales_progress_percent}%`
                        : "Belum diatur"
                }`,
            },
            {
                label: "Target Laba",
                value: formatCurrency(targets?.profit_target ?? 0),
                note: `Aktual ${formatCurrency(targets?.profit_actual ?? 0)} • Progress ${
                    targets?.profit_progress_percent != null
                        ? `${targets.profit_progress_percent}%`
                        : "Belum diatur"
                }`,
            },
        ],
        [targets]
    );

    const cashflowCards = useMemo(() => {
        if (isTenantWorkspace) {
            return [
                {
                    title: "Laba Kotor Tenant",
                    value: formatCurrency(summary?.profit_total ?? 0),
                    note: "Selisih omzet dan HPP tenant.",
                    tone: "emerald",
                },
                {
                    title: "Expense Operasional",
                    value: formatCurrency(summary?.expense_total ?? 0),
                    note: `Paid ${formatCurrency(summary?.expense_paid_total ?? 0)}`,
                    tone: "rose",
                },
                {
                    title: "Laba Setelah Expense",
                    value: formatCurrency(summary?.profit_after_expense_total ?? 0),
                    note: "Laba tenant setelah pengeluaran.",
                    tone: "blue",
                },
            ];
        }

        return [
            {
                title: "Markup Owner",
                value: formatCurrency(summary?.markup_total ?? 0),
                note: `Produk ${formatCurrency(summary?.owner_product_markup_total ?? 0)} • Topping ${formatCurrency(summary?.owner_topping_markup_total ?? 0)}`,
                tone: "emerald",
            },
            {
                title: "Outstanding ke Tenant",
                value: formatCurrency(summary?.tenant_payout_outstanding_total ?? 0),
                note: `Saldo tenant s/d end date ${formatCurrency(summary?.tenant_payout_balance_total ?? 0)} • Paid kumulatif ${formatCurrency(summary?.tenant_payout_paid_cumulative_total ?? 0)}`,
                tone: "amber",
            },
            {
                title: "Expense Operasional",
                value: formatCurrency(summary?.expense_total ?? 0),
                note: `Paid ${formatCurrency(summary?.expense_paid_total ?? 0)} • Unpaid ${formatCurrency(summary?.expense_unpaid_total ?? 0)}`,
                tone: "rose",
            },
            {
                title: "Sisa Uang Aktual",
                value: formatCurrency(summary?.remaining_cash_after_paid_total ?? 0),
                note: `Periode aktif: omzet dikurangi payout tenant approved terbayar ${formatCurrency(summary?.tenant_payout_paid_period_total ?? 0)} dan expense paid ${formatCurrency(summary?.expense_paid_total ?? 0)}.`,
                tone: "violet",
            },
            {
                title: "Kas Aktual s/d Tanggal Akhir",
                value: formatCurrency(summary?.remaining_cash_after_paid_cumulative_total ?? 0),
                note: `Kumulatif s/d end date: omzet periode dikurangi payout tenant approved s/d tanggal akhir dan expense paid s/d tanggal akhir.`,
                tone: "blue",
            },
        ];
    }, [isTenantWorkspace, summary]);

    useEffect(() => {
        if (profitTrendChartInstance.current) {
            profitTrendChartInstance.current.destroy();
        }

        if (!profitTrendChartRef.current || !dailyProfitTrend.length) {
            return;
        }

        const ctx = profitTrendChartRef.current.getContext("2d");
        profitTrendChartInstance.current = new Chart(ctx, {
            type: "line",
            data: {
                labels: dailyProfitTrend.map((item) => item.label),
                datasets: [
                    {
                        label: "Penjualan Bersih",
                        data: dailyProfitTrend.map((item) => item.revenue_total || 0),
                        borderColor: "rgba(59, 130, 246, 1)",
                        backgroundColor: "rgba(59, 130, 246, 0.12)",
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2,
                    },
                    {
                        label: "Laba",
                        data: dailyProfitTrend.map((item) => item.profit_total || 0),
                        borderColor: "rgba(16, 185, 129, 1)",
                        backgroundColor: "rgba(16, 185, 129, 0.12)",
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2,
                    },
                    {
                        label: costBasisLabel,
                        data: dailyProfitTrend.map((item) => item.base_cost_total || 0),
                        borderColor: "rgba(148, 163, 184, 1)",
                        backgroundColor: "rgba(148, 163, 184, 0.08)",
                        fill: false,
                        tension: 0.35,
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: "bottom",
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) =>
                                `${context.dataset.label}: ${formatCurrency(
                                    context.parsed.y
                                )}`,
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

        return () => profitTrendChartInstance.current?.destroy();
    }, [costBasisLabel, dailyProfitTrend]);

    useEffect(() => {
        if (compositionTrendChartInstance.current) {
            compositionTrendChartInstance.current.destroy();
        }

        if (!compositionTrendChartRef.current || !dailyProfitTrend.length) {
            return;
        }

        const ctx = compositionTrendChartRef.current.getContext("2d");
        compositionTrendChartInstance.current = new Chart(ctx, {
            type: "bar",
            data: {
                labels: dailyProfitTrend.map((item) => item.label),
                datasets: [
                    {
                        label: "Diskon",
                        data: dailyProfitTrend.map((item) => item.discount_total || 0),
                        backgroundColor: "rgba(244, 63, 94, 0.75)",
                        borderRadius: 8,
                    },
                    {
                        label: "Margin / Markup",
                        data: dailyProfitTrend.map((item) => item.markup_total || 0),
                        backgroundColor: "rgba(245, 158, 11, 0.75)",
                        borderRadius: 8,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: "bottom",
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) =>
                                `${context.dataset.label}: ${formatCurrency(
                                    context.parsed.y
                                )}`,
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

        return () => compositionTrendChartInstance.current?.destroy();
    }, [dailyProfitTrend]);

    const invoiceAuditSnapshot = useMemo(() => {
        return rows.reduce(
            (acc, trx) => {
                const prePromo = Number(
                    trx.pre_promo_subtotal ?? trx.grand_total ?? 0
                );
                const netSales = Number(trx.grand_total ?? 0);
                const tenantDiscount = Number(trx.tenant_discount_total ?? 0);
                const ownerDiscount = Number(trx.owner_discount_total ?? 0);

                acc.prePromoTotal += prePromo;
                acc.netSalesTotal += netSales;
                acc.discountTotal += tenantDiscount + ownerDiscount;
                acc.tenantNetTotal += Number(trx.tenant_net_total ?? 0);
                acc.ownerNetTotal += Number(trx.owner_net_total ?? 0);
                return acc;
            },
            {
                prePromoTotal: 0,
                netSalesTotal: 0,
                discountTotal: 0,
                tenantNetTotal: 0,
                ownerNetTotal: 0,
            }
        );
    }, [rows]);

    useEffect(() => {
        if (!activeTransactionDetail) {
            setActiveTransactionRecord(null);
            setIsTransactionDetailLoading(false);
            return;
        }

        const controller = new AbortController();
        setIsTransactionDetailLoading(true);

        axios
            .get(route("reports.profits.transactions.show", activeTransactionDetail), {
                signal: controller.signal,
            })
            .then((response) => {
                setActiveTransactionRecord(response.data?.data ?? null);
            })
            .catch((error) => {
                if (axios.isCancel?.(error) || error?.name === "CanceledError") {
                    return;
                }

                setActiveTransactionRecord(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setIsTransactionDetailLoading(false);
                }
            });

        return () => controller.abort();
    }, [activeTransactionDetail]);

    const reportRecapRows = useMemo(() => {
        const totalDiscount =
            Number(summary?.tenant_discount_total ?? 0) +
            Number(summary?.owner_discount_total ?? 0);
        const grossSales = Number(summary?.revenue_total ?? 0) + totalDiscount;
        const averageRevenue =
            Number(summary?.orders_count ?? 0) > 0
                ? Math.round(
                      Number(summary?.revenue_total ?? 0) /
                          Number(summary?.orders_count ?? 1)
                  )
                : 0;

        return [
            {
                label: "Jumlah Transaksi",
                value: formatNumber(summary?.orders_count ?? 0),
                note: "Jumlah invoice dalam periode/filter aktif.",
            },
            {
                label: "Jumlah Item Terjual",
                value: formatNumber(summary?.items_sold ?? 0),
                note: "Akumulasi kuantitas item yang terjual.",
            },
            {
                label: "Jumlah Penjualan Bruto",
                value: formatCurrency(grossSales),
                note: "Total penjualan sebelum promo dan diskon.",
            },
            {
                label: "Jumlah Potongan Penjualan",
                value: formatCurrency(totalDiscount),
                note: "Akumulasi seluruh diskon tenant dan owner.",
            },
            {
                label: "Jumlah Penjualan Bersih",
                value: formatCurrency(summary?.revenue_total ?? 0),
                note: "Nilai penjualan setelah seluruh diskon.",
            },
            {
                label: isTenantWorkspace
                    ? "Jumlah Biaya Pokok Penjualan"
                    : "Jumlah Basis Harga Tenant / Modal Owner",
                value: formatCurrency(summary?.base_cost_total ?? 0),
                note: isTenantWorkspace
                    ? "Akumulasi HPP dari item terjual."
                    : "Akumulasi dasar harga tenant atau modal owner dari item terjual.",
            },
            {
                label: "Jumlah Penghasilan / Laba Bersih",
                value: formatCurrency(summary?.profit_total ?? 0),
                note: "Selisih penjualan bersih dan biaya pokok.",
                valueClassName: "text-emerald-600 dark:text-emerald-400",
            },
            {
                label: "Jumlah Expense Operasional",
                value: formatCurrency(summary?.expense_total ?? 0),
                note: `Paid ${formatCurrency(summary?.expense_paid_total ?? 0)} • Unpaid ${formatCurrency(summary?.expense_unpaid_total ?? 0)}`,
                valueClassName: "text-rose-600 dark:text-rose-400",
            },
            ...(!isTenantWorkspace
                ? [
                      {
                          label: "Jumlah Saldo Tenant Periode",
                          value: formatCurrency(summary?.tenant_payout_balance_total ?? 0),
                          note: `Paid ${formatCurrency(summary?.tenant_payout_paid_total ?? 0)} • Outstanding ${formatCurrency(summary?.tenant_payout_outstanding_total ?? 0)} • Pending approval ${formatCurrency(summary?.tenant_payout_pending_approval_total ?? 0)}`,
                      },
                      {
                          label: "Jumlah Sisa Uang Setelah Pengeluaran Aktual",
                          value: formatCurrency(summary?.remaining_cash_after_paid_total ?? 0),
                          note: "Omzet dikurangi payout tenant paid dan expense paid.",
                          valueClassName: "text-violet-600 dark:text-violet-400",
                      },
                      {
                          label: "Jumlah Sisa Uang Setelah Semua Kewajiban Disetujui",
                          value: formatCurrency(summary?.remaining_cash_after_approved_total ?? 0),
                          note: "Omzet dikurangi seluruh saldo tenant periode aktif dan seluruh expense.",
                          valueClassName: "text-amber-600 dark:text-amber-400",
                      },
                  ]
                : []),
            {
                label: "Jumlah Laba Setelah Expense",
                value: formatCurrency(summary?.profit_after_expense_total ?? 0),
                note: "Laba bersih setelah dikurangi expense operasional.",
                valueClassName: "text-blue-600 dark:text-blue-400",
            },
            {
                label: "Rata-rata Penjualan per Invoice",
                value: formatCurrency(averageRevenue),
                note: `Rata-rata laba ${formatCurrency(summary?.average_profit ?? 0)} per invoice.`,
            },
            {
                label: "Invoice Profit Tertinggi",
                value: summary?.best_invoice || "-",
                note: `Penghasilan tertinggi ${formatCurrency(summary?.best_profit ?? 0)}.`,
            },
        ];
    }, [isTenantWorkspace, summary]);

    return (
        <>
            <Head title="Laporan Laba Rugi" />

            <div className="space-y-6">
                <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                Profit And Loss
                            </p>
                            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Laporan Laba Rugi
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {isTenantWorkspace
                                    ? "Disusun sebagai ringkasan laba rugi tenant aktif: penjualan bersih, biaya pokok, diskon, dan margin akhir."
                                    : "Disusun sebagai ringkasan laba rugi outlet: penjualan bersih, basis harga tenant/modal owner, diskon tenant-owner, dan margin owner."}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    Periode {targets?.period_label || "aktif"}
                                </span>
                                {workspace?.active_outlet?.name ? (
                                    <span className="max-w-full rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-left text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300">
                                        {workspace.active_outlet.code} - {workspace.active_outlet.name}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex w-full flex-wrap gap-3 xl:w-auto xl:justify-end">
                            <button
                                onClick={() => setShowFilters((current) => !current)}
                                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors sm:w-auto ${
                                    showFilters || hasActiveFilters
                                        ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300"
                                        : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                }`}
                            >
                                <IconFilter size={18} />
                                {showFilters ? "Sembunyikan filter" : "Buka filter"}
                                {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                {showFilters && (
                    <SectionCard
                        title="Filter Laporan Laba"
                        description={
                            isTenantWorkspace
                                ? "Gunakan rentang waktu, invoice, kasir, customer, atau item untuk menyempitkan analisis tenant aktif."
                                : "Gunakan rentang waktu, invoice, kasir, customer, atau tenant untuk menyempitkan analisis."
                        }
                    >
                        <form onSubmit={applyFilters} className="space-y-4">
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                Semua tanggal dan waktu mengikuti {reportTimezone} ({reportTimezoneLabel}).
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {quickDatePresets.map((preset) => (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                start_date: preset.start_date,
                                                end_date: preset.end_date,
                                            }))
                                        }
                                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                                <div>
                                    <input
                                        type="date"
                                        value={filterData.start_date}
                                        onChange={(event) =>
                                            handleChange("start_date", event.target.value)
                                        }
                                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        Tanggal lokal {reportTimezoneLabel}
                                    </p>
                                </div>
                                <div>
                                    <input
                                        type="date"
                                        value={filterData.end_date}
                                        onChange={(event) =>
                                            handleChange("end_date", event.target.value)
                                        }
                                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        Tanggal lokal {reportTimezoneLabel}
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={filterData.invoice}
                                    placeholder="Cari invoice"
                                    onChange={(event) =>
                                        handleChange("invoice", event.target.value)
                                    }
                                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <input
                                    type="text"
                                    value={filterData.item_keyword}
                                    placeholder="Cari item / invoice"
                                    onChange={(event) =>
                                        handleChange("item_keyword", event.target.value)
                                    }
                                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <select
                                    value={filterData.pricing_rule_kind}
                                    onChange={(event) =>
                                        handleChange("pricing_rule_kind", event.target.value)
                                    }
                                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Semua Jenis Promo</option>
                                    {pricingRuleKinds.map((kind) => (
                                        <option key={kind.id} value={kind.id}>
                                            {kind.name}
                                        </option>
                                    ))}
                                </select>
                                <RemoteSelect
                                    type="cashier"
                                    label="Kasir"
                                    selected={selectedCashier}
                                    onSelect={(value) => {
                                        setSelectedCashier(value);
                                        handleChange("cashier_id", value?.id ?? "");
                                    }}
                                    placeholder="Pilih kasir"
                                />
                                <RemoteSelect
                                    type="customer"
                                    label="Customer"
                                    selected={selectedCustomer}
                                    allowWalkIn
                                    onSelect={(value) => {
                                        setSelectedCustomer(value);
                                        handleChange("customer_id", value?.id ?? "");
                                    }}
                                    placeholder="Pilih customer"
                                />
                                {!isTenantWorkspace ? (
                                    <RemoteSelect
                                        type="tenant"
                                        label="Tenant"
                                        selected={selectedTenantOutlet}
                                        onSelect={(value) => {
                                            setSelectedTenantOutlet(value);
                                            handleChange("tenant_outlet_id", value?.id ?? "");
                                        }}
                                        placeholder="Pilih tenant"
                                    />
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
                                >
                                    <IconSearch size={18} />
                                    Terapkan
                                </button>
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <IconX size={18} />
                                    Reset
                                </button>
                            </div>
                        </form>
                    </SectionCard>
                )}

                <div className={`grid gap-4 ${isTenantWorkspace ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
                    {cashflowCards.map((card) => (
                        <div
                            key={card.title}
                            className={`min-w-0 overflow-hidden rounded-3xl border p-5 shadow-sm ${
                                card.tone === "emerald"
                                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                    : card.tone === "amber"
                                    ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                                    : card.tone === "rose"
                                    ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
                                    : card.tone === "violet"
                                    ? "border-violet-200 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20"
                                    : "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20"
                            }`}
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                {card.title}
                            </p>
                            <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {card.value}
                            </p>
                            <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">
                                {card.note}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2">
                    {reportTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => changeTab(tab.key)}
                            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                                activeTab === tab.key
                                    ? "border border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300"
                                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === "overview" && (
                <>
                <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
                    <SectionCard
                        title="Laporan Laba Rugi"
                        description={`Format utama laporan akuntansi: penjualan bruto, potongan penjualan, penjualan bersih, ${costBasisLabel.toLowerCase()}, lalu laba akhir.`}
                    >
                        <StatementTable rows={statementRows} />
                    </SectionCard>

                    <div className="space-y-6">
                        <BreakdownPanel
                            title="Data Pendukung Operasional"
                            rows={supportingRows}
                        />
                        <BreakdownPanel
                            title="Rasio Utama"
                            rows={ratioRows}
                        />
                        <BreakdownPanel
                            title="Target Periode"
                            rows={targetRows}
                        />
                    </div>
                </div>

                <SectionCard
                    title="Rekapitulasi Laporan"
                    description={`Ringkasan kuantitas, penjualan, ${costBasisLabel.toLowerCase()}, dan penghasilan untuk periode yang sedang dibaca.`}
                >
                    <StatementTable rows={reportRecapRows} />
                </SectionCard>

                <div className="grid gap-6 xl:grid-cols-2">
                    <TrendChartCard
                        title={`Tren Penjualan, ${costBasisShortLabel}, dan Laba`}
                        subtitle={
                            isTenantWorkspace
                                ? "Visual interval waktu untuk membaca arah penjualan bersih, HPP, dan keuntungan tenant."
                                : "Visual interval waktu untuk membaca arah penjualan bersih, basis harga tenant/modal owner, dan keuntungan owner."
                        }
                        chartRef={profitTrendChartRef}
                        isEmpty={dailyProfitTrend.length === 0}
                    />
                    <TrendChartCard
                        title="Tren Diskon dan Margin"
                        subtitle="Membantu membaca kapan potongan penjualan naik dan bagaimana pengaruhnya ke margin harian."
                        chartRef={compositionTrendChartRef}
                        isEmpty={dailyProfitTrend.length === 0}
                    />
                </div>
                </>
                )}

                {activeTab === "products" && (
                <SectionCard
                    title="Profitabilitas Produk"
                    description={`Membaca kontribusi laba per SKU: volume, omzet bersih, ${costBasisLabel.toLowerCase()}, ${grossMarginLabel.toLowerCase()}, dan pembebanan diskon.`}
                    actions={
                        <a
                            href={`${route("reports.profits.items.export")}${exportItemQuery ? `?${exportItemQuery}` : ""}`}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconSearch size={16} />
                            Ekspor CSV Item
                        </a>
                    }
                >
                    {itemRows.length > 0 ? (
                        <>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                <div className="text-slate-600 dark:text-slate-300">
                                    Menampilkan {formatNumber(itemRows.length)} baris item pada halaman {formatNumber(itemCurrentPage)}.
                                </div>
                                <div className="text-slate-500 dark:text-slate-400">
                                    Gunakan pagination untuk membaca rekap item lengkap.
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Produk
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                                                Transaksi
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                                                Kuantitas
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Omzet
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                {costBasisLabel}
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                {grossMarginLabel}
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Pembagian Diskon
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {itemRows.map((item, index) => (
                                            <tr key={`${item.product_id ?? "item"}-${index}`}>
                                                <td className="px-4 py-4">
                                                    <p className="font-semibold text-slate-900 dark:text-white">
                                                        {item.product_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {isTenantWorkspace
                                                            ? `Tenant ${item.tenant_outlet_name || workspace?.active_outlet?.name || "-"}`
                                                            : item.tenant_outlet_name
                                                            ? `Tenant ${item.tenant_outlet_name}`
                                                            : "Penjualan langsung owner"}{" "}
                                                        • Baris promo {formatNumber(item.promo_lines_count)}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                                                    {formatNumber(item.orders_count)}
                                                </td>
                                                <td className="px-4 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                                                    {formatNumber(item.qty_sold)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-900 dark:text-white">
                                                    {formatCurrency(item.revenue_total)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                    {formatCurrency(item.base_cost_total)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                    <div>{formatCurrency(item.gross_profit_total)}</div>
                                                    {!isTenantWorkspace ? (
                                                        <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                            Bersih owner {formatCurrency(item.owner_net_total)}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                    <div>Tenant {formatCurrency(item.tenant_discount_total)}</div>
                                                    {!isTenantWorkspace ? (
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Owner {formatCurrency(item.owner_discount_total)}
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4">
                                <Pagination links={itemLinks} />
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                            <IconDatabaseOff size={24} className="mx-auto mb-3 opacity-60" />
                            Tidak ada data item pada filter ini.
                        </div>
                    )}
                </SectionCard>
                )}

                {activeTab === "analysis" && (
                <>
                <div className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
                    <SectionCard
                        title="Ledger Harian"
                        description={
                            isTenantWorkspace
                                ? "Klik salah satu hari untuk membaca posisi penjualan bersih tenant, biaya pokok, diskon, dan laba pada tanggal tersebut."
                                : "Klik salah satu hari untuk membaca posisi penjualan bruto, penjualan bersih, basis harga tenant/modal owner, diskon, dan margin pada tanggal tersebut."
                        }
                    >
                        {dailyProfitTrend.length > 0 ? (
                            <div className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                    Hari
                                                </th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                                                    Transaksi
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                    Omzet
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                    Laba
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                    {grossMarginLabel}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {dailyProfitTrend.map((day) => (
                                                <tr
                                                    key={day.day}
                                                    onClick={() => setActiveDay(day.day)}
                                                    className={`cursor-pointer transition-colors ${
                                                        activeDay === day.day
                                                            ? "bg-primary-50 dark:bg-primary-950/20"
                                                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                    }`}
                                                >
                                                    <td className="px-4 py-4">
                                                        <p className="font-semibold text-slate-900 dark:text-white">
                                                            {day.label}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            Diskon {formatCurrency(day.discount_total)}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                                                        {formatNumber(day.orders_count)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-slate-900 dark:text-white">
                                                        {formatCurrency(day.revenue_total)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(day.profit_total)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                        {formatCurrency(day.markup_total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {activeDaySummary ? (
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Laba Hari Terpilih
                                            </p>
                                            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(activeDaySummary.profit_total)}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                {activeDaySummary.label}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                {isTenantWorkspace ? "Margin Tenant" : "Markup Penjualan Langsung Owner"}
                                            </p>
                                            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(
                                                    isTenantWorkspace
                                                        ? activeDaySummary.profit_total
                                                        : activeDaySummary.owner_direct_markup_total
                                                )}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                {isTenantWorkspace
                                                    ? `Biaya pokok ${formatCurrency(activeDaySummary.base_cost_total)}`
                                                    : `Pendapatan owner ${formatCurrency(activeDaySummary.owner_direct_revenue_total)}`}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Tenant Setelah Promo
                                            </p>
                                            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(activeDaySummary.tenant_after_promo_total)}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Diskon tenant {formatCurrency(activeDaySummary.tenant_discount_total)}
                                            </p>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                                Belum ada data laba harian untuk rentang filter ini.
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                    title={isTenantWorkspace ? "Profit Center Tenant Aktif" : "Profit Center Tenant"}
                        description={
                            isTenantWorkspace
                                ? "Ringkasan posisi bruto, net sales, biaya pokok, dan laba untuk tenant aktif."
                                : "Lihat tenant mana yang paling besar omzet bersih, basis harga tenant, dan markup owner-nya. Klik tenant untuk fokus ke ringkasan pusat laba tenant."
                        }
                    >
                        {tenantBreakdown.length > 0 ? (
                            <div className="space-y-3">
                                {tenantBreakdown.map((tenant) => (
                                    <button
                                        key={tenant.tenant_outlet_id}
                                        type="button"
                                        onClick={() =>
                                            setActiveTenantId(tenant.tenant_outlet_id)
                                        }
                                        className={`w-full rounded-2xl border p-4 text-left transition ${
                                            Number(activeTenantId) ===
                                            Number(tenant.tenant_outlet_id)
                                                ? "border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950/20"
                                                : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950/30"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {tenant.tenant_outlet?.name || `Tenant ${tenant.tenant_outlet_id}`}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {tenant.orders_count} transaksi • {tenant.items_sold} item
                                                </p>
                                            </div>
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs font-semibold ${toneBadge(
                                                    tenant.margin
                                                )}`}
                                            >
                                                Margin {tenant.margin}%
                                            </span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Omzet
                                                </p>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(tenant.after_promo_total)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Diskon
                                                </p>
                                                <p className="font-semibold text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(tenant.discount_total)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Laba
                                                </p>
                                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(tenant.profit_total)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {activeTenantSummary ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            {isTenantWorkspace ? "Fokus Tenant Aktif" : "Fokus Tenant"}
                                        </p>
                                        <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                            {activeTenantSummary.tenant_outlet?.name || `Tenant ${activeTenantSummary.tenant_outlet_id}`}
                                        </h3>
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Sebelum Promo
                                                </p>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(activeTenantSummary.pre_promo_subtotal)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Setelah Promo
                                                </p>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(activeTenantSummary.after_promo_total)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {costBasisLabel}
                                                </p>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(activeTenantSummary.cost_total)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Laba
                                                </p>
                                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(activeTenantSummary.profit_total)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                            Belum ada rincian tenant pada filter ini.
                            </div>
                        )}
                    </SectionCard>
                </div>

                {!isTenantWorkspace ? (
                <SectionCard
                    title="Kontribusi Margin Owner"
                    description="Menunjukkan sumber margin owner dari penjualan langsung owner dan markup atas item tenant yang ikut dijual di outlet aktif."
                    actions={
                        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950/30 dark:text-slate-400">
                            Markup total {formatCurrency(summary?.markup_total ?? 0)}
                        </div>
                    }
                >
                    {ownerMarkupBreakdown.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                            Sumber Markup
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                                            Item
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Pendapatan
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Basis Harga Tenant
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Markup
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Margin
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {ownerMarkupBreakdown.map((item) => (
                                        <tr key={`${item.kind}-${item.tenant_outlet_id ?? "owner"}`}>
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-white">
                                                        {item.label}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {item.kind === "owner_direct"
                                                            ? "Produk penjualan langsung owner"
                                                            : "Produk tenant di outlet ini"}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                                                {formatNumber(item.items_sold)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm text-slate-900 dark:text-white">
                                                {formatCurrency(item.revenue_total)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                {formatCurrency(item.base_cost_total)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm font-semibold text-amber-600 dark:text-amber-400">
                                                {formatCurrency(item.markup_total)}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${toneBadge(
                                                        item.margin
                                                    )}`}
                                                >
                                                    {item.margin}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                            Belum ada data markup owner pada filter ini.
                        </div>
                    )}
                </SectionCard>
                ) : null}

                {cashierSummary.length > 0 && (
                    <SectionCard
                        title="Produktivitas Kasir"
                        description="Membaca kontribusi kasir terhadap penjualan bersih, laba, dan komposisi transaksi tanpa profil customer versus transaksi dengan profil customer."
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                            Kasir
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                                            Transaksi
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                                            Tanpa Profil
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Omzet
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Laba
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                            Rata-rata Laba
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {cashierSummary.map((item) => (
                                        <tr key={item.cashier_id}>
                                            <td className="px-4 py-4">
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {item.cashier_name || "-"}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Porsi tanpa profil {item.walk_in_share}%
                                                </p>
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                                                {formatNumber(item.orders_count)}
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm text-slate-700 dark:text-slate-300">
                                                {formatNumber(item.walk_in_count)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm text-slate-900 dark:text-white">
                                                {formatCurrency(item.revenue_total)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(item.profit_total)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                {formatCurrency(item.average_profit)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </SectionCard>
                )}
                </>
                )}

                {activeTab === "transactions" && (
                <SectionCard
                    title="Audit Invoice Dan Ledger Item"
                    description={
                        isTenantWorkspace
                            ? "Digunakan untuk audit invoice tenant: penjualan bruto, diskon, penjualan bersih, biaya pokok, dan laba yang tercatat per invoice."
                            : "Digunakan untuk audit per invoice: penjualan bruto, pembagian diskon, penjualan bersih, dasar harga tenant/modal owner, alokasi tenant-owner, dan laba yang tercatat."
                    }
                >
                    {rows.length > 0 ? (
                        <>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                <div className="text-slate-600 dark:text-slate-300">
                                    Menampilkan {formatNumber(rows.length)} transaksi pada halaman {formatNumber(currentPage)}.
                                </div>
                                <div className="text-slate-500 dark:text-slate-400">
                                    Klik `Lihat Detail` untuk breakdown invoice lengkap per transaksi.
                                </div>
                            </div>
                            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Penjualan Bruto
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(invoiceAuditSnapshot.prePromoTotal)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Sebelum seluruh promo dan diskon.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Total Diskon
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
                                        {formatCurrency(invoiceAuditSnapshot.discountTotal)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Gabungan porsi tenant dan owner.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Penjualan Bersih
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(invoiceAuditSnapshot.netSalesTotal)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Nilai invoice setelah diskon.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Alokasi Bersih
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(
                                            isTenantWorkspace
                                                ? invoiceAuditSnapshot.tenantNetTotal
                                                : invoiceAuditSnapshot.ownerNetTotal + invoiceAuditSnapshot.tenantNetTotal
                                        )}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {isTenantWorkspace
                                            ? "Pendapatan bersih tenant pada invoice terfilter."
                                            : `Tenant ${formatCurrency(invoiceAuditSnapshot.tenantNetTotal)} • Owner ${formatCurrency(invoiceAuditSnapshot.ownerNetTotal)}`}
                                    </p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Invoice
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Kasir / Pelanggan
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Penjualan Bersih
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Diskon
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                {costBasisLabel}
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Laba
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Margin
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Detail
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {rows.map((trx, index) => (
                                            <tr
                                                key={trx.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            >
                                                <td className="px-4 py-4">
                                                    <p className="font-semibold text-slate-900 dark:text-white">
                                                        {trx.invoice}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        No {index + 1 + (currentPage - 1) * perPage} • {trx.created_at}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                        {trx.cashier?.name ?? "-"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {trx.customer?.name ?? "Umum / Walk-in"}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(trx.grand_total)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(
                                                        Number(trx.tenant_discount_total ?? 0) +
                                                            Number(trx.owner_discount_total ?? 0)
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                    {formatCurrency(trx.base_cost_total)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(trx.total_profit ?? 0)}
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                    {trx.grand_total > 0
                                                        ? `${(
                                                              (Number(trx.total_profit ?? 0) /
                                                                  Number(trx.grand_total ?? 1)) *
                                                              100
                                                          ).toFixed(2)}%`
                                                        : "0%"}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setActiveTransactionDetail(trx.id)
                                                        }
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        Lihat Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4">
                                <Pagination links={links} />
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                            <IconDatabaseOff size={24} className="mx-auto mb-3 opacity-60" />
                            Tidak ada transaksi laba untuk filter ini.
                        </div>
                    )}
                </SectionCard>
                )}

                {activeTransactionDetail ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                        <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                        Detail Invoice
                                    </p>
                                    {activeTransactionRecord ? (
                                        <>
                                            <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                                {activeTransactionRecord.invoice}
                                            </h3>
                                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                {activeTransactionRecord.created_at} • Kasir{" "}
                                                {activeTransactionRecord.cashier?.name ?? "-"} •{" "}
                                                {activeTransactionRecord.customer?.name ?? "Umum / Walk-in"}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                            Memuat detail invoice...
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTransactionDetail(null)}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    Tutup
                                </button>
                            </div>

                            {isTransactionDetailLoading || !activeTransactionRecord ? (
                                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                                    Memuat breakdown invoice...
                                </div>
                            ) : (
                            <>
                            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Penjualan Bruto
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(
                                            activeTransactionRecord.pre_promo_subtotal ??
                                                activeTransactionRecord.grand_total ??
                                                0
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Total Diskon
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
                                        {formatCurrency(
                                            Number(activeTransactionRecord.tenant_discount_total ?? 0) +
                                                Number(activeTransactionRecord.owner_discount_total ?? 0)
                                        )}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Tenant {formatCurrency(activeTransactionRecord.tenant_discount_total ?? 0)}
                                        {!isTenantWorkspace
                                            ? ` • Owner ${formatCurrency(activeTransactionRecord.owner_discount_total ?? 0)}`
                                            : ""}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Penjualan Bersih
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(activeTransactionRecord.grand_total)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Laba
                                    </p>
                                    <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(activeTransactionRecord.total_profit ?? 0)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Margin{" "}
                                        {activeTransactionRecord.grand_total > 0
                                            ? `${(
                                                  (Number(activeTransactionRecord.total_profit ?? 0) /
                                                      Number(activeTransactionRecord.grand_total ?? 1)) *
                                                  100
                                              ).toFixed(2)}%`
                                            : "0%"}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr,1fr]">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Breakdown Invoice
                                    </h4>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 dark:text-slate-400">Penjualan bruto</span>
                                            <span className="font-semibold text-slate-900 dark:text-white">
                                                {formatCurrency(
                                                    activeTransactionRecord.pre_promo_subtotal ??
                                                        activeTransactionRecord.grand_total ??
                                                        0
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 dark:text-slate-400">Diskon tenant</span>
                                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                {formatCurrency(activeTransactionRecord.tenant_discount_total ?? 0)}
                                            </span>
                                        </div>
                                        {!isTenantWorkspace ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-slate-500 dark:text-slate-400">Diskon owner</span>
                                                <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(activeTransactionRecord.owner_discount_total ?? 0)}
                                                </span>
                                            </div>
                                        ) : null}
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 dark:text-slate-400">Penjualan bersih</span>
                                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                {formatCurrency(activeTransactionRecord.grand_total ?? 0)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {isTenantWorkspace ? "Biaya pokok" : "Basis harga tenant / modal owner"}
                                            </span>
                                            <span className="font-semibold text-slate-900 dark:text-white">
                                                {formatCurrency(activeTransactionRecord.base_cost_total ?? 0)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 dark:text-slate-400">Tenant net</span>
                                            <span className="font-semibold text-violet-600 dark:text-violet-400">
                                                {formatCurrency(activeTransactionRecord.tenant_net_total ?? 0)}
                                            </span>
                                        </div>
                                        {!isTenantWorkspace ? (
                                            <>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-slate-500 dark:text-slate-400">Markup produk</span>
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                        {formatCurrency(activeTransactionRecord.owner_product_markup_total ?? 0)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-slate-500 dark:text-slate-400">Markup topping</span>
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                        {formatCurrency(activeTransactionRecord.owner_topping_markup_total ?? 0)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-slate-500 dark:text-slate-400">Owner net</span>
                                                    <span className="font-semibold text-violet-600 dark:text-violet-400">
                                                        {formatCurrency(activeTransactionRecord.owner_net_total ?? 0)}
                                                    </span>
                                                </div>
                                            </>
                                        ) : null}
                                        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-semibold text-slate-900 dark:text-white">Laba invoice</span>
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(activeTransactionRecord.total_profit ?? 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Ledger Item Invoice
                                    </h4>
                                    <div className="mt-4 space-y-3">
                                        {Array.isArray(activeTransactionRecord.detail_items) &&
                                        activeTransactionRecord.detail_items.length > 0 ? (
                                            activeTransactionRecord.detail_items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                                {item.product_name}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {item.qty} item
                                                                {item.pricing_rule_name
                                                                    ? ` • ${item.pricing_rule_name}`
                                                                    : ""}
                                                            </p>
                                                        </div>
                                                        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                                                            {isTenantWorkspace ? "HPP" : "Basis"} {formatCurrency(item.base_cost_total ?? 0)}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                        <div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Bruto</p>
                                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                                {formatCurrency(item.pre_promo_total ?? item.line_total ?? 0)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Net sales</p>
                                                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                                                                {formatCurrency(item.line_total ?? 0)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Diskon tenant</p>
                                                            <p className="font-semibold text-rose-600 dark:text-rose-400">
                                                                {formatCurrency(item.tenant_discount_total ?? 0)}
                                                            </p>
                                                        </div>
                                                        {!isTenantWorkspace ? (
                                                            <div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">Diskon owner</p>
                                                                <p className="font-semibold text-rose-600 dark:text-rose-400">
                                                                    {formatCurrency(item.owner_discount_total ?? 0)}
                                                                </p>
                                                            </div>
                                                        ) : null}
                                                        <div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Tenant net</p>
                                                            <p className="font-semibold text-violet-600 dark:text-violet-400">
                                                                {formatCurrency(item.tenant_net_total ?? 0)}
                                                            </p>
                                                        </div>
                                                        {!isTenantWorkspace ? (
                                                            <>
                                                                <div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Markup produk</p>
                                                                    <p className="font-semibold text-amber-600 dark:text-amber-400">
                                                                        {formatCurrency(item.owner_product_markup_total ?? 0)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Markup topping</p>
                                                                    <p className="font-semibold text-amber-600 dark:text-amber-400">
                                                                        {formatCurrency(item.owner_topping_markup_total ?? 0)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Owner net</p>
                                                                    <p className="font-semibold text-violet-600 dark:text-violet-400">
                                                                        {formatCurrency(item.owner_net_total ?? 0)}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        ) : null}
                                                        <div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Laba item</p>
                                                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {formatCurrency(
                                                                    Number(item.line_total ?? 0) -
                                                                        Number(item.base_cost_total ?? 0)
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                                                Tidak ada rincian item.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
};

ProfitReport.layout = (page) => <DashboardLayout children={page} />;

export default ProfitReport;
