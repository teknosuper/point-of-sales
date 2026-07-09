import React, { useState } from "react";
import { Head, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconAlertTriangle,
    IconBell,
    IconChevronDown,
    IconFileSearch,
    IconMedal,
    IconSearch,
    IconX,
} from "@/Utils/icons";

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(new Date(value))
        : "-";

const SummaryCard = ({ title, value, icon }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">{icon}</div>
            <p className="text-sm font-medium">{title}</p>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
);

const DeliveryBadge = ({ status }) => {
    const isAlert = status === "not_received";

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                isAlert
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
        >
            {isAlert ? "Belum diterima" : "Diterima"}
        </span>
    );
};

const RatingStars = ({ rating }) => (
    <div className="flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, index) => (
            <span
                key={index}
                className={`text-sm leading-none ${index < Number(rating || 0) ? "text-amber-500" : "text-slate-300 dark:text-slate-700"}`}
            >
                {index < Number(rating || 0) ? "★" : "☆"}
            </span>
        ))}
    </div>
);

export default function Index({
    filters = {},
    summary = {},
    feedbacks = {},
    tenantOptions = [],
    workspace = {},
}) {
    const [showFilters, setShowFilters] = useState(false);
    const isTenantWorkspace = Boolean(workspace?.is_tenant);
    const currentPage = Number(feedbacks?.current_page || 1);
    const totalItems = Number(feedbacks?.total || 0);
    const fromItem = Number(feedbacks?.from || 0);
    const toItem = Number(feedbacks?.to || 0);

    const updateFilters = (payload = {}) => {
        router.get(
            route("transaction-feedback.index"),
            { ...filters, ...payload },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    return (
        <>
            <Head title="Hasil Kritik & Saran" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Hasil Kritik & Saran
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isTenantWorkspace
                                ? "Lihat rating, kritik, saran, dan alert item milik tenant aktif."
                                : "Lihat rating, kritik, saran, dan alert item dari seluruh tenant di outlet aktif."}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <span>Tampil</span>
                            <select
                                value={filters.per_page || 10}
                                onChange={(event) =>
                                    updateFilters({
                                        per_page: event.target.value,
                                        page: 1,
                                    })
                                }
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                                {[10, 25, 50].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowFilters(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            <IconChevronDown size={16} />
                            Advanced Filter
                        </button>
                    </div>
                </div>

                {workspace?.active_outlet?.name ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        Outlet aktif: <span className="font-semibold">{workspace.active_outlet.name}</span>
                    </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard title="Total Feedback" value={summary.total_feedback || 0} icon={<IconFileSearch size={18} />} />
                    <SummaryCard title="Rata-rata Rating" value={summary.average_rating || 0} icon={<IconMedal size={18} />} />
                    <SummaryCard title="Pesan Masuk" value={summary.with_message_count || 0} icon={<IconBell size={18} />} />
                    <SummaryCard title="Alert Belum Diterima" value={summary.not_received_count || 0} icon={<IconAlertTriangle size={18} />} />
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="hidden overflow-x-auto lg:block">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 dark:bg-slate-950/40">
                                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3">Transaksi</th>
                                    <th className="px-4 py-3">Tenant / Item</th>
                                    <th className="px-4 py-3">Rating</th>
                                    <th className="px-4 py-3">Pesan</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Waktu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {(feedbacks.data || []).map((item) => (
                                    <tr key={item.id} className="align-top">
                                        <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                                            <div className="font-semibold text-slate-900 dark:text-white">{item.invoice || "-"}</div>
                                            <div>{item.customer_name}</div>
                                            {item.table_label ? <div className="text-xs text-slate-500">{item.table_label}</div> : null}
                                        </td>
                                        <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                                            <div className="font-semibold text-slate-900 dark:text-white">{item.tenant_name}</div>
                                            <div>{item.product_name}</div>
                                            <div className="text-xs text-slate-500">Qty {item.qty}</div>
                                        </td>
                                        <td className="px-4 py-4">{item.rating ? <RatingStars rating={item.rating} /> : <span className="text-slate-400">-</span>}</td>
                                        <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                                            {item.feedback_text ? <div>{item.feedback_text}</div> : null}
                                            {item.customer_alert_message ? (
                                                <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                                                    Alert: {item.customer_alert_message}
                                                </div>
                                            ) : !item.feedback_text ? (
                                                <span className="text-slate-400">-</span>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-4">
                                            <DeliveryBadge status={item.delivery_status} />
                                        </td>
                                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                                            <div>{formatDateTime(item.created_at)}</div>
                                            {item.customer_alert_requested_at ? (
                                                <div className="mt-1">Alert: {formatDateTime(item.customer_alert_requested_at)}</div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3 p-4 lg:hidden">
                        {(feedbacks.data || []).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">{item.invoice || "-"}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{item.customer_name}</p>
                                    </div>
                                    <DeliveryBadge status={item.delivery_status} />
                                </div>
                                <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                                    <div>
                                        <span className="font-semibold">{item.tenant_name}</span>
                                        {" • "}
                                        {item.product_name}
                                        {" • Qty "}
                                        {item.qty}
                                    </div>
                                    <div>{item.rating ? <RatingStars rating={item.rating} /> : <span className="text-slate-400">Belum ada rating</span>}</div>
                                    {item.feedback_text ? <p>{item.feedback_text}</p> : null}
                                    {item.customer_alert_message ? (
                                        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                                            Alert: {item.customer_alert_message}
                                        </div>
                                    ) : null}
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatDateTime(item.created_at)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {(feedbacks.data || []).length === 0 ? (
                        <div className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                            Belum ada kritik atau saran untuk filter yang dipilih.
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {totalItems > 0
                            ? `Menampilkan ${fromItem}-${toItem} dari ${totalItems} feedback • Halaman ${currentPage}`
                            : "Belum ada data feedback"}
                    </div>
                    {feedbacks.links?.length > 3 ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {feedbacks.links.map((link, index) => (
                            <button
                                key={`${link.label}-${index}`}
                                type="button"
                                disabled={!link.url || link.active}
                                onClick={() => link.url && router.visit(link.url, { preserveScroll: true, preserveState: true })}
                                className={`rounded-xl px-3 py-2 text-sm ${
                                    link.active
                                        ? "bg-slate-900 text-white"
                                        : "border border-slate-200 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                }`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                    ) : null}
                </div>
            </div>

            {showFilters ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                        onClick={() => setShowFilters(false)}
                    />
                    <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Advanced Filter
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Saring feedback berdasarkan tenant, rating, status, dan kata kunci.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFilters(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <label className="space-y-1 xl:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Cari
                                </span>
                                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                                    <IconSearch size={16} className="text-slate-400" />
                                    <input
                                        type="text"
                                        defaultValue={filters.q || ""}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                updateFilters({
                                                    q: event.currentTarget.value,
                                                    page: 1,
                                                });
                                                setShowFilters(false);
                                            }
                                        }}
                                        placeholder="Invoice, produk, tenant, pelanggan, pesan"
                                        className="h-11 w-full bg-transparent px-2 text-sm text-slate-700 outline-none dark:text-slate-200"
                                    />
                                </div>
                            </label>
                            {!isTenantWorkspace ? (
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Tenant
                                    </span>
                                    <select
                                        value={filters.tenant_outlet_id || ""}
                                        onChange={(event) =>
                                            updateFilters({
                                                tenant_outlet_id: event.target.value,
                                                page: 1,
                                            })
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <option value="">Semua tenant</option>
                                        {tenantOptions.map((tenant) => (
                                            <option key={tenant.id} value={tenant.id}>
                                                {tenant.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                            <label className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Rating
                                </span>
                                <select
                                    value={filters.rating || ""}
                                    onChange={(event) =>
                                        updateFilters({
                                            rating: event.target.value,
                                            page: 1,
                                        })
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua rating</option>
                                    {[5, 4, 3, 2, 1].map((rating) => (
                                        <option key={rating} value={rating}>
                                            {rating} bintang
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Status
                                </span>
                                <select
                                    value={filters.delivery_status || ""}
                                    onChange={(event) =>
                                        updateFilters({
                                            delivery_status: event.target.value,
                                            page: 1,
                                        })
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua status</option>
                                    <option value="received">Diterima</option>
                                    <option value="not_received">Belum diterima</option>
                                </select>
                            </label>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    updateFilters({
                                        q: "",
                                        rating: "",
                                        delivery_status: "",
                                        tenant_outlet_id: "",
                                        page: 1,
                                    });
                                    setShowFilters(false);
                                }}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                Reset Filter
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowFilters(false)}
                                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
