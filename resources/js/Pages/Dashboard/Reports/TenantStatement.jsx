import React, { useEffect, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconArrowLeft,
    IconBuildingStore,
    IconCash,
    IconChartBar,
    IconDownload,
    IconFilter,
    IconPrinter,
    IconReceipt2,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const defaultFilters = {
    start_date: "",
    end_date: "",
    settlement_status: "",
};

function SummaryCard({ title, value, icon, tone = "slate" }) {
    const tones = {
        slate: "bg-slate-50 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
        emerald:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300",
        rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300",
        teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-300",
        violet:
            "bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-300",
    };

    return (
        <div className={`rounded-2xl p-4 ${tones[tone]}`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                {icon}
                <span>{title}</span>
            </div>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}

export default function TenantStatement({
    tenantOutlet,
    summary,
    allocations,
    dailyRecap = [],
    filters,
}) {
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...filters,
    });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            ...filters,
        });
    }, [filters]);

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(
            route("reports.sales.tenant-statement", tenantOutlet.id),
            filterData,
            {
                preserveScroll: true,
                preserveState: true,
            }
        );
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(
            route("reports.sales.tenant-statement", tenantOutlet.id),
            defaultFilters,
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            }
        );
    };

    const rows = allocations?.data ?? [];
    const links = allocations?.links ?? [];
    const exportQuery = new URLSearchParams(
        Object.entries(filterData).filter(([, value]) => value !== "")
    ).toString();

    return (
        <>
            <Head title={`Statement Tenant ${tenantOutlet?.name || ""}`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link
                            href={route("reports.sales.index")}
                            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <IconArrowLeft size={16} />
                            Kembali ke laporan penjualan
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                                <IconBuildingStore size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {tenantOutlet?.name}
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {tenantOutlet?.code || "Tenant"}
                                    {" • "}
                                    Komisi pengelola {tenantOutlet?.commission_rate_percent ?? 0}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={`${route(
                                "reports.sales.tenant-statement.export",
                                tenantOutlet.id
                            )}${exportQuery ? `?${exportQuery}` : ""}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconDownload size={18} />
                            Export CSV
                        </Link>
                        <a
                            href={`${route("reports.sales.tenant-settlement.print")}?tenant_outlet_id=${tenantOutlet.id}${exportQuery ? `&${exportQuery}&autoprint=1` : "&autoprint=1"}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconPrinter size={18} />
                            Cetak Batch
                        </a>
                        <button
                            onClick={() => setShowFilters((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconFilter size={18} />
                            Filter
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard
                        title="Revenue"
                        value={formatCurrency(summary?.revenue_total ?? 0)}
                        icon={<IconReceipt2 size={18} />}
                    />
                    <SummaryCard
                        title="Profit"
                        value={formatCurrency(summary?.profit_total ?? 0)}
                        icon={<IconChartBar size={18} />}
                        tone="violet"
                    />
                    <SummaryCard
                        title="Management Fee"
                        value={formatCurrency(
                            summary?.management_fee_total ?? 0
                        )}
                        icon={<IconCash size={18} />}
                        tone="rose"
                    />
                    <SummaryCard
                        title="Payout Tenant"
                        value={formatCurrency(
                            summary?.tenant_payout_total ?? 0
                        )}
                        icon={<IconCash size={18} />}
                        tone="teal"
                    />
                    <SummaryCard
                        title="Outstanding"
                        value={formatCurrency(
                            summary?.outstanding_total ?? 0
                        )}
                        icon={<IconCash size={18} />}
                        tone="emerald"
                    />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                            Rekap Harian Tenant
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Ringkasan payout dan outstanding tenant per hari.
                        </p>
                    </div>
                    {dailyRecap.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Tanggal</th>
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
                            Belum ada rekap harian pada filter ini.
                        </div>
                    )}
                </div>

                {showFilters && (
                    <form
                        onSubmit={applyFilters}
                        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tanggal Mulai
                                </label>
                                <input
                                    type="date"
                                    value={filterData.start_date}
                                    onChange={(e) =>
                                        setFilterData((prev) => ({
                                            ...prev,
                                            start_date: e.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tanggal Akhir
                                </label>
                                <input
                                    type="date"
                                    value={filterData.end_date}
                                    onChange={(e) =>
                                        setFilterData((prev) => ({
                                            ...prev,
                                            end_date: e.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Settlement
                                </label>
                                <select
                                    value={filterData.settlement_status}
                                    onChange={(e) =>
                                        setFilterData((prev) => ({
                                            ...prev,
                                            settlement_status: e.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua status</option>
                                    <option value="outstanding">
                                        Outstanding
                                    </option>
                                    <option value="settled">Settled</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                Reset
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                            >
                                Terapkan
                            </button>
                        </div>
                    </form>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                        Nota
                                    </th>
                                    <th className="px-4 py-4 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                        Item
                                    </th>
                                    <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                        Revenue
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
                                    <th className="px-4 py-4 text-center text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rows.map((allocation) => (
                                    <tr
                                        key={allocation.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                        <td className="px-4 py-4">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {allocation.transaction?.invoice}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {allocation.transaction?.created_at}
                                            </p>
                                            {allocation.payout_reference ? (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    Ref: {allocation.payout_reference}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-300">
                                            {allocation.total_items ?? 0}
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(
                                                allocation.grand_total ?? 0
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm font-medium text-violet-600 dark:text-violet-300">
                                            {formatCurrency(
                                                allocation.profit_total ?? 0
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm font-medium text-rose-600 dark:text-rose-300">
                                            {formatCurrency(
                                                allocation.management_fee_total ??
                                                    0
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm font-bold text-teal-600 dark:text-teal-300">
                                            {formatCurrency(
                                                allocation.tenant_payout_total ??
                                                    0
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    allocation.settled_at
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                }`}
                                            >
                                                {allocation.settled_at
                                                    ? "Settled"
                                                    : "Outstanding"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {links.length > 3 && <Pagination links={links} />}
            </div>
        </>
    );
}

TenantStatement.layout = (page) => <DashboardLayout children={page} />;
