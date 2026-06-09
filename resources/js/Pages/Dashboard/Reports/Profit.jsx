import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, router } from "@inertiajs/react";
import axios from "axios";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconChartBar,
    IconChevronDown,
    IconChevronUp,
    IconCoin,
    IconDatabaseOff,
    IconFilter,
    IconPercentage,
    IconReceipt,
    IconSearch,
    IconBuildingWarehouse,
    IconTrendingUp,
    IconUsers,
    IconX,
} from "@/Utils/icons";

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

const WALK_IN_CUSTOMER_OPTION = {
    id: "walk_in",
    name: "Transaksi Umum / Walk-in",
};

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const formatNumber = (value = 0) =>
    new Intl.NumberFormat("id-ID").format(Number(value || 0));

const toDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const datePresets = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 6);
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 29);

    return [
        {
            key: "today",
            label: "Hari Ini",
            start_date: toDateInput(today),
            end_date: toDateInput(today),
        },
        {
            key: "yesterday",
            label: "Kemarin",
            start_date: toDateInput(yesterday),
            end_date: toDateInput(yesterday),
        },
        {
            key: "last_7_days",
            label: "7 Hari",
            start_date: toDateInput(last7Days),
            end_date: toDateInput(today),
        },
        {
            key: "last_30_days",
            label: "1 Bulan",
            start_date: toDateInput(last30Days),
            end_date: toDateInput(today),
        },
    ];
};

const SummaryCard = ({ title, value, description, icon, tone = "slate" }) => {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {React.cloneElement(icon, { size: 18 })}
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </div>
        </div>
    );
};

const SectionCard = ({ title, description, actions = null, children }) => (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions}
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
}) => {
    const isTenantWorkspace = Boolean(workspace?.is_tenant_workspace);
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...filters,
    });
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedTenantOutlet, setSelectedTenantOutlet] = useState(null);
    const [activeDay, setActiveDay] = useState(null);
    const [activeTenantId, setActiveTenantId] = useState(null);
    const customerOptions = [WALK_IN_CUSTOMER_OPTION, ...customers];

    useEffect(() => {
        setFilterData({ ...defaultFilters, ...filters });
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
        router.get(route("reports.profits.index"), filterData, {
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
        router.get(route("reports.profits.index"), defaultFilters, {
            replace: true,
            preserveScroll: true,
        });
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
    const quickDatePresets = useMemo(() => datePresets(), []);

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

    const cards = [
        {
            title: "Laba Bersih",
            value: formatCurrency(summary?.profit_total ?? 0),
            description: "Akumulasi laba dari transaksi terfilter",
            icon: <IconCoin />,
            tone: "emerald",
        },
        {
            title: "Omzet",
            value: formatCurrency(summary?.revenue_total ?? 0),
            description: "Total penjualan setelah diskon",
            icon: <IconReceipt />,
            tone: "blue",
        },
        {
            title: isTenantWorkspace ? "HPP Tenant" : "Biaya Pokok",
            value: formatCurrency(summary?.base_cost_total ?? 0),
            description: isTenantWorkspace
                ? "Akumulasi HPP tenant"
                : "Akumulasi biaya pokok / harga dasar",
            icon: <IconBuildingWarehouse />,
            tone: "slate",
        },
        {
            title: isTenantWorkspace ? "Margin Tenant" : "Markup Owner",
            value: formatCurrency(summary?.markup_total ?? 0),
            description: isTenantWorkspace
                ? "Selisih harga beli outlet vs HPP tenant"
                : "Selisih omzet vs biaya dasar",
            icon: <IconTrendingUp />,
            tone: "amber",
        },
        {
            title: "Laba Tenant",
            value: formatCurrency(summary?.tenant_profit_total ?? 0),
            description: `Diskon tenant ${formatCurrency(summary?.tenant_discount_total ?? 0)}`,
            icon: <IconUsers />,
            tone: "violet",
        },
        {
            title: "Margin",
            value: `${summary?.margin ?? 0}%`,
            description: `${formatNumber(summary?.orders_count ?? 0)} transaksi • ${formatNumber(summary?.items_sold ?? 0)} item`,
            icon: <IconPercentage />,
            tone: "rose",
        },
    ];

    if (!isTenantWorkspace) {
        cards.splice(5, 0, {
            title: "Diskon Owner",
            value: formatCurrency(summary?.owner_discount_total ?? 0),
            description: "Bagian promo yang mengurangi sisi owner",
            icon: <IconPercentage />,
            tone: "rose",
        });
    }

    const statementRows = useMemo(() => {
        const rows = [
            {
                label: "Omzet / Pendapatan",
                value: formatCurrency(summary?.revenue_total ?? 0),
                note: "Total penjualan setelah diskon pada filter aktif.",
            },
            {
                label: isTenantWorkspace ? "Harga Pokok Penjualan" : "Biaya Pokok Penjualan",
                value: formatCurrency(summary?.base_cost_total ?? 0),
                note: isTenantWorkspace
                    ? "Akumulasi HPP tenant dari item yang terjual."
                    : "Akumulasi biaya dasar item yang terjual.",
            },
            {
                label: isTenantWorkspace ? "Margin Tenant" : "Margin Kotor",
                value: formatCurrency(summary?.markup_total ?? 0),
                note: isTenantWorkspace
                    ? "Selisih harga jual tenant terhadap HPP tenant."
                    : "Selisih omzet terhadap biaya pokok sebelum rincian pembagian lain.",
            },
            {
                label: "Diskon Tenant",
                value: formatCurrency(summary?.tenant_discount_total ?? 0),
                note: "Porsi diskon yang mengurangi sisi tenant.",
            },
        ];

        if (!isTenantWorkspace) {
            rows.push({
                label: "Diskon Owner",
                value: formatCurrency(summary?.owner_discount_total ?? 0),
                note: "Porsi diskon yang mengurangi sisi owner.",
            });
        }

        rows.push({
            label: "Laba Bersih",
            value: formatCurrency(summary?.profit_total ?? 0),
            note: `${formatNumber(summary?.orders_count ?? 0)} transaksi • margin ${summary?.margin ?? 0}%`,
            emphasis: true,
            valueClassName: "text-emerald-600 dark:text-emerald-400",
        });

        return rows;
    }, [isTenantWorkspace, summary]);

    return (
        <>
            <Head title="Laporan Laba" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Laporan Laba
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isTenantWorkspace
                                ? "Cek laba, omzet, biaya dasar, dan diskon untuk tenant aktif."
                                : "Cek laba, omzet, dan pembagian tenant-owner."}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowFilters((current) => !current)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
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

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map((card) => (
                        <SummaryCard key={card.title} {...card} />
                    ))}
                </div>

                <SectionCard
                    title="Ringkasan Laporan"
                    description="Disusun seperti ringkasan laporan akuntansi agar alur baca omzet, biaya, diskon, dan laba lebih jelas."
                >
                    <StatementTable rows={statementRows} />
                </SectionCard>

                <SectionCard
                    title="Pencapaian Target"
                    description={`Target bulanan untuk ${targets?.period_label || "periode ini"}.`}
                >
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
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    targets?.sales_met === true
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                }`}>
                                    {targets?.sales_progress_percent != null
                                        ? `${targets.sales_progress_percent}%`
                                        : "Belum diatur"}
                                </span>
                            </div>
                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className="h-full rounded-full bg-primary-500"
                                    style={{
                                        width: `${Math.min(100, Number(targets?.sales_progress_percent || 0))}%`,
                                    }}
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Target {formatCurrency(targets?.sales_target ?? 0)}
                                </span>
                                <span className={`font-semibold ${
                                    Number(targets?.sales_gap ?? 0) >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                }`}>
                                    {Number(targets?.sales_gap ?? 0) >= 0 ? "Lebih " : "Kurang "}
                                    {formatCurrency(Math.abs(Number(targets?.sales_gap ?? 0)))}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Target Laba
                                    </p>
                                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(targets?.profit_actual ?? 0)}
                                    </p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    targets?.profit_met === true
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                }`}>
                                    {targets?.profit_progress_percent != null
                                        ? `${targets.profit_progress_percent}%`
                                        : "Belum diatur"}
                                </span>
                            </div>
                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{
                                        width: `${Math.min(100, Number(targets?.profit_progress_percent || 0))}%`,
                                    }}
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Target {formatCurrency(targets?.profit_target ?? 0)}
                                </span>
                                <span className={`font-semibold ${
                                    Number(targets?.profit_gap ?? 0) >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                }`}>
                                    {Number(targets?.profit_gap ?? 0) >= 0 ? "Lebih " : "Kurang "}
                                    {formatCurrency(Math.abs(Number(targets?.profit_gap ?? 0)))}
                                </span>
                            </div>
                        </div>
                    </div>
                </SectionCard>

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
                                <input
                                    type="date"
                                    value={filterData.start_date}
                                    onChange={(event) =>
                                        handleChange("start_date", event.target.value)
                                    }
                                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <input
                                    type="date"
                                    value={filterData.end_date}
                                    onChange={(event) =>
                                        handleChange("end_date", event.target.value)
                                    }
                                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
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

                <SectionCard
                    title="Laporan Laba per Item"
                    description="Ringkasan laba per produk dengan filter lanjutan, pagination, dan ekspor CSV sesuai filter aktif."
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
                                                Biaya Pokok
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Laba Kotor
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

                <div className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
                    <SectionCard
                        title="Laba Harian"
                        description={
                            isTenantWorkspace
                                ? "Klik salah satu hari untuk melihat snapshot omzet tenant, biaya pokok, laba, dan diskon pada hari itu."
                                : "Klik salah satu hari untuk melihat snapshot omzet, biaya pokok, markup, tenant, dan diskon pada hari itu."
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
                                                    Markup
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
                    title={isTenantWorkspace ? "Ringkasan Tenant Aktif" : "Rincian Tenant"}
                        description={
                            isTenantWorkspace
                                ? "Ringkasan omzet, diskon, dan laba untuk tenant aktif."
                                : "Lihat tenant mana yang paling besar omzet, diskon, dan labanya. Klik tenant untuk fokus ke ringkasannya."
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
                                                    Biaya Pokok
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
                    title="Markup Owner Outlet"
                    description="Menunjukkan sumber markup owner berdasarkan item penjualan langsung owner dan item tenant yang ikut dijual di outlet aktif."
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
                                            Biaya Pokok
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
                        title="Ringkasan Laba per Kasir"
                        description="Melihat kontribusi kasir terhadap omzet, laba, dan komposisi walk-in vs customer terdaftar."
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
                                            Walk-in
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
                                                    Porsi walk-in {item.walk_in_share}%
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

                <SectionCard
                    title="Detail Transaksi Laba"
                    description={
                        isTenantWorkspace
                            ? "Digunakan untuk audit invoice tenant: omzet tenant, biaya pokok, diskon, dan laba yang tercatat."
                            : "Digunakan untuk audit per invoice: omzet, biaya pokok, markup owner, pendapatan tenant, dan laba yang tercatat."
                    }
                >
                    {rows.length > 0 ? (
                        <>
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
                                                Omzet
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Biaya Pokok
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Markup
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Pendapatan Tenant
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Laba
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {rows.map((trx, index) => (
                                            <React.Fragment key={trx.id}>
                                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
                                                    <td className="px-4 py-4 text-right text-sm text-slate-900 dark:text-white">
                                                        <div>{formatCurrency(trx.grand_total)}</div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Sebelum promo {formatCurrency(trx.pre_promo_subtotal ?? trx.grand_total ?? 0)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                        {formatCurrency(trx.base_cost_total)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm font-semibold text-amber-600 dark:text-amber-400">
                                                        {formatCurrency(trx.markup_total)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-violet-600 dark:text-violet-400">
                                                        <div>{formatCurrency(trx.tenant_revenue_total)}</div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Diskon {formatCurrency(trx.tenant_discount_total ?? 0)}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Net {formatCurrency(trx.tenant_net_total ?? 0)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                        <div>{formatCurrency(trx.total_profit ?? 0)}</div>
                                                        {!isTenantWorkspace ? (
                                                            <>
                                                                <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                                    Diskon owner {formatCurrency(trx.owner_discount_total ?? 0)}
                                                                </div>
                                                                <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                                    Bersih owner {formatCurrency(trx.owner_net_total ?? 0)}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                                Base cost {formatCurrency(trx.base_cost_total ?? 0)}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {Array.isArray(trx.detail_items) && trx.detail_items.length > 0 ? (
                                                    <tr className="bg-slate-50/70 dark:bg-slate-950/30">
                                                        <td colSpan={7} className="px-4 pb-4 pt-0">
                                                            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                    Rincian Item
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {trx.detail_items.map((item) => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="grid gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs dark:border-slate-800 md:grid-cols-[1.3fr,0.7fr,0.8fr,0.8fr]"
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
                                                                                <div>Tenant cut {formatCurrency(item.tenant_discount_total ?? 0)}</div>
                                                                                <div>Tenant net {formatCurrency(item.tenant_net_total ?? 0)}</div>
                                                                            </div>
                                                                            <div className="text-slate-600 dark:text-slate-300">
                                                                                {!isTenantWorkspace ? (
                                                                                    <div>Diskon owner {formatCurrency(item.owner_discount_total ?? 0)}</div>
                                                                                ) : null}
                                                                                <div>Base cost {formatCurrency(item.base_cost_total ?? 0)}</div>
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
            </div>
        </>
    );
};

ProfitReport.layout = (page) => <DashboardLayout children={page} />;

export default ProfitReport;
