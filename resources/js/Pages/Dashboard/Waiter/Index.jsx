import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { IconBike, IconCheck, IconClipboardList, IconUser } from "@tabler/icons-react";

const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

export default function WaiterIndex({ allocations = [], waiters = [] }) {
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
            <Head title="Waiter Board" />
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Waiter Board
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Pantau pesanan siap antar dari dapur ke pelanggan.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        ["Siap Antar", allocations.filter((item) => item.waiter_status === "ready").length],
                        ["Assigned", allocations.filter((item) => item.waiter_status === "assigned").length],
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
                            Belum ada pesanan yang menunggu waiter.
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
                                                    ? "Dine In"
                                                    : "Take Away"}
                                            </span>
                                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                {allocation.waiter_status}
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
                                                Ready: {formatDateTime(allocation.ready_at)}
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
                                                Waiter
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
                                                <option value="">Pilih waiter</option>
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
                                                    Tidak ada waiter yang melayani dapur ini.
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
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => markPickedUp(allocation.id)}
                                                disabled={allocation.waiter_status === "picked_up" || allocation.waiter_status === "delivered"}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                                            >
                                                <IconBike size={16} />
                                                Ambil
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => markDelivered(allocation.id)}
                                                disabled={allocation.waiter_status === "delivered"}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                                            >
                                                <IconCheck size={16} />
                                                Selesai
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

WaiterIndex.layout = (page) => <DashboardLayout children={page} />;
