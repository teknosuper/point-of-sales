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
};

export default function Index({ orders, filters = {}, summary = {} }) {
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const canApprove = can("table-orders-approve");
    const [search, setSearch] = useState(filters.search || "");
    const [status, setStatus] = useState(filters.status || "pending_cashier_payment");

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

    const approveOrder = (orderId, orderNumber) => {
        if (!canApprove) return;
        if (!window.confirm(`Konfirmasi pembayaran tunai untuk ${orderNumber}?`)) {
            return;
        }

        router.post(route("table-orders.approve", orderId), {}, { preserveScroll: true });
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
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    approveOrder(order.id, order.order_number)
                                                }
                                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
                                            >
                                                <IconCheck size={16} />
                                                Approve Tunai
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {orders?.last_page > 1 ? <Pagination links={orders.links} /> : null}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
