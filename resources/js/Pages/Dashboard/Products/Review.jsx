import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import { getProductImageUrl } from "@/Utils/imageUrl";
import Swal from "sweetalert2";
import {
    IconCheck,
    IconChevronRight,
    IconClock,
    IconSearch,
    IconX,
} from "@/Utils/icons";

const inputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const formatDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function Review({ pendingProducts, filters = {} }) {
    const { can } = useAuthorization();
    const [search, setSearch] = useState(filters.search || "");
    const [rejecting, setRejecting] = useState(null);
    const [rejectNote, setRejectNote] = useState("");
    const [selected, setSelected] = useState(null);
    const canReview = can("products-review");

    const rows = pendingProducts?.data ?? [];
    const total = Number(pendingProducts?.total ?? rows.length ?? 0);

    const submitSearch = (event) => {
        event.preventDefault();
        router.get(
            route("products.review"),
            { search },
            { preserveScroll: true, preserveState: true }
        );
    };

    const approveProduct = (product) => {
        Swal.fire({
            title: "Setujui produk?",
            text: `"${product.title}" akan langsung tampil di publik (POS, self order, dan daftar menu).`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, Setujui",
            cancelButtonText: "Batal",
            confirmButtonColor: "#059669",
            reverseButtons: true,
        }).then((result) => {
            if (!result.isConfirmed) return;
            router.patch(route("products.approve", product.id), undefined, {
                preserveScroll: true,
            });
        });
    };

    const submitReject = (product) => {
        router.patch(
            route("products.reject", product.id),
            { review_note: rejectNote },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRejecting(null);
                    setRejectNote("");
                    setSelected(null);
                },
            }
        );
    };

    return (
        <>
            <Head title="Antrian Review Produk" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Antrian Review Produk
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Produk baru menunggu persetujuan owner/main outlet sebelum tampil di publik.
                        </p>
                    </div>
                    <form onSubmit={submitSearch} className="w-full max-w-sm">
                        <div className="relative">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama produk..."
                                className={inputClass}
                            />
                            <button
                                type="submit"
                                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400"
                                title="Cari"
                            >
                                <IconSearch size={18} />
                            </button>
                        </div>
                    </form>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <IconClock size={16} className="text-slate-400" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Menunggu review:{" "}
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {total}
                                </span>{" "}
                                produk
                            </p>
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30">
                                <IconCheck size={26} />
                            </span>
                            <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Tidak ada produk menunggu review
                            </h3>
                            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                                Semua produk sudah disetujui. Produk baru akan masuk antrian ini.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => setSelected(product)}
                                    className="flex cursor-pointer flex-col gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 lg:flex-row lg:items-center lg:justify-between"
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                                            {product.image &&
                                            product.image !== "default.jpg" ? (
                                                <img
                                                    src={getProductImageUrl(product.image, product.title)}
                                                    alt={product.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <IconChevronRight size={20} />
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                {product.title}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                {product.category?.name ? (
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                                                        {product.category.name}
                                                    </span>
                                                ) : null}
                                                {product.tenant_outlet?.name ? (
                                                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                        {product.tenant_outlet.name}
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                                        Global / Owner
                                                    </span>
                                                )}
                                                {product.sku ? (
                                                    <span>SKU: {product.sku}</span>
                                                ) : null}
                                                <span>
                                                    Stok: {product.stock}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                Diajukan {formatDate(product.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                            Rp {Number(product.sell_price).toLocaleString("id-ID")}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                approveProduct(product);
                                            }}
                                            disabled={!canReview}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            <IconCheck size={14} />
                                            Setujui
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setRejecting(product.id);
                                                setRejectNote("");
                                            }}
                                            disabled={!canReview}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-danger-200 bg-white px-3.5 py-2 text-xs font-semibold text-danger-600 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-900/50 dark:bg-slate-900 dark:text-danger-400"
                                        >
                                            <IconX size={14} />
                                            Tolak
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {pendingProducts.last_page !== 1 ? (
                    <div className="flex justify-center pt-2">
                        <Pagination links={pendingProducts.links} />
                    </div>
                ) : null}
            </div>

            {/* ===== Modal tolak produk ===== */}
            {rejecting ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setRejecting(null)}
                    />
                    <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Tolak Produk
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Beri alasan penolakan agar tenant dapat memperbaiki produk ini.
                        </p>
                        <textarea
                            rows={4}
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Contoh: gambar tidak jelas, harga belum sesuai, deskripsi kurang lengkap"
                            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-danger-400 focus:ring-2 focus:ring-danger-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRejecting(null)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => submitReject(rows.find((r) => r.id === rejecting))}
                                className="rounded-xl bg-danger-600 px-4 py-3 text-sm font-semibold text-white hover:bg-danger-700"
                            >
                                Tolak Produk
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ===== Modal detail produk ===== */}
            {selected ? (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setSelected(null)}
                    />
                    <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                                    {selected.image && selected.image !== "default.jpg" ? (
                                        <img
                                            src={getProductImageUrl(selected.image, selected.title)}
                                            alt={selected.title}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <IconChevronRight size={24} />
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                                        {selected.title}
                                    </h3>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        {selected.category?.name ? (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                                                {selected.category.name}
                                            </span>
                                        ) : null}
                                        {selected.tenant_outlet?.name ? (
                                            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                {selected.tenant_outlet.name}
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                                Global / Owner
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {selected.description || "Tidak ada deskripsi."}
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Harga Jual</p>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                                        Rp {Number(selected.sell_price).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Harga Beli (Owner)</p>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                                        Rp {Number(selected.buy_price ?? 0).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Stok</p>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                                        {selected.stock}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Diajukan</p>
                                    <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {formatDate(selected.created_at)}
                                    </p>
                                </div>
                            </div>

                            {selected.sku || selected.barcode ? (
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    {selected.sku ? (
                                        <span className="rounded-full border border-slate-200 px-2.5 py-1 dark:border-slate-700">
                                            SKU: {selected.sku}
                                        </span>
                                    ) : null}
                                    {selected.barcode ? (
                                        <span className="rounded-full border border-slate-200 px-2.5 py-1 dark:border-slate-700">
                                            Barcode: {selected.barcode}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                Jika ditolak, produk berstatus <span className="font-semibold">Ditolak</span> dan tidak tampil di publik/POS.
                                Tenant dapat memperbaiki produknya lalu diajukan ulang ke antrian review ini.
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejecting(selected.id);
                                    setRejectNote("");
                                }}
                                disabled={!canReview}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-danger-200 bg-white px-4 py-2.5 text-sm font-semibold text-danger-600 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-900/50 dark:bg-slate-900 dark:text-danger-400"
                            >
                                <IconX size={16} />
                                Tolak
                            </button>
                            <button
                                type="button"
                                onClick={() => approveProduct(selected)}
                                disabled={!canReview}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <IconCheck size={16} />
                                Setujui Produk
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

Review.layout = (page) => <DashboardLayout children={page} />;
