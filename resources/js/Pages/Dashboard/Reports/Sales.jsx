import React, { useEffect, useMemo, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import SalesFiltersModal from "@/Components/Reports/SalesFiltersModal";
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

const ClosingStatementTable = ({ title, description, rows = [] }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
        <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px]">
                <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Pos Akuntansi</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Penjelasan</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Nominal</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((row) => row.section ? (
                        <tr key={row.label} className="bg-slate-50 dark:bg-slate-950/60">
                            <td colSpan={3} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {row.label}
                            </td>
                        </tr>
                    ) : (
                        <tr key={row.label}>
                            <td className={`px-3 py-3 text-sm ${row.emphasis ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                                {row.label}
                            </td>
                            <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                                {row.note}
                            </td>
                            <td className={`px-3 py-3 text-right text-sm ${
                                row.tone === "negative"
                                    ? "font-semibold text-rose-600 dark:text-rose-300"
                                    : row.tone === "positive"
                                      ? "font-semibold text-emerald-600 dark:text-emerald-300"
                                      : row.tone === "info"
                                        ? "font-semibold text-blue-700 dark:text-blue-300"
                                        : row.emphasis
                                          ? "font-semibold text-slate-900 dark:text-white"
                                          : "text-slate-700 dark:text-slate-300"
                            }`}>
                                {row.prefix === "-" ? "- " : ""}
                                {formatCurrency(Math.abs(Number(row.value ?? 0)))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
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
    mutation_q: "",
};

const WALK_IN_REPORT_OPTION = {
    id: "walk_in",
    name: "Transaksi Tanpa Profil Customer",
};

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const progressWidth = (value) =>
    `${Math.min(100, Math.max(0, Number(value || 0)))}%`;

const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

const roundToTwo = (value) => Math.round(Number(value || 0) * 100) / 100;

const castFilterString = (value) =>
    typeof value === "number" ? String(value) : value ?? "";

const Sales = ({
    transactions,
    summary,
    targets,
    filters,
    cashiers,
    customers,
    tenantOutlets = [],
    workspace = {},
    analytics = {},
    ownerToppingBreakdown = [],
    tenantSettlement = {},
    activeTab = "overview",
    settlementView = "withdraw",
    reportMeta = {},
}) => {
    const page = usePage();
    const auth = page.props?.auth ?? {};
    const isTenantWorkspace = Boolean(workspace?.is_tenant_workspace);
    const activeOutletType = workspace?.active_outlet?.outlet_type ?? "main";
    const isOwnerTenantView = !isTenantWorkspace && activeOutletType === "tenant";
    const { timezone: reportTimezone, timezoneLabel: reportTimezoneLabel } =
        resolveReportTimezone(reportMeta);
    const [productDetailModal, setProductDetailModal] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [showTargetBreakdownModal, setShowTargetBreakdownModal] =
        useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilterState,
        start_date: castFilterString(filters?.start_date),
        end_date: castFilterString(filters?.end_date),
        invoice: castFilterString(filters?.invoice),
        cashier_id: castFilterString(filters?.cashier_id),
        customer_id: castFilterString(filters?.customer_id),
        tenant_outlet_id: castFilterString(filters?.tenant_outlet_id),
        settlement_status: castFilterString(filters?.settlement_status),
        mutation_q: castFilterString(filters?.mutation_q),
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
            mutation_q: castFilterString(filters?.mutation_q),
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
    const buildQueryPayload = (overrides = {}) => ({
        ...filterData,
        tab: activeTab,
        settlement_view: activeTab === "settlement" ? settlementView : undefined,
        ...overrides,
    });

    const applyFilters = (e) => {
        e.preventDefault();
        router.get(route("reports.sales.index"), buildQueryPayload({
            transactions_page: 1,
            settlement_page: 1,
            settlement_requests_page: 1,
            mutations_page: 1,
            mutation_detail_page: 1,
            mutation_day: "",
            owner_markup_month_page: 1,
            owner_markup_day_page: 1,
            owner_markup_detail_page: 1,
            owner_markup_month: "",
            owner_markup_day: "",
            closing_month_page: 1,
            closing_day_page: 1,
            closing_month: "",
            closing_day: "",
            closing_detail_page: 1,
        }), {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilterState);
        setSelectedCashier(null);
        setSelectedCustomer(null);
        router.get(
            route("reports.sales.index"),
            {
                ...defaultFilterState,
                tab: activeTab,
                transactions_page: 1,
                settlement_page: 1,
                settlement_requests_page: 1,
                mutations_page: 1,
                mutation_detail_page: 1,
                mutation_day: "",
                owner_markup_month_page: 1,
                owner_markup_day_page: 1,
                owner_markup_detail_page: 1,
                owner_markup_month: "",
                owner_markup_day: "",
                closing_month_page: 1,
                closing_day_page: 1,
                closing_month: "",
                closing_day: "",
                closing_detail_page: 1,
            },
            {
            preserveScroll: true,
            preserveState: true,
            replace: true,
            }
        );
    };

    const handleTabChange = (tab) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            tab,
            transactions_page: 1,
            settlement_page: 1,
            settlement_requests_page: 1,
            mutations_page: 1,
            mutation_detail_page: 1,
            mutation_day: "",
            owner_markup_month_page: 1,
            owner_markup_day_page: 1,
            owner_markup_detail_page: 1,
            owner_markup_month: "",
            owner_markup_day: "",
            closing_month_page: 1,
            closing_day_page: 1,
            closing_month: "",
            closing_day: "",
            closing_detail_page: 1,
        }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleSettlementViewChange = (view) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            settlement_view: view,
            settlement_requests_page: 1,
            mutations_page: 1,
            mutation_detail_page: 1,
            mutation_day: "",
            owner_markup_month_page: 1,
            owner_markup_day_page: 1,
            owner_markup_detail_page: 1,
            owner_markup_month: "",
            owner_markup_day: "",
            closing_month_page: 1,
            closing_day_page: 1,
            closing_month: "",
            closing_day: "",
            closing_detail_page: 1,
        }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleSelectMutationDay = (dateKey) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            mutations_page: mutationDayCurrentPage,
            mutation_day: dateKey,
            mutation_detail_page: 1,
        }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleSelectOwnerMarkupMonth = (monthKey) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            owner_markup_month_page: ownerMarkupMonthCurrentPage,
            owner_markup_month: monthKey,
            owner_markup_day_page: 1,
            owner_markup_detail_page: 1,
            owner_markup_day: "",
        }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleSelectOwnerMarkupDay = (dateKey) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            owner_markup_month_page: ownerMarkupMonthCurrentPage,
            owner_markup_month: ownerMarkupSelectedMonth,
            owner_markup_day_page: ownerMarkupDayCurrentPage,
            owner_markup_day: dateKey,
            owner_markup_detail_page: 1,
        }), {
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
    const settlementRows = tenantSettlement?.allocations?.data ?? [];
    const settlementPaginationLinks = tenantSettlement?.allocations?.links ?? [];
    const settlementCurrentPage =
        tenantSettlement?.allocations?.current_page ?? 1;
    const settlementPerPage = tenantSettlement?.allocations?.per_page
        ? Number(tenantSettlement?.allocations?.per_page)
        : settlementRows.length || 1;
    const settlementSummary = tenantSettlement?.summary ?? {};
    const selectedTenant = useMemo(
        () =>
            tenantOutlets.find(
                (tenant) =>
                    castFilterString(tenant.id) ===
                    castFilterString(filterData.tenant_outlet_id)
            ) ?? null,
        [tenantOutlets, filterData.tenant_outlet_id]
    );
    const settlementRequestRows = tenantSettlement?.requests?.data ?? [];
    const settlementRequestPaginationLinks =
        tenantSettlement?.requests?.links ?? [];
    const settlementRequestCurrentPage =
        tenantSettlement?.requests?.current_page ?? 1;
    const settlementRequestPerPage = tenantSettlement?.requests?.per_page
        ? Number(tenantSettlement?.requests?.per_page)
        : settlementRequestRows.length || 1;
    const dailyRecapRows = tenantSettlement?.daily_recap ?? [];
    const topTenantRows = tenantSettlement?.top_tenants ?? [];
    const mutationDayRows = tenantSettlement?.mutations?.days?.data ?? [];
    const mutationDayLinks = tenantSettlement?.mutations?.days?.links ?? [];
    const mutationDayCurrentPage = tenantSettlement?.mutations?.days?.current_page ?? 1;
    const mutationDayPerPage = tenantSettlement?.mutations?.days?.per_page
        ? Number(tenantSettlement?.mutations?.days?.per_page)
        : mutationDayRows.length || 1;
    const mutationSelectedDay = tenantSettlement?.mutations?.selected_day ?? "";
    const mutationSelectedDayLabel = tenantSettlement?.mutations?.selected_day_label ?? null;
    const mutationSelectedDaySummary = tenantSettlement?.mutations?.selected_day_summary ?? null;
    const mutationRows = tenantSettlement?.mutations?.details?.data ?? [];
    const mutationLinks = tenantSettlement?.mutations?.details?.links ?? [];
    const mutationCurrentPage = tenantSettlement?.mutations?.details?.current_page ?? 1;
    const mutationPerPage = tenantSettlement?.mutations?.details?.per_page
        ? Number(tenantSettlement?.mutations?.details?.per_page)
        : mutationRows.length || 1;
    const ownerMarkupMonthRows = tenantSettlement?.owner_markup_mutations?.months?.data ?? [];
    const ownerMarkupMonthLinks = tenantSettlement?.owner_markup_mutations?.months?.links ?? [];
    const ownerMarkupMonthCurrentPage = tenantSettlement?.owner_markup_mutations?.months?.current_page ?? 1;
    const ownerMarkupMonthPerPage = tenantSettlement?.owner_markup_mutations?.months?.per_page
        ? Number(tenantSettlement?.owner_markup_mutations?.months?.per_page)
        : ownerMarkupMonthRows.length || 1;
    const ownerMarkupSelectedMonth = tenantSettlement?.owner_markup_mutations?.selected_month ?? "";
    const ownerMarkupSelectedMonthLabel = tenantSettlement?.owner_markup_mutations?.selected_month_label ?? null;
    const ownerMarkupSelectedMonthSummary = tenantSettlement?.owner_markup_mutations?.selected_month_summary ?? null;
    const ownerMarkupDayRows = tenantSettlement?.owner_markup_mutations?.days?.data ?? [];
    const ownerMarkupDayLinks = tenantSettlement?.owner_markup_mutations?.days?.links ?? [];
    const ownerMarkupDayCurrentPage = tenantSettlement?.owner_markup_mutations?.days?.current_page ?? 1;
    const ownerMarkupDayPerPage = tenantSettlement?.owner_markup_mutations?.days?.per_page
        ? Number(tenantSettlement?.owner_markup_mutations?.days?.per_page)
        : ownerMarkupDayRows.length || 1;
    const ownerMarkupSelectedDay = tenantSettlement?.owner_markup_mutations?.selected_day ?? "";
    const ownerMarkupSelectedDayLabel = tenantSettlement?.owner_markup_mutations?.selected_day_label ?? null;
    const ownerMarkupSelectedDaySummary = tenantSettlement?.owner_markup_mutations?.selected_day_summary ?? null;
    const ownerMarkupRows = tenantSettlement?.owner_markup_mutations?.details?.data ?? [];
    const ownerMarkupLinks = tenantSettlement?.owner_markup_mutations?.details?.links ?? [];
    const ownerMarkupCurrentPage = tenantSettlement?.owner_markup_mutations?.details?.current_page ?? 1;
    const ownerMarkupPerPage = tenantSettlement?.owner_markup_mutations?.details?.per_page
        ? Number(tenantSettlement?.owner_markup_mutations?.details?.per_page)
        : ownerMarkupRows.length || 1;
    const settlementExpenseRows = tenantSettlement?.expenses?.data ?? [];
    const settlementExpenseLinks = tenantSettlement?.expenses?.links ?? [];
    const cashHistoryRows = tenantSettlement?.cash_history ?? [];
    const closingMonthRows = tenantSettlement?.closing?.months?.data ?? [];
    const closingMonthLinks = tenantSettlement?.closing?.months?.links ?? [];
    const closingMonthCurrentPage = tenantSettlement?.closing?.months?.current_page ?? 1;
    const closingMonthPerPage = tenantSettlement?.closing?.months?.per_page
        ? Number(tenantSettlement?.closing?.months?.per_page)
        : closingMonthRows.length || 1;
    const closingSelectedMonth = tenantSettlement?.closing?.selected_month ?? "";
    const closingSelectedMonthLabel = tenantSettlement?.closing?.selected_month_label ?? null;
    const closingSelectedMonthSummary = tenantSettlement?.closing?.selected_month_summary ?? null;
    const closingDayRows = tenantSettlement?.closing?.days?.data ?? [];
    const closingDayLinks = tenantSettlement?.closing?.days?.links ?? [];
    const closingDayCurrentPage = tenantSettlement?.closing?.days?.current_page ?? 1;
    const closingDayPerPage = tenantSettlement?.closing?.days?.per_page
        ? Number(tenantSettlement?.closing?.days?.per_page)
        : closingDayRows.length || 1;
    const closingSelectedDay = tenantSettlement?.closing?.selected_day ?? "";
    const closingSelectedDayLabel = tenantSettlement?.closing?.selected_day_label ?? null;
    const closingSelectedDaySummary = tenantSettlement?.closing?.selected_day_summary ?? null;
    const closingDetailRows = tenantSettlement?.closing?.details?.data ?? [];
    const closingDetailLinks = tenantSettlement?.closing?.details?.links ?? [];
    const closingDetailCurrentPage = tenantSettlement?.closing?.details?.current_page ?? 1;
    const closingDetailPerPage = tenantSettlement?.closing?.details?.per_page
        ? Number(tenantSettlement?.closing?.details?.per_page)
        : closingDetailRows.length || 1;
    const unresolvedTenantObligationTotal =
        Number(settlementSummary.tenant_outstanding_total ?? 0)
        + Number(settlementSummary.request_pending_total ?? 0);

    const closingPeriodRows = useMemo(() => ([
        {
            label: "Mutasi Periode",
            section: true,
        },
        {
            label: "A. Pendapatan Omzet Periode",
            note: isOwnerTenantView
                ? "Total penjualan kotor tenant aktif pada periode ini."
                : "Total penjualan kotor pada periode aktif.",
            value: summary?.revenue_total ?? 0,
            tone: "positive",
        },
        {
            label: "B. Hak Tenant Terbentuk Periode",
            note: isOwnerTenantView
                ? "Hak tenant yang terbentuk dari transaksi tenant aktif pada periode ini."
                : "Hak tenant yang terbentuk pada periode aktif sebelum melihat status penyelesaiannya.",
            value: settlementSummary.tenant_rights_total ?? 0,
            tone: "negative",
            prefix: "-",
        },
        {
            label: "Penyelesaian Kewajiban Tenant",
            section: true,
        },
        {
            label: "C. Setor Tunai Tenant Approved",
            note: isOwnerTenantView
                ? "Setor tunai tenant ini yang sudah disetujui sampai akhir periode, termasuk yang belum cair."
                : "Dana setor tunai tenant yang sudah di-approve sampai akhir periode, termasuk yang belum cair.",
            value: settlementSummary.tenant_approved_total ?? 0,
            tone: "info",
        },
        {
            label: "D. Setor Tunai Tenant Sudah Dibayar",
            note: isOwnerTenantView
                ? "Bagian setor tunai tenant ini yang benar-benar sudah dibayar."
                : "Subset dari setor tunai approved yang benar-benar sudah cair ke tenant.",
            value: settlementSummary.tenant_paid_total ?? 0,
            tone: "info",
        },
        {
            label: "E. Kewajiban Owner yang Belum Dibayar",
            note: "Kewajiban owner yang sudah menjadi hak tenant tetapi belum selesai dibayar sampai akhir periode.",
            value: settlementSummary.tenant_outstanding_total ?? 0,
            tone: "negative",
        },
        {
            label: "F. Request Setor Tunai Pending Approval",
            note: "Pengajuan setor tunai tenant yang masih menunggu approval pada periode aktif.",
            value: settlementSummary.request_pending_total ?? 0,
            tone: "info",
        },
        {
            label: "G. Total Kewajiban Owner Belum Diselesaikan",
            note: "Gabungan hak tenant yang masih outstanding dan pengajuan setor tunai yang masih pending approval.",
            value: unresolvedTenantObligationTotal,
            tone: "negative",
        },
        {
            label: "Hak Owner",
            section: true,
        },
        {
            label: isOwnerTenantView ? "H. Hak Owner Bruto dari Tenant Ini" : "H. Hak Owner Bruto",
            note: isOwnerTenantView
                ? "Pendapatan owner yang berasal dari markup produk dan topping tenant aktif sebelum dipotong beban owner."
                : "Pendapatan owner dari markup produk dan topping tenant sebelum dipotong beban owner.",
            value: settlementSummary.owner_markup_total ?? 0,
            tone: "info",
        },
        {
            label: isOwnerTenantView ? "I. Sisa Hak Owner Tenant Ini" : "I. Sisa Hak Owner",
            note: isOwnerTenantView
                ? "Hak owner dari tenant aktif setelah expense paid pada periode aktif."
                : "Hak owner setelah expense paid pada periode aktif.",
            value: settlementSummary.owner_markup_remaining_total ?? 0,
            emphasis: true,
        },
        {
            label: "Kas dan Expense",
            section: true,
        },
        {
            label: isOwnerTenantView ? "J. Expense Outlet Dibayar" : "J. Expense Outlet Dibayar",
            note: isOwnerTenantView
                ? "Pengeluaran outlet induk yang sudah dibayar dan ikut memotong posisi kas tenant ini."
                : "Pengeluaran operasional yang sudah dibayar pada periode yang sama.",
            value: settlementSummary.expense_paid_total ?? 0,
            tone: "negative",
            prefix: "-",
        },
        {
            label: isOwnerTenantView ? "K. Sisa Kas Outlet untuk Tenant Ini" : "K. Sisa Kas Aktual",
            note: isOwnerTenantView
                ? "Posisi kas outlet setelah hak tenant ini yang sudah approved dan expense paid."
                : "Posisi kas akhir setelah expense paid dan penyelesaian setor tunai tenant yang sudah approved.",
            value: settlementSummary.actual_cash_remaining_total ?? 0,
            emphasis: true,
        },
    ]), [isOwnerTenantView, unresolvedTenantObligationTotal, summary?.revenue_total, settlementSummary]);

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

    const handleSelectClosingMonth = (monthKey) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            settlement_view: "closing",
            closing_month_page: closingMonthCurrentPage,
            closing_month: monthKey,
            closing_day_page: 1,
            closing_day: "",
            closing_detail_page: 1,
        }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleSelectClosingDay = (dateKey) => {
        router.get(route("reports.sales.index"), buildQueryPayload({
            settlement_view: "closing",
            closing_month_page: closingMonthCurrentPage,
            closing_month: closingSelectedMonth,
            closing_day_page: closingDayCurrentPage,
            closing_day: dateKey,
            closing_detail_page: 1,
        }), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const safeSummary = {
        orders_count: summary?.orders_count ?? 0,
        revenue_total: summary?.revenue_total ?? 0,
        discount_total: summary?.discount_total ?? 0,
        tenant_discount_total: summary?.tenant_discount_total ?? 0,
        owner_discount_total: summary?.owner_discount_total ?? 0,
        items_sold: summary?.items_sold ?? 0,
        profit_total: summary?.profit_total ?? 0,
        owner_net_total: summary?.owner_net_total ?? 0,
        owner_sales_net_total: summary?.owner_sales_net_total ?? 0,
        owner_product_markup_total: summary?.owner_product_markup_total ?? 0,
        owner_topping_markup_total: summary?.owner_topping_markup_total ?? 0,
        average_order: summary?.average_order ?? 0,
        walk_in_count: summary?.walk_in_count ?? 0,
        registered_customer_count: summary?.registered_customer_count ?? 0,
    };

    const summaryCards = isTenantWorkspace
        ? [
              {
                  title: "Pendapatan Bersih",
                  value: formatCurrency(safeSummary.revenue_total),
                  description: "Total setelah diskon",
                  icon: <IconReceipt2 />,
              },
              {
                  title: "Total Profit",
                  value: formatCurrency(safeSummary.profit_total),
                  description: "Selisih harga beli outlet vs HPP tenant",
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
                  description: `Diskon tenant ${formatCurrency(safeSummary.tenant_discount_total)}`,
                  icon: <IconDiscount2 />,
              },
              {
                  title: "Transaksi Tanpa Profil Customer",
                  value: safeSummary.walk_in_count.toLocaleString("id-ID"),
                  description: `${safeSummary.orders_count > 0 ? ((safeSummary.walk_in_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
                  icon: <IconUsers />,
              },
              {
                  title: "Transaksi Dengan Profil Customer",
                  value: safeSummary.registered_customer_count.toLocaleString("id-ID"),
                  description: `${safeSummary.orders_count > 0 ? ((safeSummary.registered_customer_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
                  icon: <IconWallet />,
              },
          ]
        : [
              {
                  title: "Penjualan Kotor",
                  value: formatCurrency(safeSummary.revenue_total),
                  description: "Total penjualan setelah diskon pada periode aktif",
                  icon: <IconReceipt2 />,
              },
              {
                  title: "Penjualan Setelah Dikurangi Markup Owner",
                  value: formatCurrency(safeSummary.owner_sales_net_total),
                  description: `Penjualan kotor ${formatCurrency(safeSummary.revenue_total)} - markup owner ${formatCurrency(safeSummary.owner_net_total)}`,
                  icon: <IconWallet />,
              },
              {
                  title: "Keuntungan Markup Owner",
                  value: formatCurrency(safeSummary.owner_net_total),
                  description: `Produk ${formatCurrency(safeSummary.owner_product_markup_total)} • Topping ${formatCurrency(safeSummary.owner_topping_markup_total)}`,
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
                  description: `Tenant ${formatCurrency(safeSummary.tenant_discount_total)} • Owner ${formatCurrency(safeSummary.owner_discount_total)}`,
                  icon: <IconDiscount2 />,
              },
              {
                  title: "Transaksi Tanpa Profil Customer",
                  value: safeSummary.walk_in_count.toLocaleString("id-ID"),
                  description: `${safeSummary.orders_count > 0 ? ((safeSummary.walk_in_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
                  icon: <IconUsers />,
              },
              {
                  title: "Transaksi Dengan Profil Customer",
                  value: safeSummary.registered_customer_count.toLocaleString("id-ID"),
                  description: `${safeSummary.orders_count > 0 ? ((safeSummary.registered_customer_count / safeSummary.orders_count) * 100).toFixed(0) : 0}% dari transaksi`,
                  icon: <IconWallet />,
              },
          ];
    const paymentMethodBreakdown = analytics?.payment_method_breakdown || [];
    const activePaymentMethodsCount = paymentMethodBreakdown.filter(
        (item) => (item?.orders_count ?? 0) > 0
    ).length;
    const findPaymentMethod = (...methods) =>
        paymentMethodBreakdown.find((item) =>
            methods.includes(item?.payment_method)
        ) ?? {
            payment_method: methods[0] ?? "unknown",
            payment_method_label: "Belum ada",
            orders_count: 0,
            revenue_total: 0,
        };
    const cashPayment = findPaymentMethod("cash");
    const qrisPayment = findPaymentMethod("qris");
    const transferPayment = findPaymentMethod("bank_transfer");
    const otherPayment = paymentMethodBreakdown.reduce(
        (carry, item) => {
            if (
                ["cash", "qris", "bank_transfer"].includes(
                    item?.payment_method
                )
            ) {
                return carry;
            }

            return {
                payment_method: "others",
                payment_method_label: "Metode Lain",
                orders_count: carry.orders_count + (item?.orders_count ?? 0),
                revenue_total:
                    carry.revenue_total + (item?.revenue_total ?? 0),
            };
        },
        {
            payment_method: "others",
            payment_method_label: "Metode Lain",
            orders_count: 0,
            revenue_total: 0,
        }
    );
    const cashVsNonCash = {
        cash_revenue_total: cashPayment.revenue_total ?? 0,
        non_cash_revenue_total: Math.max(
            0,
            (safeSummary.revenue_total ?? 0) - (cashPayment.revenue_total ?? 0)
        ),
    };
    cashVsNonCash.cash_percent =
        safeSummary.revenue_total > 0
            ? (
                  (cashVsNonCash.cash_revenue_total / safeSummary.revenue_total) *
                  100
              ).toFixed(1)
            : "0.0";
    cashVsNonCash.non_cash_percent =
        safeSummary.revenue_total > 0
            ? (
                  (cashVsNonCash.non_cash_revenue_total /
                      safeSummary.revenue_total) *
                  100
              ).toFixed(1)
            : "0.0";
    const dominantPaymentMethod = paymentMethodBreakdown.reduce(
        (dominant, item) =>
            (item?.revenue_total ?? 0) > (dominant?.revenue_total ?? 0)
                ? item
                : dominant,
        null
    );
    const paymentContributionRows = paymentMethodBreakdown.map((item) => ({
        ...item,
        revenue_share_percent:
            safeSummary.revenue_total > 0
                ? roundToTwo(
                      ((item?.revenue_total ?? 0) / safeSummary.revenue_total) *
                          100
                  )
                : 0,
    }));
    const paymentHighlights = [
        {
            title: "Total Transaksi",
            value: safeSummary.orders_count.toLocaleString("id-ID"),
            description: `${safeSummary.items_sold.toLocaleString("id-ID")} item terjual`,
        },
        {
            title: "Jenis Pembayaran Aktif",
            value: activePaymentMethodsCount.toLocaleString("id-ID"),
            description:
                activePaymentMethodsCount > 0
                    ? "Metode dipakai pada periode ini"
                    : "Belum ada transaksi",
        },
        {
            title: "Tunai",
            value: `${cashPayment.orders_count.toLocaleString("id-ID")} trx`,
            description: formatCurrency(cashPayment.revenue_total ?? 0),
        },
        {
            title: "QRIS",
            value: `${qrisPayment.orders_count.toLocaleString("id-ID")} trx`,
            description: formatCurrency(qrisPayment.revenue_total ?? 0),
        },
        {
            title: "Transfer",
            value: `${transferPayment.orders_count.toLocaleString("id-ID")} trx`,
            description: formatCurrency(transferPayment.revenue_total ?? 0),
        },
        {
            title: "Metode Lain",
            value: `${otherPayment.orders_count.toLocaleString("id-ID")} trx`,
            description: formatCurrency(otherPayment.revenue_total ?? 0),
        },
    ];
    const paymentSummaryBadges = [
        {
            title: "Metode Dominan",
            value: dominantPaymentMethod?.payment_method_label ?? "Belum ada",
            description: dominantPaymentMethod
                ? `${formatCurrency(dominantPaymentMethod.revenue_total ?? 0)} • ${dominantPaymentMethod.orders_count ?? 0} trx`
                : "Belum ada transaksi",
            tone: "emerald",
        },
        {
            title: "Cash vs Non-Cash",
            value: `${cashVsNonCash.cash_percent}% : ${cashVsNonCash.non_cash_percent}%`,
            description: `Cash ${formatCurrency(
                cashVsNonCash.cash_revenue_total
            )} • Non-cash ${formatCurrency(
                cashVsNonCash.non_cash_revenue_total
            )}`,
            tone: "blue",
        },
    ];
    const targetStatusCards = [
        {
            title: "Status Harian Omzet",
            tone: toneClasses[targets?.sales_status_tone] || toneClasses.slate,
            status: targets?.sales_status_label || "Belum ada data",
            value: formatCurrency(targets?.sales_daily_actual ?? 0),
            description: (targets?.sales_monthly_target ?? 0) <= 0
                ? "Target omzet bulanan belum diatur untuk outlet ini."
                : targets?.has_bounded_period
                ? `Target/hari ${formatCurrency(targets?.sales_daily_target ?? 0)} • Aktual/hari ${formatCurrency(targets?.sales_daily_actual ?? 0)}`
                : "Pilih tanggal awal dan akhir untuk evaluasi target harian.",
        },
        {
            title: "Status Harian Profit",
            tone: toneClasses[targets?.profit_status_tone] || toneClasses.slate,
            status: targets?.profit_status_label || "Belum ada data",
            value: formatCurrency(targets?.profit_daily_actual ?? 0),
            description: (targets?.profit_monthly_target ?? 0) <= 0
                ? "Target profit bulanan belum diatur untuk outlet ini."
                : targets?.has_bounded_period
                ? `Target/hari ${formatCurrency(targets?.profit_daily_target ?? 0)} • Aktual/hari ${formatCurrency(targets?.profit_daily_actual ?? 0)}`
                : "Pilih tanggal awal dan akhir untuk evaluasi target harian.",
        },
        {
            title: "Kebutuhan Sisa Omzet",
            tone: toneClasses.blue,
            status: `${targets?.remaining_days ?? 0} hari tersisa`,
            value: formatCurrency(targets?.sales_required_daily ?? 0),
            description: (targets?.sales_monthly_target ?? 0) <= 0
                ? "Atur target omzet bulanan agar kebutuhan sisa per hari bisa dihitung."
                : targets?.has_bounded_period
                ? `Agar target periode ${formatCurrency(targets?.sales_target ?? 0)} tercapai`
                : "Butuh periode aktif untuk hitung kebutuhan per hari.",
        },
        {
            title: "Kebutuhan Sisa Profit",
            tone: toneClasses.blue,
            status: `${targets?.remaining_days ?? 0} hari tersisa`,
            value: formatCurrency(targets?.profit_required_daily ?? 0),
            description: (targets?.profit_monthly_target ?? 0) <= 0
                ? "Atur target profit bulanan agar kebutuhan sisa per hari bisa dihitung."
                : targets?.has_bounded_period
                ? `Agar target periode ${formatCurrency(targets?.profit_target ?? 0)} tercapai`
                : "Butuh periode aktif untuk hitung kebutuhan per hari.",
        },
    ];
    const targetMetricCards = [
        {
            key: "sales",
            title: "Target Omzet",
            actual: targets?.sales_actual ?? 0,
            target: targets?.sales_target ?? 0,
            progress: targets?.sales_progress_percent,
            gap: targets?.sales_gap ?? 0,
            tone: targets?.sales_status_tone ?? "slate",
            status: targets?.sales_status_label ?? "Belum ada data",
            detail:
                (targets?.sales_monthly_target ?? 0) > 0 &&
                targets?.has_bounded_period
                    ? `Expected ${formatCurrency(
                          targets?.sales_expected_to_date ?? 0
                      )} • Butuh ${formatCurrency(
                          targets?.sales_required_daily ?? 0
                      )}/hari`
                    : "Atur target omzet dan pilih rentang tanggal untuk evaluasi detail.",
            formatter: formatCurrency,
        },
        {
            key: "profit",
            title: isTenantWorkspace ? "Target Profit" : "Target Markup Owner",
            actual: targets?.profit_actual ?? 0,
            target: targets?.profit_target ?? 0,
            progress: targets?.profit_progress_percent,
            gap: targets?.profit_gap ?? 0,
            tone: targets?.profit_status_tone ?? "slate",
            status: targets?.profit_status_label ?? "Belum ada data",
            detail:
                (targets?.profit_monthly_target ?? 0) > 0 &&
                targets?.has_bounded_period
                    ? `Expected ${formatCurrency(
                          targets?.profit_expected_to_date ?? 0
                      )} • Butuh ${formatCurrency(
                          targets?.profit_required_daily ?? 0
                      )}/hari`
                    : "Atur target profit dan pilih rentang tanggal untuk evaluasi detail.",
            formatter: formatCurrency,
        },
        {
            key: "items",
            title: "Target Item Terjual",
            actual: targets?.items_actual ?? 0,
            target: targets?.items_target ?? 0,
            progress: targets?.items_progress_percent,
            gap: targets?.items_gap ?? 0,
            tone: targets?.items_status_tone ?? "slate",
            status: targets?.items_status_label ?? "Belum ada data",
            detail:
                (targets?.items_daily_target ?? 0) > 0 &&
                targets?.has_bounded_period
                    ? `Target ${Number(
                          targets?.items_daily_target ?? 0
                      ).toLocaleString("id-ID")}/hari • Butuh ${Number(
                          targets?.items_required_daily ?? 0
                      ).toLocaleString("id-ID")}/hari`
                    : "Atur target item harian di settings agar evaluasi item muncul.",
            formatter: (value) => Number(value || 0).toLocaleString("id-ID"),
        },
    ];
    const targetBreakdownRows = Array.isArray(targets?.breakdown)
        ? targets.breakdown
        : [];
    const unmetTargetDays = targetBreakdownRows.filter(
        (row) =>
            row.sales_met === false ||
            row.profit_met === false ||
            row.items_met === false
    ).length;
    const fullyMetTargetDays = targetBreakdownRows.filter(
        (row) =>
            row.sales_met === true &&
            row.profit_met === true &&
            row.items_met === true
    ).length;
    const tabs = [
        { key: "overview", label: "Ringkasan" },
        { key: "analytics", label: "Analitik" },
        { key: "transactions", label: "Transaksi" },
        { key: "settlement", label: "Settlement" },
    ];
    const activeOutletName = workspace?.active_outlet?.name || "-";
    const settlementScopeLabel = isTenantWorkspace
        ? `Tenant aktif ${activeOutletName}`
        : isOwnerTenantView
          ? `Owner tenant ${activeOutletName}`
        : selectedTenant
          ? `Outlet ${activeOutletName} • Tenant ${selectedTenant.name}`
          : `Semua tenant di ${activeOutletName}`;

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
                            <span>{showFilters ? "Tutup filter" : "Buka filter"}</span>
                            {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                            )}
                        </button>
                        <a
                            href={`${
                                activeTab === "settlement" && settlementView === "closing"
                                    ? route("reports.sales.closing.export")
                                    : route("reports.sales.tenant-settlement.export")
                            }${exportQuery ? `?${exportQuery}` : ""}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                            <IconFileDownload size={18} />
                            {activeTab === "settlement" && settlementView === "closing"
                                ? "Export Closing CSV"
                                : "Export Settlement CSV"}
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

                {/* Filters Modal */}
                <SalesFiltersModal
                    open={showFilters}
                    onClose={() => setShowFilters(false)}
                    filterData={filterData}
                    handleChange={handleChange}
                    hasActiveFilters={hasActiveFilters}
                    resetFilters={resetFilters}
                    datePresets={datePresets}
                    applyDatePreset={applyDatePreset}
                    applyFilters={applyFilters}
                    cashiers={cashiers}
                    selectedCashier={selectedCashier}
                    handleSelectCashier={handleSelectCashier}
                    customerOptions={customerOptions}
                    selectedCustomer={selectedCustomer}
                    handleSelectCustomer={handleSelectCustomer}
                    isTenantWorkspace={isTenantWorkspace}
                    tenantOutlets={tenantOutlets}
                    reportTimezone={reportTimezone}
                    reportTimezoneLabel={reportTimezoneLabel}
                />


                <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-2 md:grid-cols-4">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => handleTabChange(tab.key)}
                                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    activeTab === tab.key
                                        ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Melihat Sebagai
                            </p>
                            <p className="mt-1 font-semibold">
                                {auth?.user?.name || "-"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {isTenantWorkspace ? "Workspace tenant" : "Owner / outlet utama"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Outlet Aktif
                            </p>
                            <p className="mt-1 font-semibold">
                                {workspace?.active_outlet?.name || "-"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {workspace?.active_outlet?.code || workspace?.active_outlet?.outlet_type || "-"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Scope Data
                            </p>
                            <p className="mt-1 font-semibold">
                                {isTenantWorkspace
                                    ? "Tenant aktif"
                                    : selectedTenant
                                      ? `Outlet ${activeOutletName} dengan filter tenant ${selectedTenant.name}`
                                      : "Semua tenant di outlet aktif"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                {isTenantWorkspace
                                    ? "Semua data dibatasi ke tenant aktif pada session ini."
                                    : selectedTenant
                                    ? "Outlet aktif tetap mengikuti dropdown utama, tetapi report ini sedang difilter ke tenant yang dipilih."
                                    : "Summary mengikuti outlet aktif dan seluruh tenant yang termasuk di dalamnya"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                Periode Tampil
                            </p>
                            <p className="mt-1 font-semibold">
                                {filterData.start_date || "Awal data"} - {filterData.end_date || "Sekarang"}
                            </p>
                            <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                                Tab settlement memakai saldo kumulatif sampai akhir periode
                            </p>
                        </div>
                    </div>
                </div>

                {activeTab === "overview" ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {summaryCards.map((card) => (
                                <SummaryCard key={card.title} {...card} />
                            ))}
                        </div>

                        {!isTenantWorkspace && ownerToppingBreakdown.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Breakdown Markup Topping Owner
                                        </h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Rincian topping yang menyumbang markup owner pada periode aktif.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Total {formatCurrency(safeSummary.owner_topping_markup_total)}
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[560px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                                                    Topping
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">
                                                    Qty
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">
                                                    Nilai Topping
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">
                                                    Markup Owner
                                                </th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">
                                                    Kontribusi
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {ownerToppingBreakdown.map((item, index) => (
                                                <tr key={`${item.name}-${index}`}>
                                                    <td className="px-3 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {item.name}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                        {Number(item.total_qty ?? 0).toLocaleString("id-ID")}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                        {formatCurrency(item.topping_total ?? 0)}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                                                        {formatCurrency(item.owner_markup_total ?? 0)}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                        {roundToTwo(item.owner_markup_share_percent ?? 0)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : null}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Pencapaian Target
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Membandingkan hasil periode aktif dengan target omzet, profit, dan item terjual.
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {targets?.period_label || "Periode berjalan"}
                            </span>
                            {targets?.has_bounded_period ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowTargetBreakdownModal(true)
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300"
                                >
                                    Lihat breakdown target
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {paymentHighlights.map((item) => (
                            <div
                                key={item.title}
                                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-800 dark:from-slate-950/40 dark:to-slate-900"
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {item.title}
                                </p>
                                <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                    {item.value}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {targetStatusCards.map((item) => (
                            <div
                                key={item.title}
                                className={`rounded-2xl border p-4 ${item.tone}`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide">
                                    {item.title}
                                </p>
                                <p className="mt-2 text-lg font-bold">
                                    {item.value}
                                </p>
                                <p className="mt-1 text-xs font-semibold">
                                    {item.status}
                                </p>
                                <p className="mt-1 text-sm opacity-80">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mb-4 grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            {paymentSummaryBadges.map((item) => (
                                <div
                                    key={item.title}
                                    className={`rounded-2xl border p-4 ${
                                        item.tone === "emerald"
                                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                            : "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20"
                                    }`}
                                >
                                    <p
                                        className={`text-xs font-semibold uppercase tracking-wide ${
                                            item.tone === "emerald"
                                                ? "text-emerald-700 dark:text-emerald-300"
                                                : "text-blue-700 dark:text-blue-300"
                                        }`}
                                    >
                                        {item.title}
                                    </p>
                                    <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                        {item.value}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Kontribusi Metode Pembayaran
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Perbandingan nominal dan kontribusi tiap metode pada periode aktif.
                                    </p>
                                </div>
                            </div>

                            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl bg-white px-4 py-3 dark:bg-slate-900">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Total Semua Transaksi
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                        {safeSummary.orders_count.toLocaleString("id-ID")} trx
                                    </p>
                                </div>
                                <div className="rounded-xl bg-white px-4 py-3 dark:bg-slate-900">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Total Nominal Transaksi
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(safeSummary.revenue_total)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {paymentContributionRows.length > 0 ? (
                                    paymentContributionRows.map((item) => (
                                        <div key={item.payment_method}>
                                            <div className="mb-1 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {item.payment_method_label}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {item.orders_count ?? 0} trx
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {formatCurrency(
                                                            item.revenue_total ?? 0
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {item.revenue_share_percent}%
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                                <div
                                                    className="h-full rounded-full bg-primary-500"
                                                    style={{
                                                        width: progressWidth(
                                                            item.revenue_share_percent
                                                        ),
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-xl bg-white px-4 py-5 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                        Belum ada transaksi pada periode ini.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        {targetMetricCards.map((metric) => (
                            <div
                                key={metric.key}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            {metric.title}
                                        </p>
                                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                                            {metric.formatter(metric.actual)}
                                        </p>
                                    </div>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            toneClasses[metric.tone] ||
                                            toneClasses.slate
                                        }`}
                                    >
                                        {metric.target > 0
                                            ? `${metric.progress ?? 0}%`
                                            : "Belum diatur"}
                                    </span>
                                </div>
                                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                    <div
                                        className={`h-full rounded-full ${
                                            metric.key === "profit"
                                                ? "bg-emerald-500"
                                                : metric.key === "items"
                                                  ? "bg-amber-500"
                                                  : "bg-primary-500"
                                        }`}
                                        style={{
                                            width: progressWidth(
                                                metric.progress
                                            ),
                                        }}
                                    />
                                </div>
                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Target {metric.formatter(metric.target)}
                                    </span>
                                    <span
                                        className={`font-semibold ${
                                            Number(metric.gap ?? 0) >= 0
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-600 dark:text-rose-400"
                                        }`}
                                    >
                                        {Number(metric.gap ?? 0) >= 0
                                            ? "Lebih "
                                            : "Kurang "}
                                        {metric.formatter(
                                            Math.abs(Number(metric.gap ?? 0))
                                        )}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    {metric.status} • {metric.detail}
                                </div>
                            </div>
                        ))}
                    </div>

                    {targets?.has_bounded_period ? (
                        <div className="mt-4 rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 via-white to-amber-50 p-4 dark:border-primary-900/40 dark:from-primary-950/20 dark:via-slate-900 dark:to-amber-950/10">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                        Breakdown Target Harian
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        {fullyMetTargetDays.toLocaleString(
                                            "id-ID"
                                        )}{" "}
                                        hari sudah memenuhi semua target,{" "}
                                        {unmetTargetDays.toLocaleString(
                                            "id-ID"
                                        )}{" "}
                                        hari masih perlu dikejar dalam periode ini.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowTargetBreakdownModal(true)
                                    }
                                    className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-700"
                                >
                                    Buka Breakdown Target
                                </button>
                            </div>
                        </div>
                    ) : null}
                        </div>
                    </>
                ) : null}

                {activeTab === "analytics" ? (
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
                        data={analytics?.full_products || []} 
                        onProductClick={setProductDetailModal} 
                    />

                    {/* Slow Moving Products */}
                    <SlowMovingProductsTable data={analytics?.slow_moving_products || []} />
                </div>
                ) : null}

                {/* Product Detail Modal */}
                <ProductDetailModal 
                    product={productDetailModal} 
                    onClose={() => setProductDetailModal(null)} 
                />

                {activeTab === "transactions" ? (
                <>
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
                                                        <>
                                                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                                Markup produk{" "}
                                                                {formatCurrency(
                                                                    trx.owner_product_markup_total ?? 0
                                                                )}
                                                            </div>
                                                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                                Markup topping{" "}
                                                                {formatCurrency(
                                                                    trx.owner_topping_markup_total ?? 0
                                                                )}
                                                            </div>
                                                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                                Owner net{" "}
                                                                {formatCurrency(
                                                                    trx.owner_net_total ?? 0
                                                                )}
                                                            </div>
                                                        </>
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
                                                                            {Array.isArray(item.modifier_items) && item.modifier_items.length > 0 ? (
                                                                                <div className="mt-2 space-y-1.5">
                                                                                    {item.modifier_items.map((modifier) => (
                                                                                        <div
                                                                                            key={modifier.id}
                                                                                            className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2 text-[11px] text-slate-600 dark:border-amber-900/30 dark:bg-amber-950/10 dark:text-slate-300"
                                                                                        >
                                                                                            <div className="font-medium text-slate-700 dark:text-slate-200">
                                                                                                {modifier.name} x{modifier.qty}
                                                                                            </div>
                                                                                            <div className="mt-1">
                                                                                                Nilai topping {formatCurrency(modifier.total_price ?? 0)}
                                                                                            </div>
                                                                                            {!isTenantWorkspace ? (
                                                                                                <div>
                                                                                                    Markup owner topping {formatCurrency(modifier.owner_markup_total ?? 0)}
                                                                                                </div>
                                                                                            ) : null}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null}
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
                                                                                    <div>Markup produk {formatCurrency(item.owner_product_markup_total ?? 0)}</div>
                                                                                    <div>Markup topping {formatCurrency(item.owner_topping_markup_total ?? 0)}</div>
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
                </>
                ) : null}

                {activeTab === "settlement" ? (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                Melihat sebagai: {auth?.user?.name || "-"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                Outlet aktif: {workspace?.active_outlet?.name || "-"}
                            </span>
                            <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                Scope: {isTenantWorkspace
                                    ? `Tenant aktif ${activeOutletName}`.trim()
                                    : settlementScopeLabel}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isTenantWorkspace
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    : isOwnerTenantView
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                    : "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                            }`}>
                                {isTenantWorkspace
                                    ? "Mode Tenant Workspace"
                                    : isOwnerTenantView
                                      ? "Mode Owner Tenant"
                                      : "Mode Owner Global"}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleSettlementViewChange("closing")}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    settlementView === "closing"
                                        ? "bg-primary-600 text-white"
                                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                                }`}
                            >
                                Tutup Buku
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSettlementViewChange("withdraw")}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    settlementView === "withdraw"
                                        ? "bg-primary-600 text-white"
                                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                                }`}
                            >
                                Withdraw Tenant
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSettlementViewChange("tenant_mutations")}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    settlementView === "tenant_mutations"
                                        ? "bg-primary-600 text-white"
                                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                                }`}
                            >
                                Mutasi Tenant
                            </button>
                            {!isTenantWorkspace ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleSettlementViewChange("owner_markup")}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            settlementView === "owner_markup"
                                                ? "bg-primary-600 text-white"
                                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        Mutasi Markup Owner
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSettlementViewChange("cash")}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            settlementView === "cash"
                                                ? "bg-primary-600 text-white"
                                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        Kas & Expense
                                    </button>
                                </>
                            ) : null}
                        </div>
                        <div className={`rounded-2xl border p-4 ${
                            isTenantWorkspace
                                ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10"
                                : isOwnerTenantView
                                  ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/10"
                                : "border-sky-200 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/10"
                        }`}>
                            <p className={`text-sm ${
                                isTenantWorkspace
                                    ? "text-amber-800 dark:text-amber-200"
                                    : isOwnerTenantView
                                      ? "text-blue-800 dark:text-blue-200"
                                    : "text-sky-800 dark:text-sky-200"
                            }`}>
                                {isTenantWorkspace
                                    ? "Workspace tenant hanya menampilkan data tenant aktif. Tab owner seperti markup owner dan kas outlet tidak ditampilkan di sini."
                                    : isOwnerTenantView
                                      ? "Mode owner tenant membaca tutup buku khusus tenant aktif. Angka owner tetap ditampilkan, tetapi konteksnya hanya tenant ini, bukan agregat semua tenant outlet utama."
                                      : "Workspace owner global menampilkan ringkasan outlet aktif dan bisa difilter ke tenant tertentu. Tab markup owner dan kas outlet hanya tersedia untuk owner global."}
                            </p>
                        </div>
                        {settlementView === "closing" && !isTenantWorkspace ? (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <SummaryCard
                                    icon={<IconTrendingUp />}
                                    title="Total Penjualan"
                                    value={formatCurrency(summary?.revenue_total ?? 0)}
                                    description="Omzet kotor pada interval yang dipilih"
                                />
                                <SummaryCard
                                    icon={<IconReceipt2 />}
                                    title="Hak Tenant"
                                    value={formatCurrency(settlementSummary.tenant_rights_total ?? 0)}
                                    description={`Approved ${formatCurrency(settlementSummary.tenant_approved_total ?? 0)} • paid ${formatCurrency(settlementSummary.tenant_paid_total ?? 0)} • outstanding ${formatCurrency(settlementSummary.tenant_outstanding_total ?? 0)}`}
                                />
                                <SummaryCard
                                    icon={<IconCoin />}
                                    title="Expense Outlet"
                                    value={formatCurrency(settlementSummary.expense_total ?? 0)}
                                    description={`Paid ${formatCurrency(settlementSummary.expense_paid_total ?? 0)} • unpaid ${formatCurrency(settlementSummary.expense_unpaid_total ?? 0)}`}
                                />
                                <SummaryCard
                                    icon={<IconTrendingUp />}
                                    title="Sisa Kas Aktual"
                                    value={formatCurrency(settlementSummary.actual_cash_remaining_total ?? 0)}
                                    description={`Setelah payout approved & expense paid. Sisa konservatif ${formatCurrency(settlementSummary.actual_cash_after_rights_total ?? 0)}`}
                                />
                                <SummaryCard
                                    icon={<IconShoppingBag />}
                                    title="Markup Owner"
                                    value={formatCurrency(settlementSummary.owner_markup_total ?? 0)}
                                    description="Akumulasi markup owner dari transaksi tenant pada scope report"
                                />
                                <SummaryCard
                                    icon={<IconWallet />}
                                    title="Sisa Markup Owner"
                                    value={formatCurrency(settlementSummary.owner_markup_remaining_total ?? 0)}
                                    description={`Setelah expense paid. Sisa konservatif ${formatCurrency(settlementSummary.owner_markup_after_expense_total ?? 0)}`}
                                />
                            </div>
                        ) : null}
                        {settlementView === "closing" ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Laporan Tutup Buku
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {isOwnerTenantView
                                        ? "Tampilan ini khusus owner tenant. Gunakan lembar akuntansi periode sebagai laporan utama, lalu gunakan tabel bulan, hari, dan detail transaksi untuk audit penyusunnya."
                                        : "Gunakan lembar akuntansi periode sebagai laporan utama. Tabel bulan, hari, dan detail transaksi di bawah hanya breakdown audit penyusunnya, bukan laporan akuntansi baru."}
                                </p>
                                <div className="mt-4 grid gap-3 xl:grid-cols-3">
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Hak Tenant Periode</div>
                                        <div className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(settlementSummary.tenant_rights_total ?? 0)}</div>
                                        <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                            {Number(settlementSummary.tenant_rights_total ?? 0) < 0
                                                ? "Hasil mutasi saldo tenant pada periode aktif: total transaksi delivered tenant dikurangi retur selesai. Nilai minus berarti koreksi/retur periode ini lebih besar dari hak tenant baru."
                                                : isOwnerTenantView
                                                  ? "Hasil mutasi saldo tenant aktif pada periode ini: transaksi delivered tenant dikurangi retur selesai."
                                                  : "Hasil mutasi saldo tenant pada scope dan periode aktif: transaksi delivered tenant dikurangi retur selesai."}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{isOwnerTenantView ? "Markup Owner dari Tenant Ini" : "Markup Owner Periode"}</div>
                                        <div className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(settlementSummary.owner_markup_total ?? 0)}</div>
                                        <div className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                                            {isOwnerTenantView
                                                ? "Akumulasi markup owner yang berasal dari tenant aktif."
                                                : "Akumulasi pendapatan owner dari transaksi tenant."}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{isOwnerTenantView ? "Posisi Kas untuk Tenant Ini" : "Posisi Kas Aktual"}</div>
                                        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(settlementSummary.actual_cash_remaining_total ?? 0)}</div>
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {isOwnerTenantView
                                                ? `Setelah payout tenant ini di-approve dan expense paid. Sisa markup owner ${formatCurrency(settlementSummary.owner_markup_remaining_total ?? 0)}.`
                                                : `Setelah payout tenant approved dan expense paid. Sisa markup owner ${formatCurrency(settlementSummary.owner_markup_remaining_total ?? 0)}.`}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
                                    <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                                        Status Withdraw Tenant
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                        <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/30 dark:bg-slate-900/40">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Outstanding Tenant</div>
                                            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(settlementSummary.outstanding_total ?? 0)}</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo dasar {formatCurrency(settlementSummary.request_balance_total ?? 0)}</div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/30 dark:bg-slate-900/40">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending Request</div>
                                            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(settlementSummary.request_pending_total ?? 0)}</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{Number(settlementSummary.request_pending_count ?? 0).toLocaleString("id-ID")} request menunggu approval</div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/30 dark:bg-slate-900/40">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Approved Belum Cair</div>
                                            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(settlementSummary.request_approved_pending_payment_total ?? 0)}</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Approved {formatCurrency(settlementSummary.request_approved_total ?? 0)} • paid {formatCurrency(settlementSummary.request_paid_total ?? 0)}</div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/30 dark:bg-slate-900/40">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sudah Dibayar</div>
                                            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(settlementSummary.request_paid_total ?? 0)}</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dana tenant yang sudah benar-benar keluar</div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/30 dark:bg-slate-900/40">
                                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Request Ditolak</div>
                                            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{Number(settlementSummary.request_rejected_count ?? 0).toLocaleString("id-ID")}</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Riwayat request yang ditolak</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <ClosingStatementTable
                                        title={isOwnerTenantView ? "Lembar Akuntansi Tenant Aktif" : "Lembar Akuntansi Periode"}
                                        description={isOwnerTenantView
                                            ? "Baca berurutan: omzet periode, hak tenant yang terbentuk, penyelesaian setor tunai tenant, kewajiban owner yang masih tersisa, hak owner, expense outlet dibayar, lalu posisi kas akhir tenant aktif."
                                            : "Baca berurutan: omzet periode, hak tenant yang terbentuk, penyelesaian setor tunai tenant, kewajiban owner yang masih tersisa, hak owner, expense outlet dibayar, lalu posisi kas akhir periode."}
                                        rows={closingPeriodRows}
                                    />
                                </div>

                                {!isTenantWorkspace && closingMonthRows.length > 0 ? (
                                    <>
                                        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        Tutup Buku Bulanan
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Ini hanya ringkasan audit bulanan untuk membantu telusur penyusun lembar akuntansi periode.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full min-w-[980px]">
                                                <thead>
                                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Bulan</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Penjualan</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Expense Paid</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Sisa Kas</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Sisa Markup</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {closingMonthRows.map((row, index) => {
                                                        const isSelected = row.month_key === closingSelectedMonth;

                                                        return (
                                                            <tr key={row.month_key} className={isSelected ? "bg-primary-50/60 dark:bg-primary-950/10" : ""}>
                                                                <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                                    {index + 1 + (closingMonthCurrentPage - 1) * closingMonthPerPage}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.month_label}</div>
                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                        {Number(row.days_count ?? 0).toLocaleString("id-ID")} hari
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.revenue_total ?? 0)}</td>
                                                                <td className="px-3 py-3 text-right text-sm text-emerald-700 dark:text-emerald-300">{formatCurrency(row.tenant_rights_total ?? 0)}</td>
                                                                <td className="px-3 py-3 text-right text-sm text-blue-700 dark:text-blue-300">{formatCurrency(row.owner_markup_total ?? 0)}</td>
                                                                <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.expense_paid_total ?? 0)}</td>
                                                                <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.remaining_cash_total ?? 0)}</td>
                                                                <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.owner_markup_remaining_total ?? 0)}</td>
                                                                <td className="px-3 py-3 text-sm">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectClosingMonth(row.month_key)}
                                                                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                                            isSelected
                                                                                ? "bg-primary-600 text-white"
                                                                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                        }`}
                                                                    >
                                                                        {isSelected ? "Bulan aktif" : "Lihat harian"}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {closingMonthLinks.length > 3 ? <Pagination links={closingMonthLinks} /> : null}

                                        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        Breakdown Harian {closingSelectedMonthLabel || "Bulan Terpilih"}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Ini breakdown audit per hari. Kolom bertanda `Hari Ini` menunjukkan mutasi hari itu, sedangkan kolom `Akum.` menunjukkan posisi sampai tanggal tersebut.
                                                    </p>
                                                </div>
                                                {closingSelectedMonthSummary ? (
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                            Penjualan {formatCurrency(closingSelectedMonthSummary.revenue_total ?? 0)}
                                                        </span>
                                                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                            Hak tenant {formatCurrency(closingSelectedMonthSummary.tenant_rights_total ?? 0)}
                                                        </span>
                                                        <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
                                                            Markup owner {formatCurrency(closingSelectedMonthSummary.owner_markup_total ?? 0)}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full min-w-[1160px]">
                                                <thead>
                                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Hari</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Penjualan Hari Ini</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant Hari Ini</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner Hari Ini</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Expense Paid Hari Ini</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Setor Tunai Dibayar Akum.</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Sisa Hak Owner Akum.</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Sisa Kas Akum.</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {closingDayRows.length > 0 ? closingDayRows.map((row, index) => {
                                                        const isSelected = row.date === closingSelectedDay;

                                                        return (
                                                        <tr key={row.date} className={isSelected ? "bg-primary-50/60 dark:bg-primary-950/10" : ""}>
                                                            <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                                {index + 1 + (closingDayCurrentPage - 1) * closingDayPerPage}
                                                            </td>
                                                            <td className="px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white">{row.label}</td>
                                                            <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.revenue_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-right text-sm text-emerald-700 dark:text-emerald-300">{formatCurrency(row.tenant_rights_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-right text-sm text-blue-700 dark:text-blue-300">{formatCurrency(row.owner_markup_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.expense_paid_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.tenant_paid_cumulative_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.owner_markup_remaining_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.remaining_cash_total ?? 0)}</td>
                                                            <td className="px-3 py-3 text-sm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectClosingDay(row.date)}
                                                                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                                        isSelected
                                                                            ? "bg-primary-600 text-white"
                                                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                    }`}
                                                                >
                                                                    {isSelected ? "Hari aktif" : "Lihat detail"}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}) : (
                                                        <tr>
                                                            <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                                Tidak ada breakdown harian untuk bulan yang dipilih.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {closingDayLinks.length > 3 ? <Pagination links={closingDayLinks} /> : null}

                                        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        Detail Transaksi {closingSelectedDayLabel || "Hari Terpilih"}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Daftar transaksi sumber yang membentuk angka hari terpilih.
                                                    </p>
                                                </div>
                                                {closingSelectedDaySummary ? (
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                            Penjualan {formatCurrency(closingSelectedDaySummary.revenue_total ?? 0)}
                                                        </span>
                                                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                            Hak tenant {formatCurrency(closingSelectedDaySummary.tenant_rights_total ?? 0)}
                                                        </span>
                                                        <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
                                                            Markup owner {formatCurrency(closingSelectedDaySummary.owner_markup_total ?? 0)}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="w-full min-w-[900px]">
                                                <thead>
                                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aktivitas</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Kasir</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Penjualan</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Waktu</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {closingDetailRows.length > 0 ? closingDetailRows.map((row, index) => (
                                                        <tr key={row.id}>
                                                            <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                                {index + 1 + (closingDetailCurrentPage - 1) * closingDetailPerPage}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">{row.invoice}</div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {row.reference} • {row.customer_name}
                                                                </div>
                                                                <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                                                                    row.status === "Retur"
                                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300"
                                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                                                                }`}>
                                                                    {row.status}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                                <div>{row.cashier_name}</div>
                                                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{row.activity_at}</div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                                                                {formatCurrency(row.gross_total ?? 0)}
                                                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                    Promo {formatCurrency(row.discount_total ?? 0)}
                                                                </div>
                                                            </td>
                                                            <td className={`px-3 py-3 text-right text-sm ${
                                                                Number(row.mutation_total ?? 0) < 0
                                                                    ? "text-rose-600 dark:text-rose-300"
                                                                    : "text-emerald-600 dark:text-emerald-300"
                                                            }`}>
                                                                {formatCurrency(row.mutation_total ?? 0)}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                                {formatCurrency(row.owner_markup_total ?? 0)}
                                                            </td>
                                                            <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300 hidden md:table-cell">{row.activity_at}</td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                                Tidak ada detail transaksi untuk hari yang dipilih.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {closingDetailLinks.length > 3 ? <Pagination links={closingDetailLinks} /> : null}
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                        {!isTenantWorkspace && settlementView === "cash" && settlementExpenseRows.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Detail Expense Outlet
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Pengeluaran operasional pada scope outlet aktif dan periode report.
                                </p>
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[760px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Tanggal</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Kategori</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Deskripsi</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Nominal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {settlementExpenseRows.map((row) => (
                                                <tr key={row.id}>
                                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{row.expense_date || "-"}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{row.category || "-"}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                        <div>{row.description || "-"}</div>
                                                        {row.created_by_name ? (
                                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                Oleh {row.created_by_name}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{row.status || "-"}</td>
                                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.amount ?? 0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {settlementExpenseLinks.length > 3 ? <Pagination links={settlementExpenseLinks} /> : null}
                            </div>
                        ) : null}
                        {!isTenantWorkspace && settlementView === "cash" && cashHistoryRows.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Riwayat Sisa Kas Harian
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Posisi kas harian setelah payout tenant yang sudah dibayar dan expense paid kumulatif.
                                </p>
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[980px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Tanggal</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner Harian</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner Kumulatif</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Expense Paid</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Payout Tenant Paid</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant Kumulatif</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Sisa Markup Owner</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Sisa Kas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {cashHistoryRows.map((row) => (
                                                <tr key={row.date}>
                                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{row.label}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.owner_markup_total ?? 0)}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.owner_markup_cumulative_total ?? 0)}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.expense_paid_total ?? 0)}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.tenant_paid_cumulative_total ?? 0)}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.tenant_rights_cumulative_total ?? 0)}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatCurrency(row.owner_markup_remaining_total ?? 0)}</td>
                                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.remaining_cash_total ?? 0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : null}
                        {!isTenantWorkspace && settlementView === "owner_markup" && ownerMarkupMonthRows.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Mutasi Markup Owner
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Breakdown markup owner per bulan, per hari, lalu detail transaksi pada hari yang dipilih.
                                        </p>
                                    </div>
                                    <div className="inline-flex rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                        Scope: {settlementScopeLabel}
                                    </div>
                                </div>

                                <div className="mt-5 overflow-x-auto">
                                    <table className="w-full min-w-[820px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Bulan</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Jumlah Mutasi</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {ownerMarkupMonthRows.map((row, index) => {
                                                const isSelected = row.month_key === ownerMarkupSelectedMonth;

                                                return (
                                                    <tr key={row.month_key} className={isSelected ? "bg-primary-50/60 dark:bg-primary-950/10" : ""}>
                                                        <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                            {index + 1 + (ownerMarkupMonthCurrentPage - 1) * ownerMarkupMonthPerPage}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.month_label}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {Number(row.transactions_count ?? 0).toLocaleString("id-ID")} masuk saldo • {Number(row.returns_count ?? 0).toLocaleString("id-ID")} retur
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                            {formatCurrency(row.owner_markup_total ?? 0)}
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                                                            {formatCurrency(row.tenant_total ?? 0)}
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                                                            {Number(row.entries_count ?? 0).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="px-3 py-3 text-sm">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectOwnerMarkupMonth(row.month_key)}
                                                                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                                    isSelected
                                                                        ? "bg-primary-600 text-white"
                                                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                }`}
                                                            >
                                                                {isSelected ? "Bulan aktif" : "Lihat hari"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {ownerMarkupMonthLinks.length > 3 ? <Pagination links={ownerMarkupMonthLinks} /> : null}

                                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                Breakdown Harian {ownerMarkupSelectedMonthLabel || "Bulan Terpilih"}
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Pilih hari untuk melihat detail transaksi markup owner.
                                            </p>
                                        </div>
                                        {ownerMarkupSelectedMonthSummary ? (
                                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
                                                    Markup owner {formatCurrency(ownerMarkupSelectedMonthSummary.owner_markup_total ?? 0)}
                                                </span>
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                    Hak tenant {formatCurrency(ownerMarkupSelectedMonthSummary.tenant_total ?? 0)}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[820px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Hari</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Jumlah Mutasi</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {ownerMarkupDayRows.map((row, index) => {
                                                const isSelected = row.date_key === ownerMarkupSelectedDay;

                                                return (
                                                    <tr key={row.date_key} className={isSelected ? "bg-primary-50/60 dark:bg-primary-950/10" : ""}>
                                                        <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                            {index + 1 + (ownerMarkupDayCurrentPage - 1) * ownerMarkupDayPerPage}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.date_label}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {Number(row.transactions_count ?? 0).toLocaleString("id-ID")} masuk saldo • {Number(row.returns_count ?? 0).toLocaleString("id-ID")} retur
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                            {formatCurrency(row.owner_markup_total ?? 0)}
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                                                            {formatCurrency(row.tenant_total ?? 0)}
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                                                            {Number(row.entries_count ?? 0).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="px-3 py-3 text-sm">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectOwnerMarkupDay(row.date_key)}
                                                                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                                    isSelected
                                                                        ? "bg-primary-600 text-white"
                                                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                }`}
                                                            >
                                                                {isSelected ? "Hari aktif" : "Lihat detail"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {ownerMarkupDayLinks.length > 3 ? <Pagination links={ownerMarkupDayLinks} /> : null}

                                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                Breakdown Detail {ownerMarkupSelectedDayLabel || "Hari Terpilih"}
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Daftar transaksi markup owner pada hari yang dipilih.
                                            </p>
                                        </div>
                                        {ownerMarkupSelectedDaySummary ? (
                                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
                                                    Markup owner {formatCurrency(ownerMarkupSelectedDaySummary.owner_markup_total ?? 0)}
                                                </span>
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                    Hak tenant {formatCurrency(ownerMarkupSelectedDaySummary.tenant_total ?? 0)}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[840px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aktivitas</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Kasir</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Referensi</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Waktu</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {ownerMarkupRows.length > 0 ? ownerMarkupRows.map((row, index) => (
                                                <tr key={row.id}>
                                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                        {index + 1 + (ownerMarkupCurrentPage - 1) * ownerMarkupPerPage}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.invoice}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {row.reference} • {row.customer_name}
                                                        </div>
                                                        <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                            {row.status}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{row.cashier_name}</td>
                                                    <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                        {formatCurrency(row.gross_total ?? 0)}
                                                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                            Promo {formatCurrency(row.discount_total ?? 0)}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                        {formatCurrency(row.owner_markup_total ?? 0)}
                                                    </td>
                                                    <td className={`px-3 py-3 text-right text-sm ${
                                                        Number(row.mutation_total ?? 0) < 0
                                                            ? "text-rose-600 dark:text-rose-300"
                                                            : "text-emerald-600 dark:text-emerald-300"
                                                    }`}>
                                                        {formatCurrency(row.mutation_total ?? 0)}
                                                    </td>
                                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">{row.activity_at}</td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                        Tidak ada detail markup owner pada hari yang dipilih.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {ownerMarkupLinks.length > 3 ? <Pagination links={ownerMarkupLinks} /> : null}
                            </div>
                        ) : null}

                        {settlementView === "withdraw" && settlementRequestRows.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Riwayat Withdraw Tenant
                                </h2>
                                <div className="mt-2 inline-flex rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                    Scope: {settlementScopeLabel}
                                </div>
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Data ini mengikuti request operasional di halaman cashier settlements: pending, approved, rejected, dan nominal withdraw.
                                </div>
                            </div>
                        ) : null}

                        {settlementView === "withdraw" && settlementRequestRows.length > 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500">Request</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500">Tanggal</th>
                                                <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500">Saldo Dasar</th>
                                                <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500">Diminta</th>
                                                <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500">Disetujui</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {settlementRequestRows.map((row, index) => (
                                                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {index + 1 + (settlementRequestCurrentPage - 1) * settlementRequestPerPage}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                                                        <div>{row.request_number ?? "-"}</div>
                                                        <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            {row.cashier?.name ?? "-"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        <div>{row.created_at ?? "-"}</div>
                                                        <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            Dibayar {row.paid_at ?? "-"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                        {formatCurrency(row.base_sales_total ?? 0)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                        {formatCurrency(row.markup_total ?? 0)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300">
                                                        {formatCurrency(row.requested_amount ?? 0)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">
                                                        {formatCurrency(row.approved_amount ?? 0)}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {row.status === "approved"
                                                            ? "Disetujui"
                                                            : row.status === "rejected"
                                                              ? "Ditolak"
                                                              : "Menunggu Approval"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : settlementView === "withdraw" ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                    <IconDatabaseOff size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                                    Tidak Ada Riwayat Withdraw
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Tidak ada request withdraw tenant sesuai filter.
                                </p>
                            </div>
                        ) : null}

                        {settlementView === "withdraw" && settlementRequestPaginationLinks.length > 3 ? (
                            <Pagination links={settlementRequestPaginationLinks} />
                        ) : null}

                        {settlementView === "tenant_mutations" && mutationDayRows.length > 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Mutasi Saldo Tenant
                                </h2>
                                <div className="mt-2 inline-flex rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                    Scope: {settlementScopeLabel}
                                </div>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Riwayat mutasi dari awal tenant sampai sekarang: transaksi yang menambah hak tenant dan retur yang mengurangi saldo tenant.
                                </p>
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <div className="min-w-[260px] flex-1">
                                        <input
                                            type="text"
                                            value={filterData.mutation_q}
                                            onChange={(e) => handleChange("mutation_q", e.target.value)}
                                            placeholder="Cari invoice, referensi, customer, atau kasir"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => router.get(route("reports.sales.index"), buildQueryPayload({
                                            settlement_view: "tenant_mutations",
                                            mutations_page: 1,
                                            mutation_detail_page: 1,
                                            mutation_day: "",
                                        }), {
                                            preserveScroll: true,
                                            preserveState: true,
                                            replace: true,
                                        })}
                                        className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                                    >
                                        Cari Mutasi
                                    </button>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-4">
                                    <SummaryCard
                                        icon={<IconCalendar />}
                                        title="Hari Ditampilkan"
                                        value={Number(mutationDayRows.length || 0).toLocaleString("id-ID")}
                                        description={`Halaman ${mutationDayCurrentPage} dari mutasi harian`}
                                    />
                                    <SummaryCard
                                        icon={<IconWallet />}
                                        title="Tanggal Dipilih"
                                        value={mutationSelectedDayLabel || "-"}
                                        description="Detail transaksi harian di bawah"
                                    />
                                    <SummaryCard
                                        icon={<IconCoin />}
                                        title="Hak Tenant Harian"
                                        value={formatCurrency(mutationSelectedDaySummary?.tenant_total ?? 0)}
                                        description={`${Number(mutationSelectedDaySummary?.entries_count ?? 0).toLocaleString("id-ID")} mutasi pada hari ini`}
                                    />
                                    <SummaryCard
                                        icon={<IconTrendingUp />}
                                        title="Markup Owner Harian"
                                        value={formatCurrency(mutationSelectedDaySummary?.owner_markup_total ?? 0)}
                                        description={`${Number(mutationSelectedDaySummary?.transactions_count ?? 0).toLocaleString("id-ID")} masuk saldo • ${Number(mutationSelectedDaySummary?.returns_count ?? 0).toLocaleString("id-ID")} retur`}
                                    />
                                </div>

                                <div className="mt-5 overflow-x-auto">
                                    <table className="w-full min-w-[760px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Tanggal</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Mutasi</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {mutationDayRows.map((row, index) => {
                                                const isSelected = row.date_key === mutationSelectedDay;

                                                return (
                                                    <tr key={row.date_key} className={isSelected ? "bg-primary-50/60 dark:bg-primary-950/10" : ""}>
                                                        <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                            {index + 1 + (mutationDayCurrentPage - 1) * mutationDayPerPage}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                {row.date_label}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {Number(row.transactions_count ?? 0).toLocaleString("id-ID")} masuk saldo • {Number(row.returns_count ?? 0).toLocaleString("id-ID")} retur
                                                            </div>
                                                        </td>
                                                        <td className={`px-3 py-3 text-right text-sm font-semibold ${
                                                            Number(row.tenant_total ?? 0) < 0
                                                                ? "text-rose-600 dark:text-rose-300"
                                                                : "text-emerald-600 dark:text-emerald-300"
                                                        }`}>
                                                            {formatCurrency(row.tenant_total ?? 0)}
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                                                            {formatCurrency(row.owner_markup_total ?? 0)}
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                            {Number(row.entries_count ?? 0).toLocaleString("id-ID")}
                                                        </td>
                                                        <td className="px-3 py-3 text-sm">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectMutationDay(row.date_key)}
                                                                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                                    isSelected
                                                                        ? "bg-primary-600 text-white"
                                                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                }`}
                                                            >
                                                                {isSelected ? "Hari aktif" : "Lihat detail"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {mutationDayLinks.length > 3 ? (
                                    <Pagination links={mutationDayLinks} />
                                ) : null}

                                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                Breakdown Detail {mutationSelectedDayLabel || "Hari Terpilih"}
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Daftar transaksi pada hari yang dipilih. Detail ini punya pagination sendiri.
                                            </p>
                                        </div>
                                        {mutationSelectedDaySummary ? (
                                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                    Hak tenant {formatCurrency(mutationSelectedDaySummary.tenant_total ?? 0)}
                                                </span>
                                                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
                                                    Markup owner {formatCurrency(mutationSelectedDaySummary.owner_markup_total ?? 0)}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[840px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">No</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Aktivitas</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Kasir</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Referensi</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hak Tenant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Markup Owner</th>
                                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Waktu</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {mutationRows.length > 0 ? mutationRows.map((row, index) => (
                                                <tr key={row.id}>
                                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                        {index + 1 + (mutationCurrentPage - 1) * mutationPerPage}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {row.invoice}
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {row.reference} • {row.customer_name}
                                                        </div>
                                                        <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                            {row.status}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                        {row.cashier_name}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                        {formatCurrency(row.gross_total ?? 0)}
                                                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                            Promo {formatCurrency(row.discount_total ?? 0)}
                                                        </div>
                                                    </td>
                                                    <td className={`px-3 py-3 text-right text-sm font-semibold ${
                                                        Number(row.mutation_total ?? 0) < 0
                                                            ? "text-rose-600 dark:text-rose-300"
                                                            : "text-emerald-600 dark:text-emerald-300"
                                                    }`}>
                                                        {formatCurrency(row.mutation_total ?? 0)}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                                        {formatCurrency(row.owner_markup_total ?? 0)}
                                                    </td>
                                                    <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                        {row.activity_at}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                        Tidak ada detail mutasi pada hari yang dipilih.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {mutationLinks.length > 3 ? (
                                    <Pagination links={mutationLinks} />
                                ) : null}
                            </div>
                        ) : settlementView === "tenant_mutations" ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                    <IconDatabaseOff size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                                    Tidak Ada Mutasi Harian
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Tidak ada mutasi saldo tenant sesuai scope dan pencarian yang dipilih.
                                </p>
                            </div>
                        ) : settlementView === "owner_markup" && !isTenantWorkspace && ownerMarkupMonthRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                    <IconDatabaseOff size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                                    Tidak Ada Mutasi Markup Owner
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Tidak ada mutasi markup owner pada scope dan periode yang dipilih.
                                </p>
                            </div>
                        ) : settlementView === "cash" && !isTenantWorkspace && settlementExpenseRows.length === 0 && cashHistoryRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                    <IconDatabaseOff size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                                    Tidak Ada Data Kas & Expense
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada expense atau riwayat sisa kas pada scope dan periode yang dipilih.
                                </p>
                            </div>
                        ) : null}
                    </>
                ) : null}

                {showTargetBreakdownModal ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Breakdown Target per Tanggal
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {targets?.period_label ||
                                            "Periode aktif"}{" "}
                                        • lihat tanggal yang sudah memenuhi target dan yang masih tertinggal.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowTargetBreakdownModal(false)
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Tutup
                                </button>
                            </div>

                            <div className="max-h-[75vh] overflow-auto p-6">
                                <div className="mb-4 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Hari memenuhi omzet
                                        </p>
                                        <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                            {targetBreakdownRows
                                                .filter((row) => row.sales_met)
                                                .length.toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Hari memenuhi profit
                                        </p>
                                        <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                            {targetBreakdownRows
                                                .filter((row) => row.profit_met)
                                                .length.toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Hari memenuhi item
                                        </p>
                                        <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                            {targetBreakdownRows
                                                .filter((row) => row.items_met)
                                                .length.toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Tanggal
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Omzet
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Profit
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Item
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                            {targetBreakdownRows.map((row) => (
                                                <tr key={row.date}>
                                                    <td className="px-4 py-3 align-top text-sm font-medium text-slate-900 dark:text-white">
                                                        {row.label}
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-300">
                                                        <div className="font-semibold text-slate-900 dark:text-white">
                                                            {formatCurrency(
                                                                row.sales_actual
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Target{" "}
                                                            {formatCurrency(
                                                                row.sales_target
                                                            )}{" "}
                                                            •{" "}
                                                            {row.sales_progress_percent ??
                                                                0}
                                                            %
                                                        </div>
                                                        <span
                                                            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                row.sales_met
                                                                    ? toneClasses.emerald
                                                                    : toneClasses.rose
                                                            }`}
                                                        >
                                                            {row.sales_met
                                                                ? "Tercapai"
                                                                : "Belum"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-300">
                                                        <div className="font-semibold text-slate-900 dark:text-white">
                                                            {formatCurrency(
                                                                row.profit_actual
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Target{" "}
                                                            {formatCurrency(
                                                                row.profit_target
                                                            )}{" "}
                                                            •{" "}
                                                            {row.profit_progress_percent ??
                                                                0}
                                                            %
                                                        </div>
                                                        <span
                                                            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                row.profit_met
                                                                    ? toneClasses.emerald
                                                                    : toneClasses.rose
                                                            }`}
                                                        >
                                                            {row.profit_met
                                                                ? "Tercapai"
                                                                : "Belum"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-300">
                                                        <div className="font-semibold text-slate-900 dark:text-white">
                                                            {Number(
                                                                row.items_actual ||
                                                                    0
                                                            ).toLocaleString(
                                                                "id-ID"
                                                            )}{" "}
                                                            item
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Target{" "}
                                                            {Number(
                                                                row.items_target ||
                                                                    0
                                                            ).toLocaleString(
                                                                "id-ID"
                                                            )}{" "}
                                                            •{" "}
                                                            {row.items_progress_percent ??
                                                                0}
                                                            %
                                                        </div>
                                                        <span
                                                            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                                row.items_met
                                                                    ? toneClasses.emerald
                                                                    : toneClasses.rose
                                                            }`}
                                                        >
                                                            {row.items_met
                                                                ? "Tercapai"
                                                                : "Belum"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {targetBreakdownRows.length ===
                                            0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={4}
                                                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                                                    >
                                                        Breakdown target belum
                                                        tersedia. Pastikan filter
                                                        tanggal sudah lengkap.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

            </div>
        </>
    );
};

Sales.layout = (page) => <DashboardLayout children={page} />;

export default Sales;
