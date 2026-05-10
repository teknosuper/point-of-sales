import React, { useEffect, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconArrowLeft,
    IconBuildingStore,
    IconClipboardCheck,
    IconCurrencyDollar,
    IconDeviceDesktop,
    IconReceipt2,
    IconUsers,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

export default function Show({
    outlet,
    filters = {},
    summary = {},
    recentTransactions = [],
    recentAllocations = [],
    stations = [],
    tenantBreakdown = [],
    tenantSettlement = null,
}) {
    const { flash } = usePage().props;
    const [filterData, setFilterData] = useState({
        start_date: filters?.start_date || "",
        end_date: filters?.end_date || "",
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    useEffect(() => {
        setFilterData({
            start_date: filters?.start_date || "",
            end_date: filters?.end_date || "",
        });
    }, [filters]);

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("outlets.show", outlet.id), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <>
            <Head title={`Outlet & Tenant - ${outlet?.name || ""}`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <Link
                            href={route("outlets.index")}
                            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <IconArrowLeft size={16} />
                            Kembali ke manage outlet
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                                <IconBuildingStore size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {outlet?.name}
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {outlet?.code} • {outlet?.outlet_type || "main"} • {outlet?.city || "Tanpa kota"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-3">
                        <input
                            type="date"
                            value={filterData.start_date}
                            onChange={(event) =>
                                setFilterData((prev) => ({ ...prev, start_date: event.target.value }))
                            }
                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        <input
                            type="date"
                            value={filterData.end_date}
                            onChange={(event) =>
                                setFilterData((prev) => ({ ...prev, end_date: event.target.value }))
                            }
                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        <button
                            type="submit"
                            className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                        >
                            Terapkan Filter
                        </button>
                    </form>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Halaman ini menunjukkan performa dan kepemilikan outlet atau tenant. Untuk mengatur printer, stasiun dapur, dan perangkat dapur milik outlet ini, lanjutkan ke menu <span className="font-semibold">Operasional Dapur & Printer</span>.
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link
                        href={route("guides.outlet-kitchen")}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        Panduan Lengkap
                    </Link>
                    <Link
                        href={route("settings.kitchen-devices.index", { outlet_id: outlet.id })}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        Operasional Dapur & Printer Outlet Ini
                    </Link>
                    <Link
                        href={route("reports.outlet-analytics.index", { outlet_id: outlet.id })}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        Statistik Outlet Ini
                    </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
                    {[
                        ["Transaksi", summary.transactions_total ?? 0, false, <IconReceipt2 size={18} />],
                        ["Revenue", summary.revenue_total ?? 0, true, <IconCurrencyDollar size={18} />],
                        ["Item Terjual", summary.items_sold ?? 0, false, <IconClipboardCheck size={18} />],
                        ["User", summary.users_total ?? 0, false, <IconUsers size={18} />],
                        ["Station", summary.stations_total ?? 0, false, <IconClipboardCheck size={18} />],
                        ["Device", summary.devices_total ?? 0, false, <IconDeviceDesktop size={18} />],
                        ["Settled", summary.settled_total ?? 0, true, <IconClipboardCheck size={18} />],
                        ["Outstanding", summary.outstanding_total ?? 0, true, <IconClipboardCheck size={18} />],
                    ].map(([label, value, isCurrency, icon]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                {icon}
                                <span>{label}</span>
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {isCurrency ? formatCurrency(value) : value}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            User Outlet
                        </h2>
                        <div className="space-y-3">
                            {outlet?.users?.length ? (
                                outlet.users.map((user) => (
                                    <div key={user.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {user.email}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada user yang diassign ke outlet ini.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            Station & Device
                        </h2>
                        <div className="space-y-3">
                            {stations.length ? (
                                stations.map((station) => (
                                    <div key={station.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                            {station.name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {station.code || "-"} • {station.display_mode} • {station.devices?.length || 0} device
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada station dapur untuk outlet ini.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            Transaksi Terbaru
                        </h2>
                        <div className="space-y-3">
                            {recentTransactions.length ? (
                                recentTransactions.map((transaction) => (
                                    <div key={transaction.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                    {transaction.invoice}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {transaction.cashier?.name || "Kasir"} • {transaction.customer?.name || "Walk-in"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-primary-600 dark:text-primary-300">
                                                    {formatCurrency(transaction.grand_total)}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {transaction.payment_status}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada transaksi pada rentang ini.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            {outlet?.outlet_type === "tenant" ? "Settlement Tenant" : "Breakdown Tenant"}
                        </h2>
                        {outlet?.outlet_type === "tenant" ? (
                            tenantSettlement ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {[
                                        ["Nota", tenantSettlement.orders_count],
                                        ["Revenue", formatCurrency(tenantSettlement.revenue_total)],
                                        ["Cost", formatCurrency(tenantSettlement.cost_total)],
                                        ["Profit", formatCurrency(tenantSettlement.profit_total)],
                                        ["Fee", formatCurrency(tenantSettlement.management_fee_total)],
                                        ["Payout", formatCurrency(tenantSettlement.payout_total)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada settlement tenant pada rentang ini.
                                </p>
                            )
                        ) : tenantBreakdown.length ? (
                            <div className="space-y-3">
                                {tenantBreakdown.map((tenant) => (
                                    <div key={tenant.tenant_outlet_id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                    {tenant.tenant_name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {tenant.tenant_code}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-primary-600 dark:text-primary-300">
                                                    {formatCurrency(tenant.revenue_total)}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {tenant.orders_count} nota
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Belum ada breakdown tenant pada rentang ini.
                            </p>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                        Allocation & Settlement Terbaru
                    </h2>
                    <div className="space-y-3">
                        {recentAllocations.length ? (
                            recentAllocations.map((allocation) => (
                                <div
                                    key={allocation.id}
                                    className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                {allocation.allocation_number}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {allocation.transaction?.invoice || "-"} •{" "}
                                                {allocation.tenantOutlet?.name || "Tenant"} •{" "}
                                                {allocation.payment_status}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-300">
                                                {formatCurrency(allocation.grand_total)}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {allocation.settled_at ? "Settled" : "Outstanding"}
                                                {allocation.payout_reference
                                                    ? ` • Ref ${allocation.payout_reference}`
                                                    : ""}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Belum ada allocation tenant pada rentang ini.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
