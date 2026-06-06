import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Modal from "@/Components/Dashboard/Modal";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconCirclePlus,
    IconChevronDown,
    IconChevronUp,
    IconClipboardCheck,
    IconEye,
    IconInfoCircle,
    IconSearch,
} from "@/Utils/icons";

function formatDateTime(value) {
    if (!value) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export default function Index({ stockOpnames, filters }) {
    const { can } = useAuthorization();
    const canCreateStockOpnames = can("stock-opnames-create");
    const [showFilters, setShowFilters] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    const handleFilterChange = (key, value) => {
        router.get(
            route("stock-opnames.index"),
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
            <Head title="Stock Opname" />

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Stock Opname
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Buat sesi audit stok dan cek hasilnya di sini.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/40"
                    >
                        <IconInfoCircle size={16} />
                        Bantuan
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowFilters((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        {showFilters ? "Sembunyikan filter" : "Buka filter"}
                    </button>
                    {canCreateStockOpnames && (
                        <Button
                            type="link"
                            href={route("stock-opnames.create")}
                            icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                            className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                            label="Buat Sesi"
                        />
                    )}
                </div>
            </div>

            {showFilters ? (
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
                <div className="relative md:col-span-2">
                    <input
                        type="text"
                        value={filters.search || ""}
                        onChange={(event) =>
                            handleFilterChange("search", event.target.value)
                        }
                        placeholder="Cari kode sesi atau catatan..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                        <IconSearch size={18} />
                    </div>
                </div>

                <select
                    value={filters.status || ""}
                    onChange={(event) =>
                        handleFilterChange("status", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    <option value="">Semua Status</option>
                    <option value="draft">Draft</option>
                    <option value="finalized">Finalized</option>
                </select>

                <div className="grid grid-cols-2 gap-3">
                    <input
                        type="date"
                        value={filters.date_from || ""}
                        onChange={(event) =>
                            handleFilterChange("date_from", event.target.value)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <input
                        type="date"
                        value={filters.date_to || ""}
                        onChange={(event) =>
                            handleFilterChange("date_to", event.target.value)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                </div>
            </div>
            ) : null}

            <Table.Card title="Daftar Sesi Stock Opname">
                <Table>
                    <Table.Thead>
                        <tr>
                            <Table.Th>Kode</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Jumlah Item</Table.Th>
                            <Table.Th>Dibuat Oleh</Table.Th>
                            <Table.Th>Finalized</Table.Th>
                            <Table.Th className="w-24 text-center">Aksi</Table.Th>
                        </tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {stockOpnames.data.length > 0 ? (
                            stockOpnames.data.map((stockOpname) => (
                                <tr
                                    key={stockOpname.id}
                                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                    <Table.Td>
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                {stockOpname.code}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {stockOpname.notes || "Tanpa catatan"}
                                            </p>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                stockOpname.status === "finalized"
                                                    ? "bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-400"
                                                    : "bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-400"
                                            }`}
                                        >
                                            {stockOpname.status === "finalized"
                                                ? "Finalized"
                                                : "Draft"}
                                        </span>
                                    </Table.Td>
                                    <Table.Td>{stockOpname.items_count}</Table.Td>
                                    <Table.Td>{stockOpname.creator?.name || "-"}</Table.Td>
                                    <Table.Td>
                                        {stockOpname.finalized_at
                                            ? `${stockOpname.finalizer?.name || "-"} • ${formatDateTime(stockOpname.finalized_at)}`
                                            : "-"}
                                    </Table.Td>
                                    <Table.Td className="text-center">
                                        <Link
                                            href={route("stock-opnames.show", stockOpname.id)}
                                            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:text-primary-400"
                                        >
                                            <IconEye size={18} />
                                        </Link>
                                    </Table.Td>
                                </tr>
                            ))
                        ) : (
                            <Table.Empty
                                colSpan={6}
                                message={
                                    <div className="text-slate-500 dark:text-slate-400">
                                        Belum ada sesi stock opname.
                                    </div>
                                }
                            >
                                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                    <IconClipboardCheck size={28} className="text-slate-400" />
                                </div>
                            </Table.Empty>
                        )}
                    </Table.Tbody>
                </Table>
            </Table.Card>

            {stockOpnames.last_page > 1 && (
                <Pagination links={stockOpnames.links} />
            )}

            <Modal
                show={showHelpModal}
                onClose={() => setShowHelpModal(false)}
                title="Bantuan Stock Opname"
                maxWidth="2xl"
            >
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Fungsi Stock Opname
                        </p>
                        <p className="mt-2">
                            Stock opname dipakai untuk mencocokkan stok fisik yang benar-benar ada di rak, etalase, gudang, atau dapur dengan stok yang tercatat di sistem.
                        </p>
                        <p className="mt-2">
                            Hasilnya membantu menemukan selisih stok, barang hilang, salah input, atau barang yang belum tercatat keluar masuknya.
                        </p>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Kapan Dipakai
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Saat audit stok harian, mingguan, atau bulanan.</li>
                            <li>Sebelum tutup buku stok atau evaluasi barang selisih.</li>
                            <li>Setelah ada dugaan stok tidak cocok antara sistem dan fisik.</li>
                            <li>Sesudah pergantian shift, pergantian PIC, atau penataan gudang besar.</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Cara Menggunakan
                        </p>
                        <ol className="mt-2 list-decimal space-y-2 pl-5">
                            <li>Klik <strong>Buat Sesi</strong> untuk membuat sesi stock opname baru.</li>
                            <li>Isi catatan jika perlu, misalnya area yang dicek atau nama petugas audit.</li>
                            <li>Tambahkan produk yang ingin dihitung ke dalam sesi.</li>
                            <li>Masukkan jumlah stok fisik yang benar-benar ditemukan di lapangan.</li>
                            <li>Bandingkan stok sistem dengan stok fisik pada setiap item.</li>
                            <li>Setelah semua item selesai dicek, lakukan <strong>finalize</strong> agar hasil opname dikunci dan bisa dipakai sebagai dasar penyesuaian.</li>
                        </ol>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Penjelasan Status
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li><strong>Draft</strong>: sesi masih bisa ditambah atau diubah.</li>
                            <li><strong>Finalized</strong>: sesi sudah diselesaikan dan tidak seharusnya diubah lagi.</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Catatan Penting
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Lakukan hitung fisik dengan teliti sebelum finalize.</li>
                            <li>Jangan finalize jika masih ada item yang belum dicek.</li>
                            <li>Gunakan catatan sesi untuk menjelaskan alasan selisih jika ditemukan masalah.</li>
                            <li>Jika outlet aktif adalah tenant, halaman ini hanya fokus ke stok tenant aktif tersebut.</li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
