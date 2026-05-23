import { Head, Link, usePage } from "@inertiajs/react";
import { useState } from "react";

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

const kitchenStatusLabel = {
    pending: "Menunggu masuk dapur",
    acknowledged: "Diproses dapur",
    ready: "Siap diambil",
    completed: "Selesai",
};

const kitchenStatusTone = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    acknowledged: "bg-sky-50 text-sky-700 border-sky-200",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-slate-100 text-slate-700 border-slate-200",
};

const pricingKindLabel = {
    discount_percentage: "Diskon Persen",
    discount_nominal: "Diskon Nominal",
    fixed_price: "Harga Promo",
    buy_x_get_y: "Buy One Get One",
    qty_break: "Promo Qty",
    bundle_price: "Harga Bundle",
};

export default function Status({ order }) {
    const { storeProfile, identity } = usePage().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const customer = identity?.customer || null;
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];
    const newOrderHref = order?.table?.qr_token
        ? route("table-order.show", order.table.qr_token)
        : null;

    return (
        <>
            <Head title={`Order ${order.order_number}`} />

            {sidebarOpen ? (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            ) : null}

            <div className={`fixed inset-y-0 left-0 z-[70] w-[300px] max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                        <div>
                            <p className="text-sm font-bold text-slate-900">Status Order</p>
                            <p className="text-xs text-slate-500">Meja {order.table?.code || order.table?.name}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Info Meja</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                Meja {order.table?.code || order.table?.name}
                            </p>
                            <p className="text-xs text-slate-500">Bayar di kasir</p>
                        </div>

                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pelanggan</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {customer?.name || order.customer_name || "Pelanggan"}
                            </p>
                            {customer?.no_telp || order.customer_phone ? (
                                <p className="text-xs text-slate-500">
                                    {customer?.no_telp || order.customer_phone}
                                </p>
                            ) : null}
                            {customer?.loyalty_points ? (
                                <p className="mt-1 text-xs font-medium text-emerald-600">
                                    {customer.loyalty_points} poin loyalti
                                </p>
                            ) : null}
                        </div>

                        <div className="mb-4">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Riwayat Pesanan</p>
                            {recentOrders.length > 0 ? (
                                <div className="space-y-2">
                                    {recentOrders.map((recentOrder) => (
                                        <div key={recentOrder.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-800">{recentOrder.order_number}</p>
                                                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                        {statusLabel[recentOrder.status] || recentOrder.status}
                                                    </span>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold text-slate-800">{formatPrice(recentOrder.grand_total)}</p>
                                            </div>
                                            {recentOrder.access_token ? (
                                                <Link href={route("table-order.status", recentOrder.access_token)} className="mt-2 inline-flex text-xs font-medium text-sky-700">
                                                    Lihat status →
                                                </Link>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : recentTransactions.length > 0 ? (
                                <div className="space-y-2">
                                    {recentTransactions.map((transaction) => (
                                        <div key={transaction.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-800">{transaction.invoice}</p>
                                                    <p className="text-xs capitalize text-slate-500">{transaction.payment_status}</p>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold text-slate-800">{formatPrice(transaction.grand_total)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Belum ada riwayat pesanan.</p>
                            )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outlet</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {storeProfile?.name || "Outlet"}
                            </p>
                            <p className="text-xs text-slate-500">
                                Total {formatPrice(order.grand_total)}
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 px-4 py-3">
                        {newOrderHref ? (
                            <Link
                                href={newOrderHref}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Buat Order Baru
                            </Link>
                        ) : null}
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur sm:left-5 sm:top-5"
                aria-label="Buka menu"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>

            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_34%),linear-gradient(180deg,_#eef4ff_0%,_#f8fafc_22%,_#f8fafc_100%)] px-4 py-10 text-slate-900">
                <div className="mx-auto max-w-2xl space-y-6">
                    <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(15,23,42,0.97)_0%,_rgba(30,41,59,0.95)_52%,_rgba(8,47,73,0.94)_100%)] p-6 text-white shadow-[0_30px_90px_-42px_rgba(15,23,42,0.78)]">
                        <p className="text-sm uppercase tracking-[0.2em] text-sky-200">
                            Status Order
                        </p>
                        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">{order.order_number}</h1>
                        <p className="mt-3 text-sm text-slate-300">
                            Meja {order.table?.code || order.table?.name}
                        </p>
                        <div className="mt-4 inline-flex rounded-full bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-100 border border-amber-300/20">
                            {statusLabel[order.status] || order.status}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)]">
                        <h2 className="text-lg font-semibold">Detail Order</h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atas Nama</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {order.customer_name || customer?.name || "Pelanggan"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nomor HP</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {order.customer_phone || customer?.no_telp || "-"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pesanan Dibuat</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {order.created_at_label || "-"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Disetujui</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {order.approved_at_label || "Belum disetujui"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invoice Kasir</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {order.transaction?.invoice || "Belum ada"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transaksi Kasir</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {order.transaction?.created_at_label || "Belum dibuat"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)]">
                        <h2 className="text-lg font-semibold">Rincian Pesanan</h2>
                        <div className="mt-4 space-y-3">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-4 py-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-medium">
                                                {item.product_title} x{item.qty}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <p className="text-xs text-slate-500">
                                                    {formatPrice(item.unit_price)} / porsi
                                                </p>
                                                {item.discount_total > 0 ? (
                                                    <>
                                                        <span className="text-xs text-slate-400 line-through">
                                                            {formatPrice(item.base_unit_price)} / porsi
                                                        </span>
                                                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                                            Hemat {formatPrice(item.discount_total)}
                                                        </span>
                                                    </>
                                                ) : null}
                                            </div>
                                            {item.pricing_rule_name ? (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                                                        {item.pricing_rule_name}
                                                    </span>
                                                    {item.pricing_rule_kind ? (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                            {pricingKindLabel[item.pricing_rule_kind] || item.pricing_rule_kind}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
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
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                {formatPrice(item.line_total)}
                                            </p>
                                            {item.discount_total > 0 ? (
                                                <p className="mt-1 text-[11px] text-rose-600">
                                                    Promo aktif
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Subtotal sebelum promo</span>
                                <span className="font-semibold text-slate-700">
                                    {formatPrice(order.base_subtotal || order.grand_total)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Total diskon promo</span>
                                <span className="font-semibold text-rose-600">
                                    {formatPrice(order.discount_total || 0)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                                <span className="text-sm text-slate-500">Total</span>
                                <span className="text-2xl font-bold">
                                    {formatPrice(order.grand_total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)]">
                        <h2 className="text-lg font-semibold">Status Dapur</h2>
                        {order.transaction?.kitchen_tickets?.length ? (
                            <div className="mt-4 space-y-4">
                                {order.transaction.kitchen_tickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {ticket.station?.name || "Dapur"}
                                                    {ticket.station?.code ? ` • ${ticket.station.code}` : ""}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Ticket {ticket.ticket_number || "-"}
                                                </p>
                                            </div>
                                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${kitchenStatusTone[ticket.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                {kitchenStatusLabel[ticket.status] || ticket.status}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                            {[
                                                ["Masuk", ticket.fired_at_label || ticket.created_at_label, true],
                                                ["Diproses", ticket.acknowledged_at_label, ["acknowledged", "ready", "completed"].includes(ticket.status)],
                                                ["Siap", ticket.ready_at_label, ["ready", "completed"].includes(ticket.status)],
                                                ["Selesai", ticket.completed_at_label, ticket.status === "completed"],
                                            ].map(([stepLabel, stepTime, isDone], index) => (
                                                <div key={`${ticket.id}-${stepLabel}`} className="relative rounded-2xl border border-slate-200 bg-white px-3 py-3">
                                                    {index < 3 ? (
                                                        <span className="pointer-events-none absolute left-[calc(100%-0.4rem)] top-5 hidden h-[2px] w-[calc(100%+0.8rem)] sm:block">
                                                            <span className={`block h-full w-full ${isDone ? "bg-emerald-300" : "bg-slate-200"}`} />
                                                        </span>
                                                    ) : null}
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${isDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                                                            {index + 1}
                                                        </span>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                            {stepLabel}
                                                        </p>
                                                    </div>
                                                    <p className="mt-2 text-sm font-semibold text-slate-900">
                                                        {stepTime || "Belum"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            {ticket.items.map((ticketItem) => (
                                                <div
                                                    key={ticketItem.id}
                                                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-900">
                                                            {ticketItem.product_title} x{ticketItem.qty}
                                                        </p>
                                                        {ticketItem.notes ? (
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {ticketItem.notes}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${kitchenStatusTone[ticketItem.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                            {kitchenStatusLabel[ticketItem.status] || ticketItem.status}
                                                        </p>
                                                        {ticketItem.completed_at_label ? (
                                                            <p className="mt-1 text-[11px] text-slate-500">
                                                                {ticketItem.completed_at_label}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-slate-600">
                                Pesanan ini belum memiliki ticket dapur. Biasanya ticket dapur muncul setelah pembayaran dikonfirmasi kasir.
                            </p>
                        )}
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.3)]">
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
