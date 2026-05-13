import Pagination from "@/Components/Dashboard/Pagination";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useAuthorization } from "@/Utils/authorization";
import { Head, router, usePage } from "@inertiajs/react";
import { IconCheck, IconDeviceMobile, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const statusLabel = {
    pending_cashier_payment: "Menunggu Bayar Kasir",
    paid: "Sudah Dibayar",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
};

export default function Index({ orders, filters = {}, summary = {} }) {
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const canApprove = can("table-orders-approve");
    const [search, setSearch] = useState(filters.search || "");
    const [status, setStatus] = useState(filters.status || "pending_cashier_payment");
    const [approvalTarget, setApprovalTarget] = useState(null);
    const [cashInput, setCashInput] = useState("");
    const [isApproving, setIsApproving] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const applyFilters = () => {
        router.get(
            route("table-orders.index"),
            { search, status },
            { preserveState: true, preserveScroll: true }
        );
    };

    const cashAmount = Math.max(0, Number(cashInput) || 0);
    const changeAmount = Math.max(
        0,
        cashAmount - Number(approvalTarget?.grand_total || 0)
    );

    const openApproval = (order) => {
        if (!canApprove) return;
        setApprovalTarget(order);
        setCashInput(String(order?.grand_total || 0));
    };

    const closeApproval = () => {
        if (isApproving) {
            return;
        }

        setApprovalTarget(null);
        setCashInput("");
    };

    const approveOrder = () => {
        if (!approvalTarget?.id || !canApprove) return;
        if (cashAmount < Number(approvalTarget.grand_total || 0)) {
            toast.error("Nominal tunai kurang dari total order.");
            return;
        }

        setIsApproving(true);

        router.post(
            route("table-orders.approve", approvalTarget.id),
            { cash: cashAmount, redirect_to: "print" },
            {
                preserveScroll: true,
                onFinish: () => setIsApproving(false),
            }
        );
    };

    const openCancel = (order) => {
        if (!canApprove) return;
        setCancelTarget(order);
        setCancelReason("");
    };

    const closeCancel = () => {
        if (isCancelling) {
            return;
        }

        setCancelTarget(null);
        setCancelReason("");
    };

    const cancelOrder = () => {
        if (!cancelTarget?.id || !canApprove) return;

        setIsCancelling(true);

        router.post(
            route("table-orders.cancel", cancelTarget.id),
            { reason: cancelReason, redirect_to: "list" },
            {
                preserveScroll: true,
                onFinish: () => setIsCancelling(false),
            }
        );
    };

    return (
        <>
            <Head title="Pesanan QR Meja" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <IconDeviceMobile size={26} className="text-primary-500" />
                            Pesanan QR Meja
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Kasir mengonfirmasi pembayaran tunai self-order sebelum pesanan masuk dapur.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[220px,180px,auto]">
                        <div className="relative">
                            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Cari order / meja"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                        >
                            <option value="">Semua status</option>
                            <option value="pending_cashier_payment">Menunggu Bayar Kasir</option>
                            <option value="paid">Sudah Dibayar</option>
                            <option value="rejected">Ditolak</option>
                            <option value="cancelled">Dibatalkan</option>
                        </select>
                        <button
                            type="button"
                            onClick={applyFilters}
                            className="h-11 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white"
                        >
                            Terapkan
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        {
                            label: "Menunggu Bayar Kasir",
                            value: summary.pending_cashier_payment ?? 0,
                        },
                        { label: "Sudah Dibayar", value: summary.paid ?? 0 },
                        { label: "Ditolak", value: summary.rejected ?? 0 },
                        { label: "Dibatalkan", value: summary.cancelled ?? 0 },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(orders?.data || []).length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                Belum ada pesanan QR meja.
                            </div>
                        ) : (
                            orders.data.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:justify-between"
                                >
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                                {order.order_number}
                                            </h3>
                                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                                                {statusLabel[order.status] || order.status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                            <p>
                                                Meja {order.table?.code || order.table?.name}
                                                {order.customer_name ? ` • ${order.customer_name}` : ""}
                                            </p>
                                            <p>Total {formatPrice(order.grand_total)}</p>
                                        </div>
                                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                            {order.items.map((item) => (
                                                <p key={item.id}>
                                                    {item.product_title} x{item.qty}
                                                    {item.notes ? ` • ${item.notes}` : ""}
                                                </p>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-start gap-2">
                                        {order.transaction?.invoice ? (
                                            <span className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                {order.transaction.invoice}
                                            </span>
                                        ) : null}
                                        {canApprove && order.status === "pending_cashier_payment" ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => openCancel(order)}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700"
                                                >
                                                    Batalkan
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openApproval(order)}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
                                                >
                                                    <IconCheck size={16} />
                                                    Approve Tunai
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {orders?.last_page > 1 ? <Pagination links={orders.links} /> : null}
            </div>

            {approvalTarget ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeApproval}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                                Approve Pembayaran Tunai
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                {approvalTarget.order_number}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Meja {approvalTarget.table?.code || approvalTarget.table?.name}
                            </p>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Total order</span>
                                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                                        {formatPrice(approvalTarget.grand_total)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Uang Tunai Diterima
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={cashInput}
                                    onChange={(event) =>
                                        setCashInput(event.target.value.replace(/[^\d]/g, ""))
                                    }
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                    placeholder="0"
                                />
                            </div>

                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-emerald-700 dark:text-emerald-300">
                                        Kembalian
                                    </span>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                        {formatPrice(changeAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={closeApproval}
                                disabled={isApproving}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={approveOrder}
                                disabled={
                                    isApproving ||
                                    cashAmount < Number(approvalTarget.grand_total || 0)
                                }
                                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isApproving ? "Memproses..." : "Approve dan Cetak"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {cancelTarget ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={closeCancel}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
                                Batalkan Order QR
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                {cancelTarget.order_number}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Meja {cancelTarget.table?.code || cancelTarget.table?.name}
                            </p>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                Order akan ditandai batal dan tidak bisa lagi di-approve ke pembayaran kasir.
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Alasan pembatalan
                                </label>
                                <textarea
                                    rows={3}
                                    value={cancelReason}
                                    onChange={(event) => setCancelReason(event.target.value)}
                                    placeholder="Opsional, mis. pelanggan berubah pikiran"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                            <button
                                type="button"
                                onClick={closeCancel}
                                disabled={isCancelling}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={cancelOrder}
                                disabled={isCancelling}
                                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {isCancelling ? "Membatalkan..." : "Batalkan Order"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
