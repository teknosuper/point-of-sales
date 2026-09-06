import React, { useEffect, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDate = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
          }).format(new Date(value))
        : "-";

export default function Index({ salesReturns, filters, canViewMarkup, isTenantWorkspace }) {
    const [form, setForm] = useState({
        code: filters.code || "",
        invoice: filters.invoice || "",
        date_from: filters.date_from || "",
        date_to: filters.date_to || "",
        return_type: filters.return_type || "",
    });
    const [detailItem, setDetailItem] = useState(null);

    useEffect(() => {
        setForm({
            code: filters.code || "",
            invoice: filters.invoice || "",
            date_from: filters.date_from || "",
            date_to: filters.date_to || "",
            return_type: filters.return_type || "",
        });
    }, [filters]);

    const submit = (event) => {
        event.preventDefault();
        router.get(route("sales-returns.index"), form, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const rows = salesReturns.data || [];

    return (
        <>
            <Head title="Retur Penjualan" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Retur Penjualan
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Histori retur penjualan berdasarkan transaksi asal.
                    </p>
                </div>

                <form
                    onSubmit={submit}
                    className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-5 dark:border-slate-800 dark:bg-slate-900"
                >
                    <input
                        type="text"
                        value={form.code}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                code: event.target.value,
                            }))
                        }
                        placeholder="Kode retur"
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                        type="text"
                        value={form.invoice}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                invoice: event.target.value,
                            }))
                        }
                        placeholder="Invoice transaksi"
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                        type="date"
                        value={form.date_from}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                date_from: event.target.value,
                            }))
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                        type="date"
                        value={form.date_to}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                date_to: event.target.value,
                            }))
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="flex gap-2">
                        <select
                            value={form.return_type}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    return_type: event.target.value,
                                }))
                            }
                            className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="">Semua metode</option>
                            <option value="refund_cash">Refund Tunai</option>
                            <option value="store_credit">Saldo Toko</option>
                        </select>
                        <button
                            type="submit"
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
                        >
                            Filter
                        </button>
                    </div>
                </form>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                            <tr>
                                <th className="px-4 py-3 text-left">Kode</th>
                                <th className="px-4 py-3 text-left">Invoice</th>
                                <th className="px-4 py-3 text-left">Tanggal</th>
                                <th className="px-4 py-3 text-left">Pelanggan</th>
                                <th className="px-4 py-3 text-left">Metode</th>
                                <th className="px-4 py-3 text-right">Nominal</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.length > 0 ? (
                                rows.map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                                            {item.code}
                                        </td>
                                        <td className="px-4 py-4">
                                            {item.transaction?.invoice || "-"}
                                        </td>
                                        <td className="px-4 py-4">
                                            {formatDate(item.created_at)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="space-y-2">
                                                <p>
                                                    {item.customer?.name ||
                                                        "Umum / Walk-in"}
                                                </p>
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                                                        item.customer_id
                                                            ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                                                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                                    }`}
                                                >
                                                    {item.customer_id
                                                        ? "Customer"
                                                        : "Walk-in"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {item.return_type === "store_credit"
                                                ? "Saldo Toko"
                                                : "Refund Tunai"}
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(
                                                item.total_return_amount
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                    item.status === "completed"
                                                        ? "bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400"
                                                        : "bg-warning-100 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400"
                                                }`}
                                            >
                                                {item.status === "completed"
                                                    ? "Completed"
                                                    : "Draft"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setDetailItem(item)}
                                                    className="inline-flex rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                >
                                                    Detail
                                                </button>
                                                <Link
                                                    href={route(
                                                        "sales-returns.show",
                                                        item.id
                                                    )}
                                                    className="inline-flex rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300"
                                                >
                                                    Lihat
                                                </Link>
                                                {item.status === "draft" && (
                                                    <Link
                                                        href={route(
                                                            "sales-returns.destroy",
                                                            item.id
                                                        )}
                                                        method="delete"
                                                        as="button"
                                                        onClick={(event) => {
                                                            if (! confirm('Hapus draft retur ini?')) {
                                                                event.preventDefault();
                                                            }
                                                        }}
                                                        className="inline-flex rounded-lg bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 hover:bg-danger-100 dark:bg-danger-950/30 dark:text-danger-300"
                                                    >
                                                        Hapus
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-4 py-16 text-center text-slate-500 dark:text-slate-400"
                                    >
                                        Belum ada retur penjualan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {salesReturns.links?.length > 3 && (
                    <Pagination links={salesReturns.links} />
                )}
            </div>

            {detailItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setDetailItem(null)}
                >
                    <div
                        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Detail Retur — {detailItem.code}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Invoice: {detailItem.transaction?.invoice || "-"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailItem(null)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                        detailItem.status === "completed"
                                            ? "bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400"
                                            : "bg-warning-100 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400"
                                    }`}>
                                        {detailItem.status === "completed" ? "Completed" : "Draft"}
                                    </span>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Metode</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                        {detailItem.return_type === "store_credit" ? "Saldo Toko" : "Refund Tunai"}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tanggal</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatDate(detailItem.created_at)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                                    <p className="text-xs text-blue-600 dark:text-blue-400">Gross Return</p>
                                    <p className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">
                                        {formatCurrency(detailItem.gross_return_total ?? detailItem.total_return_amount)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Hak Tenant</p>
                                    <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                        {formatCurrency(detailItem.tenant_rights_return_total ?? 0)}
                                    </p>
                                </div>
                                {canViewMarkup && (
                                    <div className="rounded-xl border border-slate-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
                                        <p className="text-xs text-rose-600 dark:text-rose-400">Markup Owner</p>
                                        <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">
                                            {formatCurrency(detailItem.owner_markup_return_total ?? 0)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Produk</th>
                                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Qty Retur</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Gross</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Hak Tenant</th>
                                            {canViewMarkup && (
                                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Markup</th>
                                            )}
                                            {isTenantWorkspace && (
                                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Tenant</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {detailItem.items?.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-slate-900 dark:text-white">{row.product?.title || "-"}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{row.product?.sku || ""}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">{row.qty_return}</td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(row.gross_subtotal ?? row.subtotal)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-emerald-700 dark:text-emerald-400">
                                                    {formatCurrency(row.tenant_net_subtotal ?? 0)}
                                                </td>
                                                {canViewMarkup && (
                                                    <td className="px-4 py-3 text-right font-medium text-rose-700 dark:text-rose-400">
                                                        {formatCurrency(row.owner_markup_subtotal ?? 0)}
                                                    </td>
                                                )}
                                                {isTenantWorkspace && (
                                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                        {row.tenant_name || "-"}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {detailItem.notes && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Catatan</p>
                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{detailItem.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
