import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router, usePage } from "@inertiajs/react";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconAdjustments,
    IconArrowBigDown,
    IconArrowBigUp,
    IconChevronDown,
    IconChevronUp,
    IconHistory,
    IconPackages,
} from "@tabler/icons-react";

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(new Date(value))
        : "-";

export default function Index({ stockMutations, products, filters, summary = {} }) {
    const { activeOutlet } = usePage().props;
    const isTenantMode = activeOutlet?.outlet_type === "tenant";
    const [showFilters, setShowFilters] = useState(false);
    const updateFilter = (key, value) => {
        router.get(
            route("stock-mutations.index"),
            {
                ...filters,
                [key]: value,
            },
            {
                preserveState: true,
                replace: true,
            }
        );
    };

    return (
        <>
            <Head title="Mutasi Stok" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Mutasi Stok
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isTenantMode
                        ? "Cek perubahan stok produk tenant pada outlet aktif."
                        : "Cek perubahan stok masuk, keluar, dan penyesuaian."}
                </p>
            </div>

            {isTenantMode ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                    Mode tenant aktif. Filter produk pada halaman ini hanya menampilkan produk milik <strong>{activeOutlet?.name}</strong>.
                </div>
            ) : null}

            <div className="mb-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                            <IconPackages size={20} className="text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Stok Saat Ini</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.current_stock_total || 0))}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <IconArrowBigDown size={20} className="text-emerald-600 dark:text-emerald-300" />
                        </div>
                        <div>
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">Inbound</p>
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.inbound_qty || 0))}
                            </p>
                            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.inbound_rows || 0))} mutasi
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-rose-100 p-3 dark:bg-rose-900/30">
                            <IconArrowBigUp size={20} className="text-rose-600 dark:text-rose-300" />
                        </div>
                        <div>
                            <p className="text-sm text-rose-700 dark:text-rose-300">Outbound</p>
                            <p className="text-2xl font-bold text-rose-700 dark:text-rose-200">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.outbound_qty || 0))}
                            </p>
                            <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.outbound_rows || 0))} mutasi
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-amber-100 p-3 dark:bg-amber-900/30">
                            <IconAdjustments size={20} className="text-amber-600 dark:text-amber-300" />
                        </div>
                        <div>
                            <p className="text-sm text-amber-700 dark:text-amber-300">Adjustment</p>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-200">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.adjustment_qty || 0))}
                            </p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                                {new Intl.NumberFormat("id-ID").format(Number(summary.adjustment_rows || 0))} mutasi
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                            Filter mutasi
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Buka saat perlu mencari produk atau periode tertentu.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowFilters((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        {showFilters ? "Sembunyikan" : "Buka filter"}
                    </button>
                </div>

                {showFilters ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <select
                    value={filters.product_id || ""}
                    onChange={(event) =>
                        updateFilter("product_id", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    <option value="">Semua Produk</option>
                    {products.map((product) => (
                        <option key={product.id} value={product.id}>
                            {product.title}
                        </option>
                    ))}
                </select>

                <select
                    value={filters.mutation_type || ""}
                    onChange={(event) =>
                        updateFilter("mutation_type", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    <option value="">Semua Tipe</option>
                    <option value="in">In</option>
                    <option value="out">Out</option>
                    <option value="adjustment">Adjustment</option>
                </select>

                <input
                    type="date"
                    value={filters.date_from || ""}
                    onChange={(event) =>
                        updateFilter("date_from", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />

                <input
                    type="date"
                    value={filters.date_to || ""}
                    onChange={(event) =>
                        updateFilter("date_to", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                </div>
                ) : null}
            </div>

            <Table.Card title="Histori Mutasi Stok">
                <Table>
                    <Table.Thead>
                        <tr>
                            <Table.Th>Produk</Table.Th>
                            <Table.Th>Tipe</Table.Th>
                            <Table.Th>Qty</Table.Th>
                            <Table.Th>Before / After</Table.Th>
                            <Table.Th>Referensi</Table.Th>
                            <Table.Th>Dibuat Oleh</Table.Th>
                            <Table.Th>Waktu</Table.Th>
                        </tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {stockMutations.data.length > 0 ? (
                            stockMutations.data.map((mutation) => (
                                <tr
                                    key={mutation.id}
                                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                    <Table.Td>
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">
                                                {mutation.product?.title || "-"}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {mutation.product?.barcode || mutation.product?.sku || "-"}
                                            </p>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            {mutation.mutation_type}
                                        </span>
                                    </Table.Td>
                                    <Table.Td>{mutation.qty}</Table.Td>
                                    <Table.Td>
                                        {mutation.stock_before} → {mutation.stock_after}
                                    </Table.Td>
                                    <Table.Td>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {mutation.reference_type}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {mutation.notes || "-"}
                                            </p>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>{mutation.creator?.name || "-"}</Table.Td>
                                    <Table.Td>{formatDateTime(mutation.created_at)}</Table.Td>
                                </tr>
                            ))
                        ) : (
                            <Table.Empty
                                colSpan={7}
                                message={
                                    <div className="text-slate-500 dark:text-slate-400">
                                        Belum ada mutasi stok.
                                    </div>
                                }
                            >
                                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                    <IconHistory size={28} className="text-slate-400" />
                                </div>
                            </Table.Empty>
                        )}
                    </Table.Tbody>
                </Table>
            </Table.Card>

            {stockMutations.last_page > 1 && (
                <Pagination links={stockMutations.links} />
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
