import React from "react";
import { Head, Link } from "@inertiajs/react";
import KitchenLayout from "@/Layouts/KitchenLayout";
import { IconArrowLeft, IconDownload, IconShoppingBag } from "@/Utils/icons";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const toneClass = {
    "Laku": "bg-emerald-100 text-emerald-700",
    "Kurang laku": "bg-amber-100 text-amber-700",
    "Tidak laku": "bg-rose-100 text-rose-700",
};

export default function ProductBreakdown({ rows = [], productPerformance = {}, filters = {}, meta = {} }) {
    return (
        <>
            <Head title="Breakdown Produk Tenant" />

            <div className="space-y-6">
                <div>
                    <Link href={route("workspace-sales.index", filters)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                        <IconArrowLeft size={16} />
                        Kembali ke workspace sales
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-primary-50 p-3 text-primary-600">
                            <IconShoppingBag size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Breakdown Produk Tenant</h1>
                            <p className="text-sm text-slate-500">Detail performa produk untuk {meta?.outlet?.name || "outlet aktif"}.</p>
                        </div>
                        </div>
                        <a href={route("workspace-sales.product-breakdown.export", filters)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <IconDownload size={16} />
                            Export CSV
                        </a>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Produk Aktif</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{productPerformance?.catalog_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Produk Laku</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{productPerformance?.sold_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kurang Laku</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{productPerformance?.slow_movers?.length ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tidak Laku</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{productPerformance?.unsold_count ?? 0}</p>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Semua Produk pada Filter Aktif</h2>
                        <p className="text-sm text-slate-500">Urut dari yang paling banyak terjual.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-left text-slate-500">
                                    <th className="px-4 py-3">Produk</th>
                                    <th className="px-4 py-3 text-right">Qty Terjual</th>
                                    <th className="px-4 py-3 text-right">Omzet</th>
                                    <th className="px-4 py-3 text-right">Kontribusi</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.product_id} className="border-b border-slate-100">
                                        <td className="px-4 py-3 font-medium text-slate-900">{row.product_title}</td>
                                        <td className="px-4 py-3 text-right">{row.sold_qty}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-primary-600">{formatCurrency(row.sold_value)}</td>
                                        <td className="px-4 py-3 text-right">{row.share_percentage}%</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClass[row.status_label] || "bg-slate-100 text-slate-700"}`}>
                                                {row.status_label}
                                            </span>
                                        </td>
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

ProductBreakdown.layout = (page) => <KitchenLayout children={page} />;
