import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { IconBike, IconCheck, IconChevronDown, IconChevronUp, IconClipboardList, IconInfoCircle, IconUser } from "@/Utils/icons";
import { useState } from "react";

const waiterStatusMeta = {
    ready: {
        label: "Siap Antar",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        description: "Pesanan sudah selesai dari dapur dan menunggu petugas antar atau pelanggan.",
    },
    assigned: {
        label: "Sudah Ditugaskan",
        badge: "bg-primary-100 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300",
        description: "Petugas antar sudah dipilih, tetapi pesanan belum diambil dari dapur.",
    },
    picked_up: {
        label: "Sedang Diantar",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
        description: "Pesanan sudah diambil dari dapur dan sedang menuju pelanggan.",
    },
    delivered: {
        label: "Sudah Diserahkan",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        description: "Pesanan sudah diterima petugas antar atau pelanggan. Ini status akhir layanan.",
    },
};

const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

export default function WaiterIndex({ allocations = [], waiters = [], deliveredAllocations = [] }) {
    const [showGuide, setShowGuide] = useState(false);

    const assignWaiter = (allocationId, waiterId) => {
        router.post(
            route("waiter-board.assign", allocationId),
            { waiter_id: Number(waiterId) },
            { preserveScroll: true }
        );
    };

    const markPickedUp = (allocationId) => {
        router.post(route("waiter-board.pick-up", allocationId), {}, { preserveScroll: true });
    };

    const markDelivered = (allocationId) => {
        router.post(route("waiter-board.deliver", allocationId), {}, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Papan Petugas Antar" />
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Papan Petugas Antar
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Pantau pesanan yang siap diantar sampai benar-benar diterima pelanggan.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => setShowGuide((value) => !value)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                    >
                        <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <IconInfoCircle size={18} />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Panduan alur penyerahan pesanan
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Buka untuk melihat arti status dan tahapan dari dapur ke pelanggan.
                            </p>
                        </div>
                        </div>
                        {showGuide ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                    </button>
                    {showGuide ? (
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Alur penyerahan dari dapur ke pelanggan
                            </p>
                            <p className="mt-1">
                                Setelah dapur menekan `Siap Diantar / Diambil`, pesanan masuk ke papan petugas antar dengan status `Siap Antar`. Status finalnya bukan `Selesai` dapur, tetapi `Sudah Diserahkan` setelah benar-benar sampai ke pelanggan.
                            </p>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-4">
                            {["ready", "assigned", "picked_up", "delivered"].map((statusKey) => (
                                <div
                                    key={statusKey}
                                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40"
                                >
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {waiterStatusMeta[statusKey].label}
                                    </p>
                                    <p className="mt-1 text-xs">
                                        {waiterStatusMeta[statusKey].description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        ["Siap Antar", allocations.filter((item) => item.waiter_status === "ready").length],
                        ["Sudah Ditugaskan", allocations.filter((item) => item.waiter_status === "assigned").length],
                        ["Sedang Diantar", allocations.filter((item) => item.waiter_status === "picked_up").length],
                    ].map(([label, total]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {label}
                            </p>
                            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                                {total}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-4">
                    {allocations.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            Belum ada pesanan yang menunggu petugas antar.
                        </div>
                    ) : (
                        allocations.map((allocation) => (
                            <div
                                key={allocation.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                                                {allocation.tenant_name}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                {allocation.order_type === "dine_in"
                                                    ? "Makan di Tempat"
                                                    : "Bawa Pulang"}
                                            </span>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    waiterStatusMeta[allocation.waiter_status]?.badge || waiterStatusMeta.ready.badge
                                                }`}
                                            >
                                                {waiterStatusMeta[allocation.waiter_status]?.label || allocation.waiter_status}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                {allocation.invoice}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Pelanggan: {allocation.customer_name}
                                            </p>
                                            {allocation.table_name ? (
                                                <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                                                    Meja:{" "}
                                                    {allocation.table_code
                                                        ? `${allocation.table_code} - ${allocation.table_name}`
                                                        : allocation.table_name}
                                                </p>
                                            ) : null}
                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                Siap antar: {formatDateTime(allocation.ready_at)}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {waiterStatusMeta[allocation.waiter_status]?.description}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                <IconClipboardList size={14} />
                                                Item Pesanan
                                            </div>
                                            <div className="space-y-2">
                                                {allocation.items.map((item) => (
                                                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-slate-200">
                                                                {item.product_title}
                                                            </p>
                                                            {item.notes ? (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {item.notes}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                            x{item.qty}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full max-w-sm space-y-3">
                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                Petugas antar
                                            </label>
                                            <select
                                                value={allocation.waiter?.id || ""}
                                                onChange={(e) =>
                                                    e.target.value
                                                        ? assignWaiter(
                                                              allocation.id,
                                                              e.target.value
                                                          )
                                                        : null
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            >
                                                <option value="">Pilih petugas antar</option>
                                                {(allocation.eligible_waiters ||
                                                    waiters).map((waiter) => (
                                                    <option key={waiter.id} value={waiter.id}>
                                                        {waiter.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {(allocation.eligible_waiters || waiters)
                                                .length === 0 ? (
                                                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                                    Tidak ada petugas antar yang melayani dapur ini.
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                                            <p className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                                                <IconUser size={16} />
                                                {allocation.waiter?.name || "Belum ditugaskan"}
                                            </p>
                                            {allocation.picked_up_at ? (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Diambil: {formatDateTime(allocation.picked_up_at)}
                                                </p>
                                            ) : null}
                                            {allocation.delivered_at ? (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Diserahkan: {formatDateTime(allocation.delivered_at)}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => markPickedUp(allocation.id)}
                                                disabled={allocation.waiter_status === "picked_up" || allocation.waiter_status === "delivered"}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                                            >
                                                <IconBike size={16} />
                                                Ambil dari Dapur
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => markDelivered(allocation.id)}
                                                disabled={allocation.waiter_status === "delivered"}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                                            >
                                                <IconCheck size={16} />
                                                Sudah Diserahkan
                                            </button>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                            `Ambil dari Dapur` dipakai saat petugas antar sudah membawa pesanan keluar dari dapur. `Sudah Diserahkan` dipakai saat pesanan benar-benar sampai ke pelanggan atau sudah diambil langsung oleh pelanggan.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Riwayat Sudah Diserahkan
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Daftar pesanan yang sudah selesai sampai ke pelanggan.
                            </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                            {deliveredAllocations.length} data terbaru
                        </div>
                    </div>

                    {deliveredAllocations.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            Belum ada pesanan yang sudah diserahkan.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {deliveredAllocations.map((allocation) => (
                                <div
                                    key={allocation.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                                                    {allocation.tenant_name}
                                                </span>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${waiterStatusMeta.delivered.badge}`}>
                                                    {waiterStatusMeta.delivered.label}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                                                {allocation.invoice}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Pelanggan: {allocation.customer_name}
                                            </p>
                                            {allocation.table_name ? (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Meja: {allocation.table_code ? `${allocation.table_code} - ${allocation.table_name}` : allocation.table_name}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                            <p>Petugas antar: {allocation.waiter?.name || "-"}</p>
                                            <p>Siap antar: {formatDateTime(allocation.ready_at)}</p>
                                            <p>Diambil: {formatDateTime(allocation.picked_up_at)}</p>
                                            <p>Diserahkan: {formatDateTime(allocation.delivered_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

WaiterIndex.layout = (page) => <DashboardLayout children={page} />;
