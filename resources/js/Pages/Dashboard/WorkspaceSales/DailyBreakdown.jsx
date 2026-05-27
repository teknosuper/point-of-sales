import React from "react";
import { Head, Link } from "@inertiajs/react";
import KitchenLayout from "@/Layouts/KitchenLayout";
import { IconArrowLeft, IconCalendarStats, IconDownload, IconReceipt2 } from "@/Utils/icons";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

export default function DailyBreakdown({ rows = [], summary = {}, filters = {}, meta = {} }) {
    return (
        <>
            <Head title="Breakdown Harian Tenant" />

            <div className="space-y-6">
                <div>
                    <Link href={route("workspace-sales.index", filters)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                        <IconArrowLeft size={16} />
                        Kembali ke workspace sales
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                            <IconCalendarStats size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Breakdown Harian Tenant</h1>
                            <p className="text-sm text-slate-500">Detail penjualan per hari untuk {meta?.outlet?.name || "outlet aktif"}.</p>
                        </div>
                        </div>
                        <a href={route("workspace-sales.daily-breakdown.export", filters)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <IconDownload size={16} />
                            Export CSV
                        </a>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Hari</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{summary?.days_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Transaksi</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{summary?.orders_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Penjualan</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(summary?.sales_total ?? 0)}</p>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <IconReceipt2 size={20} className="text-primary-500" />
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Penjualan Per Hari</h2>
                            <p className="text-sm text-slate-500">Urutan terbaru di atas.</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-left text-slate-500">
                                    <th className="px-4 py-3">Tanggal</th>
                                    <th className="px-4 py-3 text-right">Transaksi</th>
                                    <th className="px-4 py-3 text-right">Tunai</th>
                                    <th className="px-4 py-3 text-right">Non Tunai</th>
                                    <th className="px-4 py-3 text-right">Rata-rata Order</th>
                                    <th className="px-4 py-3 text-right">Penjualan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.date} className="border-b border-slate-100">
                                        <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                                        <td className="px-4 py-3 text-right">{row.orders_count}</td>
                                        <td className="px-4 py-3 text-right">{row.cash_count}</td>
                                        <td className="px-4 py-3 text-right">{row.non_cash_count}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(row.average_order)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-primary-600">{formatCurrency(row.sales_total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

DailyBreakdown.layout = (page) => <KitchenLayout children={page} />;
