import React, { useEffect, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

export default function OutletAnalytics({
    filters = {},
    summary = {},
    outletStats = [],
    tenantStats = [],
    outlets = [],
    selectedOutlet = null,
}) {
    const [filterData, setFilterData] = useState({
        start_date: filters?.start_date || "",
        end_date: filters?.end_date || "",
        outlet_id: filters?.outlet_id || "",
    });

    useEffect(() => {
        setFilterData({
            start_date: filters?.start_date || "",
            end_date: filters?.end_date || "",
            outlet_id: filters?.outlet_id || "",
        });
    }, [filters]);

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("reports.outlet-analytics.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <>
            <Head title="Statistik Outlet & Tenant" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Statistik Outlet / Tenant
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Ringkasan performa bisnis per outlet dan tenant. Halaman ini fokus ke angka, bukan ke pengaturan dapur atau printer.
                    </p>
                    {selectedOutlet ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                            Fokus outlet: {selectedOutlet.name} ({selectedOutlet.code})
                        </div>
                    ) : null}
                </div>

                <form
                    onSubmit={applyFilters}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="grid gap-4 md:grid-cols-4">
                        <select
                            value={filterData.outlet_id}
                            onChange={(event) => setFilterData((prev) => ({ ...prev, outlet_id: event.target.value }))}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="">Semua outlet / tenant</option>
                            {outlets.map((outlet) => (
                                <option key={outlet.id} value={String(outlet.id)}>
                                    {outlet.name} ({outlet.code})
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={filterData.start_date}
                            onChange={(event) => setFilterData((prev) => ({ ...prev, start_date: event.target.value }))}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                        <input
                            type="date"
                            value={filterData.end_date}
                            onChange={(event) => setFilterData((prev) => ({ ...prev, end_date: event.target.value }))}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                        <button type="submit" className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white">
                            Terapkan Filter
                        </button>
                    </div>
                </form>

                {selectedOutlet ? (
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={route("guides.outlet-kitchen")}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Panduan Lengkap
                        </Link>
                        <Link
                            href={route("outlets.show", selectedOutlet.id)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Lihat Detail Outlet
                        </Link>
                        <Link
                            href={route("settings.kitchen-devices.index", { outlet_id: selectedOutlet.id })}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Buka Operasional Dapur & Printer
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={route("guides.outlet-kitchen")}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Panduan Lengkap
                        </Link>
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    {[
                        ["Total Outlet", summary.outlets_total ?? 0, false],
                        ["Outlet Aktif", summary.active_outlets_total ?? 0, false],
                        ["Total Transaksi", summary.transactions_total ?? 0, false],
                        ["Revenue Outlet", summary.revenue_total ?? 0, true],
                        ["Revenue Tenant", summary.tenant_revenue_total ?? 0, true],
                        ["Payout Tenant", summary.tenant_payout_total ?? 0, true],
                    ].map(([label, value, currency]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                {currency ? formatCurrency(value) : value}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            Statistik Outlet
                        </h2>
                        <div className="space-y-3">
                            {outletStats.map((outlet) => (
                                <div key={outlet.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                {outlet.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {outlet.code} • {outlet.city || "Tanpa kota"}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${outlet.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                                            {outlet.is_active ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-4">
                                        <span>Revenue: {formatCurrency(outlet.revenue_total)}</span>
                                        <span>Transaksi: {outlet.transactions_count}</span>
                                        <span>Shift: {outlet.shifts_count}</span>
                                        <span>Station: {outlet.stations_count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                            Statistik Tenant
                        </h2>
                        <div className="space-y-3">
                            {tenantStats.map((tenant) => (
                                <div key={tenant.tenant_outlet_id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                {tenant.tenant_name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {tenant.tenant_code}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                            {tenant.orders_count} nota
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                                        <span>Revenue: {formatCurrency(tenant.revenue_total)}</span>
                                        <span>Cost: {formatCurrency(tenant.cost_total)}</span>
                                        <span>Profit: {formatCurrency(tenant.profit_total)}</span>
                                        <span>Fee: {formatCurrency(tenant.management_fee_total)}</span>
                                        <span className="md:col-span-2">Payout: {formatCurrency(tenant.payout_total)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

OutletAnalytics.layout = (page) => <DashboardLayout children={page} />;
