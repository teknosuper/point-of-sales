import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router, usePage } from "@inertiajs/react";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import Modal from "@/Components/Dashboard/Modal";
import {
    IconAdjustments,
    IconArrowBigDown,
    IconArrowBigUp,
    IconChevronDown,
    IconChevronUp,
    IconHistory,
    IconInfoCircle,
    IconPackages,
} from "@/Utils/icons";

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
    const [showHelpModal, setShowHelpModal] = useState(false);
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

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Mutasi Stok
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isTenantMode
                            ? "Cek perubahan stok produk tenant pada outlet aktif."
                            : "Cek perubahan stok masuk, keluar, dan penyesuaian."}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/40"
                >
                    <IconInfoCircle size={16} />
                    Bantuan
                </button>
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

            <Modal
                show={showHelpModal}
                onClose={() => setShowHelpModal(false)}
                title="Bantuan Mutasi Stok"
                maxWidth="2xl"
            >
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Fungsi Mutasi Stok
                        </p>
                        <p className="mt-2">
                            Mutasi stok mencatat setiap perubahan jumlah stok suatu produk. Setiap kali stok bertambah, berkurang, atau disesuaikan, sistem akan membuat catatan mutasi otomatis.
                        </p>
                        <p className="mt-2">
                            Halaman ini membantu melacak riwayat lengkap pergerakan stok: kapan, siapa, berapa banyak, dan dari transaksi atau referensi apa.
                        </p>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Kapan Dipakai
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Saat ingin tahu kenapa stok suatu produk berubah.</li>
                            <li>Untuk audit trail atau investigasi selisih stok.</li>
                            <li>Memeriksa apakah stok keluar sesuai transaksi penjualan.</li>
                            <li>Memastikan stok masuk dari purchase order atau retur supplier tercatat benar.</li>
                            <li>Mengecek hasil penyesuaian stok dari stock opname atau adjustment manual.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Tipe Mutasi
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>In</strong> (Inbound): stok bertambah. Biasanya dari pembelian, retur penjualan, atau transfer stok masuk.</li>
                            <li><strong>Out</strong> (Outbound): stok berkurang. Biasanya dari penjualan, retur supplier, atau transfer stok keluar.</li>
                            <li><strong>Adjustment</strong>: stok disesuaikan secara manual atau otomatis, misalnya hasil stock opname atau koreksi stok.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Cara Menggunakan
                        </p>
                        <ol className="mt-2 list-decimal space-y-2 pl-5">
                            <li>Buka filter untuk mempersempit pencarian berdasarkan produk, tipe mutasi, atau rentang tanggal.</li>
                            <li>Lihat <strong>Qty</strong> untuk jumlah perubahan stok pada setiap baris mutasi.</li>
                            <li>Perhatikan kolom <strong>Before / After</strong> untuk melihat stok sebelum dan sesudah mutasi terjadi.</li>
                            <li>Gunakan kolom <strong>Referensi</strong> untuk mengetahui sumber mutasi, misalnya dari transaksi penjualan, purchase order, atau stock opname.</li>
                            <li>Pantau kartu stok dengan filter produk spesifik untuk melihat perjalanan stok satu produk dari waktu ke waktu.</li>
                        </ol>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Catatan Penting
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Mutasi stok bersifat <strong>read-only</strong>. Catatan tidak bisa diubah atau dihapus manual.</li>
                            <li>Jika ada kesalahan stok, lakukan adjustment baru, jangan ubah data mutasi lama.</li>
                            <li>Stok saat ini di kartu stok adalah hasil akumulasi seluruh mutasi yang pernah terjadi pada produk tersebut.</li>
                            <li>Jika outlet aktif adalah tenant, mutasi yang tampil hanya milik tenant tersebut.</li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
