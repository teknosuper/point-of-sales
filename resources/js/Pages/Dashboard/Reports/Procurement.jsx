import React, { useState } from "react";
import { Head, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconChartBar,
    IconChevronDown,
    IconChevronUp,
    IconFileExport,
    IconReceipt,
    IconSearch,
    IconTruckDelivery,
    IconTruckReturn,
    IconWallet,
} from "@/Utils/icons";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const formatDate = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
          }).format(new Date(value))
        : "-";

const SummaryCard = ({ title, value, icon, tone = "slate" }) => {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{icon}</div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    );
};

const SectionCard = ({ title, description, children }) => (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {title}
            </h2>
            {description ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            ) : null}
        </div>
        {children}
    </div>
);

const StatusBadge = ({ value }) => (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {value || "-"}
    </span>
);

export default function Procurement({
    filters = {},
    summary = {},
    purchaseOrders = [],
    goodsReceivings = [],
    payables = [],
    supplierReturns = [],
    suppliers = [],
    workspace = {},
}) {
    const isTenantMode = workspace?.mode === "tenant";
    const [showFilters, setShowFilters] = useState(false);

    const updateFilters = (payload) => {
        router.get(route("reports.procurement.index"), { ...filters, ...payload }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title="Laporan Procurement" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Laporan Procurement
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isTenantMode
                                ? "Cek PO, penerimaan, hutang, dan retur tenant aktif."
                                : "Cek PO, penerimaan, hutang, dan retur outlet aktif."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            {showFilters ? "Sembunyikan filter" : "Buka filter"}
                        </button>
                        <a
                            href={route("reports.procurement.export", filters)}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                            <IconFileExport size={18} />
                            Export CSV
                        </a>
                    </div>
                </div>

                {workspace?.active_outlet?.name ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        Outlet aktif: <strong>{workspace.active_outlet.name}</strong>
                        {isTenantMode ? " • Mode tenant procurement aktif." : " • Mode owner outlet aktif."}
                    </div>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-5">
                    <SummaryCard
                        title="Nilai PO"
                        value={formatCurrency(summary.purchase_order_total)}
                        icon={<IconReceipt size={18} />}
                        tone="blue"
                    />
                    <SummaryCard
                        title="Nilai Receiving"
                        value={formatCurrency(summary.goods_receiving_total)}
                        icon={<IconTruckDelivery size={18} />}
                        tone="emerald"
                    />
                    <SummaryCard
                        title="Total Hutang"
                        value={formatCurrency(summary.payable_total)}
                        icon={<IconWallet size={18} />}
                        tone="amber"
                    />
                    <SummaryCard
                        title="Sudah Dibayar"
                        value={formatCurrency(summary.payable_paid_total)}
                        icon={<IconChartBar size={18} />}
                        tone="slate"
                    />
                    <SummaryCard
                        title="Retur Supplier"
                        value={formatCurrency(summary.supplier_return_total)}
                        icon={<IconTruckReturn size={18} />}
                        tone="rose"
                    />
                </div>

                {showFilters ? (
                <SectionCard
                    title="Filter Procurement"
                    description="Gunakan hanya saat perlu mempersempit audit procurement."
                >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <input
                            type="date"
                            value={filters.start_date || ""}
                            onChange={(event) => updateFilters({ start_date: event.target.value })}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                        <input
                            type="date"
                            value={filters.end_date || ""}
                            onChange={(event) => updateFilters({ end_date: event.target.value })}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                        <select
                            value={filters.supplier_id || ""}
                            onChange={(event) => updateFilters({ supplier_id: event.target.value })}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="">Semua Supplier</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={filters.search || ""}
                            onChange={(event) => updateFilters({ search: event.target.value })}
                            placeholder="Cari dokumen"
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                        <select
                            value={filters.po_status || ""}
                            onChange={(event) => updateFilters({ po_status: event.target.value })}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="">Semua Status PO</option>
                            <option value="draft">draft</option>
                            <option value="ordered">ordered</option>
                            <option value="partial_received">partial_received</option>
                            <option value="completed">completed</option>
                            <option value="cancelled">cancelled</option>
                        </select>
                        <select
                            value={filters.payable_status || ""}
                            onChange={(event) => updateFilters({ payable_status: event.target.value })}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="">Semua Status Hutang</option>
                            <option value="unpaid">unpaid</option>
                            <option value="partial">partial</option>
                            <option value="paid">paid</option>
                            <option value="overdue">overdue</option>
                        </select>
                    </div>
                </SectionCard>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-2">
                    <SectionCard title="Purchase Order" description="10 PO terbaru sesuai filter aktif.">
                        <div className="space-y-3">
                            {purchaseOrders.length ? purchaseOrders.map((order) => (
                                <div key={order.id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">{order.document_number}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {order.supplier_name || "Tanpa Supplier"} • {order.creator_name || "-"}
                                            </p>
                                            <p className="text-xs text-slate-400">{formatDate(order.ordered_at || order.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <StatusBadge value={order.status} />
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(order.total_amount)}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data PO.</p>}
                        </div>
                    </SectionCard>

                    <SectionCard title="Penerimaan Barang" description="10 receiving terbaru sesuai filter aktif.">
                        <div className="space-y-3">
                            {goodsReceivings.length ? goodsReceivings.map((receiving) => (
                                <div key={receiving.id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">{receiving.document_number}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {receiving.supplier_name || "Tanpa Supplier"} • PO {receiving.purchase_order_number || "-"}
                                            </p>
                                            <p className="text-xs text-slate-400">{formatDate(receiving.received_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(receiving.total_amount)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{receiving.items_count} item</p>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data receiving.</p>}
                        </div>
                    </SectionCard>

                    <SectionCard title="Hutang Supplier" description="10 hutang supplier terbaru sesuai filter aktif.">
                        <div className="space-y-3">
                            {payables.length ? payables.map((payable) => (
                                <div key={payable.id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">{payable.document_number}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{payable.supplier_name || "Tanpa Supplier"}</p>
                                            <p className="text-xs text-slate-400">Jatuh tempo {formatDate(payable.due_date)}</p>
                                        </div>
                                        <div className="text-right">
                                            <StatusBadge value={payable.status} />
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(payable.total)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Sisa {formatCurrency(payable.remaining)}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data hutang supplier.</p>}
                        </div>
                    </SectionCard>

                    <SectionCard title="Retur Supplier" description="10 retur supplier terbaru sesuai filter aktif.">
                        <div className="space-y-3">
                            {supplierReturns.length ? supplierReturns.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">{item.document_number}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {item.supplier_name || "Tanpa Supplier"} • {item.creator_name || "-"}
                                            </p>
                                            <p className="text-xs text-slate-400">{formatDate(item.returned_at || item.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <StatusBadge value={item.status} />
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(item.total_amount)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.items_count} item</p>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data retur supplier.</p>}
                        </div>
                    </SectionCard>
                </div>
            </div>
        </>
    );
}

Procurement.layout = (page) => <DashboardLayout children={page} />;
