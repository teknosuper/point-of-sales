import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconBook2,
    IconDownload,
    IconPrinter,
} from "@/Utils/icons";
import { getProductImageUrl } from "@/Utils/imageUrl";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const formatDateTime = (value) =>
    new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

export default function MenuBook({ menuBook }) {
    const store = menuBook?.store || {};
    const categories = menuBook?.categories || [];

    return (
        <>
            <Head title="Buku Menu" />

            <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-8 print:bg-white print:p-0">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
                        <Link
                            href={route("products.index")}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke produk
                        </Link>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-colors hover:bg-primary-600"
                            >
                                <IconPrinter size={18} />
                                Print Buku Menu
                            </button>
                            <a
                                href={route("pdf.products.menu-book")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <IconDownload size={18} />
                                PDF Buku Menu
                            </a>
                        </div>
                    </div>

                    <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur print:rounded-none print:border-0 print:shadow-none">
                        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_55%,#2563eb_100%)] px-8 py-10 text-white print:bg-slate-900">
                            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                                <div className="max-w-3xl">
                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
                                        <IconBook2 size={14} />
                                        Buku Menu
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                                        {store.name || "Buku Menu Outlet"}
                                    </h1>
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/90 sm:text-base">
                                        Daftar menu resmi per kategori, lengkap dengan nama tenant/kitchen dan pilihan topping beserta harga.
                                    </p>
                                </div>
                                <div className="space-y-1 text-sm text-blue-50/90 md:text-right">
                                    {store.address ? <p>{store.address}</p> : null}
                                    {store.phone ? <p>Telp: {store.phone}</p> : null}
                                    {store.website ? <p>{store.website}</p> : null}
                                    {menuBook?.generated_at ? (
                                        <p className="pt-2 text-xs uppercase tracking-[0.2em] text-blue-100/75">
                                            Dibuat {formatDateTime(menuBook.generated_at)}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-10 px-6 py-8 sm:px-8 print:px-6 print:py-6">
                            {categories.map((category, categoryIndex) => (
                                <section key={category.id}>
                                    <div className="mb-5 flex items-end justify-between gap-3 border-b border-slate-200 pb-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-500">
                                                Kategori {String(categoryIndex + 1).padStart(2, "0")}
                                            </p>
                                            <h2 className="mt-1 text-2xl font-black text-slate-900">
                                                {category.name}
                                            </h2>
                                            {category.description ? (
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {category.description}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                            {category.products.length} menu
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        {category.products.map((product) => (
                                            <article
                                                key={product.id}
                                                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid"
                                            >
                                                <div className="grid min-h-[220px] grid-cols-[132px_minmax(0,1fr)]">
                                                    <div className="h-full bg-slate-100">
                                                        <img
                                                            src={getProductImageUrl(
                                                                product.image,
                                                                product.title
                                                            )}
                                                            alt={product.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col p-5">
                                                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-700">
                                                                    {product.tenant_outlet?.name ||
                                                                        "Tenant"}
                                                                </span>
                                                                <h3 className="mt-3 text-xl font-black leading-tight text-slate-900">
                                                                    {product.title}
                                                                </h3>
                                                            </div>
                                                            <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                                                                    Harga
                                                                </p>
                                                                <p className="text-lg font-black">
                                                                    {formatPrice(
                                                                        product.sell_price
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {product.description ? (
                                                            <p className="mb-4 text-sm leading-6 text-slate-600">
                                                                {product.description}
                                                            </p>
                                                        ) : null}

                                                        <div className="mt-auto rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                                                                Topping / Tambahan
                                                            </p>
                                                            {product.modifier_options?.length ? (
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {product.modifier_options.map(
                                                                        (modifier) => (
                                                                            <div
                                                                                key={modifier.id}
                                                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                                                            >
                                                                                <p className="font-semibold text-slate-800">
                                                                                    {modifier.name}
                                                                                </p>
                                                                                <p className="mt-1 text-primary-600">
                                                                                    {formatPrice(
                                                                                        modifier.price
                                                                                    )}
                                                                                </p>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="mt-3 text-sm text-slate-400">
                                                                    Tidak ada topping tambahan.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

MenuBook.layout = (page) => <DashboardLayout children={page} />;
