import { Head, Link } from "@inertiajs/react";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const statusLabel = {
    pending_cashier_payment: "Menunggu Pembayaran di Kasir",
    paid: "Sudah Dibayar",
    rejected: "Ditolak Kasir",
    cancelled: "Dibatalkan",
};

export default function Status({ order }) {
    const newOrderHref = order?.table?.qr_token
        ? route("table-order.show", order.table.qr_token)
        : null;

    return (
        <>
            <Head title={`Order ${order.order_number}`} />

            <div className="min-h-screen bg-[#f5f0e8] px-4 py-10 text-slate-900">
                <div className="mx-auto max-w-2xl space-y-6">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                            Status Order
                        </p>
                        <h1 className="mt-2 text-3xl font-bold">{order.order_number}</h1>
                        <p className="mt-3 text-sm text-slate-600">
                            Meja {order.table?.code || order.table?.name}
                        </p>
                        <div className="mt-4 inline-flex rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                            {statusLabel[order.status] || order.status}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold">Rincian Pesanan</h2>
                        <div className="mt-4 space-y-3">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {item.product_title} x{item.qty}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {formatPrice(item.unit_price)} / porsi
                                        </p>
                                        {item.modifiers?.length ? (
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                {item.modifiers.map((modifier) => (
                                                    <span
                                                        key={modifier.id}
                                                        className="rounded-full bg-[#f5e4d9] px-2 py-1 text-xs text-[#9b4b2e]"
                                                    >
                                                        {modifier.name} x{modifier.qty}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {item.notes ? (
                                            <p className="text-sm text-slate-500">
                                                {item.notes}
                                            </p>
                                        ) : null}
                                    </div>
                                    <p className="font-semibold">
                                        {formatPrice(item.line_total)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                            <span className="text-sm text-slate-500">Total</span>
                            <span className="text-2xl font-bold">
                                {formatPrice(order.grand_total)}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        {order.status === "pending_cashier_payment" ? (
                            <p className="text-sm text-slate-600">
                                Silakan ke kasir untuk pembayaran tunai. Setelah kasir
                                mengonfirmasi pembayaran, pesanan akan diteruskan ke dapur.
                            </p>
                        ) : order.status === "paid" ? (
                            <p className="text-sm text-slate-600">
                                Pembayaran sudah dikonfirmasi. Pesanan sedang diproses.
                                {order.transaction?.invoice
                                    ? ` Invoice kasir: ${order.transaction.invoice}.`
                                    : ""}
                            </p>
                        ) : (
                            <p className="text-sm text-slate-600">
                                Status pesanan saat ini: {statusLabel[order.status] || order.status}.
                            </p>
                        )}

                        {newOrderHref ? (
                            <Link
                                href={newOrderHref}
                                className="mt-5 inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                            >
                                Buat Order Baru
                            </Link>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
}
