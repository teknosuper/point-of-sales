import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

const statusLabel = {
    pending_cashier_payment: "Siap dibayar di kasir",
    paid: "Pembayaran selesai",
    rejected: "Belum bisa diproses kasir",
    cancelled: "Pesanan dibatalkan",
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

const orderStatusTone = {
    pending_cashier_payment: "border-amber-200 bg-amber-100 text-amber-800",
    paid: "border-emerald-200 bg-emerald-100 text-emerald-800",
    rejected: "border-rose-200 bg-rose-100 text-rose-800",
    cancelled: "border-slate-200 bg-slate-100 text-slate-700",
};

const heroStatusTone = {
    pending_cashier_payment:
        "border-amber-300/30 bg-amber-300/15 text-amber-50",
    paid: "border-emerald-300/30 bg-emerald-300/15 text-emerald-50",
    rejected: "border-rose-300/30 bg-rose-300/15 text-rose-50",
    cancelled: "border-white/15 bg-white/10 text-slate-100",
};

const summaryCardTone = {
    pending_cashier_payment:
        "border-amber-200 bg-[linear-gradient(180deg,_#fffdf5_0%,_#fff7df_100%)]",
    paid: "border-emerald-200 bg-[linear-gradient(180deg,_#f6fef9_0%,_#eafaf0_100%)]",
    rejected: "border-rose-200 bg-[linear-gradient(180deg,_#fff8f8_0%,_#ffecec_100%)]",
    cancelled: "border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]",
};

const pricingKindLabel = {
    discount_percentage: "Diskon Spesial",
    discount_nominal: "Potongan Spesial",
    fixed_price: "Harga Promo",
    buy_x_get_y: "Beli Bonus",
    qty_break: "Makin Banyak Lebih Untung",
    bundle_price: "Paket Hemat",
};

const orderInstructionSteps = {
    pending_cashier_payment: [
        {
            title: "1. Datangi kasir",
            description:
                "Sampaikan nomor order ini ke kasir agar pesanan Anda bisa ditemukan dengan cepat.",
        },
        {
            title: "2. Lakukan pembayaran",
            description:
                "Bayar sesuai total tagihan yang tampil di halaman ini. Kasir akan memverifikasi dan mengonfirmasi pembayaran Anda.",
        },
        {
            title: "3. Pesanan masuk ke dapur",
            description:
                "Setelah pembayaran dikonfirmasi, sistem otomatis meneruskan pesanan ke dapur sesuai item yang Anda pilih.",
        },
        {
            title: "4. Tunggu status dapur diperbarui",
            description:
                "Halaman ini akan menampilkan progres pesanan, mulai dari diproses dapur sampai siap diambil atau diantar ke meja.",
        },
    ],
    paid: [
        {
            title: "1. Pembayaran sudah diterima",
            description:
                "Kasir sudah mengonfirmasi pembayaran Anda, jadi Anda tidak perlu kembali membayar.",
        },
        {
            title: "2. Dapur menyiapkan pesanan",
            description:
                "Pesanan diteruskan ke dapur sesuai item yang Anda pilih dan akan diproses berdasarkan antrean.",
        },
        {
            title: "3. Pantau progres di halaman ini",
            description:
                "Periksa bagian progress dapur untuk melihat apakah pesanan masih diproses, sudah siap, atau sudah selesai.",
        },
        {
            title: "4. Ambil atau tunggu pesanan diantar",
            description:
                "Jika status sudah siap, silakan ambil sesuai arahan outlet atau tunggu staf mengantarkan ke meja Anda.",
        },
    ],
    rejected: [
        {
            title: "Periksa ke kasir",
            description:
                "Pesanan belum bisa diproses. Silakan hubungi kasir untuk memastikan status pembayaran atau ketersediaan pesanan.",
        },
    ],
    cancelled: [
        {
            title: "Pesanan dibatalkan",
            description:
                "Pesanan ini sudah dibatalkan. Jika masih ingin memesan, silakan buat order baru dari menu meja.",
        },
    ],
};

export default function Status({ order }) {
    const { storeProfile, identity } = usePage().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [instructionModalOpen, setInstructionModalOpen] = useState(false);
    const cancelForm = useForm({});
    const removeUnavailableForm = useForm({});
    const seenStockAlertSignatureRef = useRef("");
    const customer = identity?.customer || null;
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];
    const newOrderHref = order?.table?.qr_token
        ? route("table-order.show", order.table.qr_token)
        : null;
    const canAdjustItems = Boolean(order.can_adjust_items);
    const editOrderHref =
        canAdjustItems && order?.table?.qr_token && order?.access_token
            ? route("table-order.show", {
                  qrToken: order.table.qr_token,
                  edit_order: order.access_token,
              })
            : newOrderHref;
    const instructionSteps =
        orderInstructionSteps[order.status] || [
            {
                title: "Periksa status pesanan",
                description:
                    "Silakan lihat status terbaru di halaman ini atau hubungi kasir bila membutuhkan bantuan.",
            },
        ];
    const modifierGroupsByItem = useMemo(
        () =>
            Object.fromEntries(
                (order.items || []).map((item) => [
                    item.id,
                    (item.modifiers || []).reduce((groups, modifier) => {
                        const groupName =
                            String(modifier.group_name || "").trim() || "Topping";

                        if (!groups[groupName]) {
                            groups[groupName] = [];
                        }

                        groups[groupName].push(modifier);

                        return groups;
                    }, {}),
                ])
            ),
        [order.items]
    );
    const canCancelOrder = Boolean(order.can_cancel);
    const stockAlerts = order.stock_alerts || [];
    const stockAlertSignature = useMemo(
        () =>
            stockAlerts
                .map(
                    (alert) =>
                        `${alert.item_id}:${alert.product_id}:${alert.current_stock}:${alert.requested_qty}`
                )
                .join("|"),
        [stockAlerts]
    );

    useEffect(() => {
        if (!canAdjustItems || stockAlerts.length === 0) {
            return;
        }

        if (seenStockAlertSignatureRef.current === stockAlertSignature) {
            return;
        }

        seenStockAlertSignatureRef.current = stockAlertSignature;
        void handleRemoveUnavailableItems(true);
    }, [canAdjustItems, stockAlerts, stockAlertSignature]);

    useEffect(() => {
        if (order.status !== "pending_cashier_payment") {
            return;
        }

        const reloadOrder = () => {
            if (document.visibilityState === "hidden") {
                return;
            }

            router.reload({
                only: ["order"],
                preserveScroll: true,
                preserveState: true,
            });
        };

        const intervalId = window.setInterval(reloadOrder, 15000);
        document.addEventListener("visibilitychange", reloadOrder);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", reloadOrder);
        };
    }, [order.status]);

    const handleCancelOrder = async () => {
        const result = await Swal.fire({
            title: "Batalkan pesanan ini?",
            html: `
                <div style="text-align:left;display:grid;gap:12px;">
                    <div style="border:1px solid #fecaca;border-radius:18px;padding:14px;background:linear-gradient(135deg,#fff1f2 0%,#ffffff 100%);">
                        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#be123c;">Konfirmasi pembatalan</div>
                        <div style="margin-top:6px;font-size:13px;line-height:1.6;color:#334155;">
                            Pesanan <strong>${order.order_number}</strong> akan dibatalkan dari halaman pelanggan sebelum diproses kasir.
                        </div>
                    </div>
                    <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px;background:#fff;">
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span>Meja</span><strong>${order.table?.code || order.table?.name || "-"}</strong></div>
                        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-top:8px;"><span>Total</span><strong>${formatPrice(order.grand_total)}</strong></div>
                    </div>
                    <div style="font-size:12px;color:#64748b;">Jika masih ingin memesan nanti, Anda bisa membuat order baru dari menu meja.</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Ya, batalkan",
            cancelButtonText: "Kembali",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
            width: 560,
        });

        if (!result.isConfirmed) {
            return;
        }

        cancelForm.post(route("table-order.cancel", order.access_token), {
            preserveScroll: true,
        });
    };

    const handleRemoveUnavailableItems = async (autoOpened = false) => {
        const alertsHtml = stockAlerts
            .map(
                (alert) => `
                    <div style="display:flex;justify-content:space-between;gap:12px;border:1px solid #fecaca;border-radius:14px;padding:10px;background:#fff;">
                        <div>
                            <div style="font-weight:700;color:#0f172a;">${alert.product_title}</div>
                            <div style="margin-top:4px;font-size:12px;color:#64748b;">
                                Diminta ${alert.requested_qty} • stok sekarang ${alert.current_stock}
                            </div>
                        </div>
                        <div style="font-size:11px;font-weight:700;color:#be123c;white-space:nowrap;">
                            ${alert.issue_type === "out_of_stock" ? "Stok habis" : "Stok kurang"}
                        </div>
                    </div>
                `
            )
            .join("");

        const result = await Swal.fire({
            title: autoOpened
                ? "Stok menu berubah"
                : "Hapus menu yang kosong?",
            html: `
                <div style="text-align:left;display:grid;gap:12px;">
                    <div style="border:1px solid #fde68a;border-radius:18px;padding:14px;background:linear-gradient(135deg,#fffbeb 0%,#ffffff 100%);font-size:13px;line-height:1.6;color:#334155;">
                        Sistem mendeteksi ada menu yang stoknya berubah. Item di bawah ini bisa dihapus otomatis agar pesanan tetap bisa dilanjutkan.
                    </div>
                    <div style="display:grid;gap:8px;">${alertsHtml}</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Hapus menu kosong",
            cancelButtonText: autoOpened ? "Nanti dulu" : "Kembali",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
            width: 600,
        });

        if (!result.isConfirmed) {
            return;
        }

        removeUnavailableForm.post(
            route("table-order.remove-unavailable", order.access_token),
            {
                preserveScroll: true,
            }
        );
    };

    return (
        <>
            <Head title={`Order ${order.order_number}`} />

            {sidebarOpen ? (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            ) : null}

            {instructionModalOpen ? (
                <div
                    className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm"
                    onClick={() => setInstructionModalOpen(false)}
                />
            ) : null}

            <div className={`fixed inset-y-0 left-0 z-[70] w-[300px] max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                        <div>
                            <p className="text-sm font-bold text-slate-900">Perjalanan Pesanan</p>
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
                            <p className="text-xs text-slate-500">Pembayaran diselesaikan di kasir</p>
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
                        {editOrderHref ? (
                            <Link
                                href={editOrderHref}
                                className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    order.status === "cancelled"
                                        ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-slate-950 shadow-[0_18px_38px_-18px_rgba(251,146,60,0.9)] hover:scale-[1.01]"
                                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {order.status === "cancelled"
                                    ? "Pesan Lagi Sekarang"
                                    : "Pesan Lagi"}
                            </Link>
                        ) : null}
                    </div>
                </div>
            </div>

            {instructionModalOpen ? (
                <div className="fixed inset-x-4 top-1/2 z-[90] mx-auto w-full max-w-2xl -translate-y-1/2">
                    <div className="max-h-[85vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_-42px_rgba(15,23,42,0.78)]">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Instruksi Pesanan
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    Ikuti langkah berikut agar pesanan Anda diproses dengan lancar.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInstructionModalOpen(false)}
                                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Tutup instruksi"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                            </button>
                        </div>

                        <div className="max-h-[calc(85vh-88px)] overflow-y-auto px-6 py-5">
                            <div className="mb-4">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                    {statusLabel[order.status] || order.status}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {instructionSteps.map((step) => (
                                    <div
                                        key={step.title}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                                    >
                                        <p className="text-sm font-semibold text-slate-900">
                                            {step.title}
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-slate-600">
                                            {step.description}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                Jika ada kendala, tunjukkan nomor order{" "}
                                <span className="font-semibold">{order.order_number}</span>{" "}
                                ini ke kasir agar pesanan Anda bisa dibantu lebih cepat.
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur sm:left-5 sm:top-5"
                aria-label="Buka menu"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>

            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.1),_transparent_30%),linear-gradient(180deg,_#f7f4ee_0%,_#f8fafc_18%,_#f8fafc_100%)] px-4 py-10 text-slate-900">
                <div className="mx-auto max-w-2xl space-y-6">
                    <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(17,24,39,0.98)_0%,_rgba(41,37,36,0.95)_50%,_rgba(14,116,144,0.94)_100%)] p-6 text-white shadow-[0_32px_90px_-42px_rgba(15,23,42,0.78)]">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-[0.22em] text-amber-100/90">
                                    Perjalanan Pesanan
                                </p>
                                <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">{order.order_number}</h1>
                                <p className="mt-3 text-sm text-slate-200">
                                    Meja {order.table?.code || order.table?.name}
                                </p>
                                <div className={`mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${heroStatusTone[order.status] || "border-white/15 bg-white/10 text-slate-100"}`}>
                                    {statusLabel[order.status] || order.status}
                                </div>
                            </div>
                            <div className="grid gap-3 sm:w-[260px]">
                                <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                                        Total order
                                    </p>
                                    <p className="mt-2 text-2xl font-black text-white">
                                        {formatPrice(order.grand_total)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-300">
                                        {order.items.length} item • {order.transaction?.invoice || "Belum ada invoice kasir"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setInstructionModalOpen(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                                >
                                    <span>Lihat panduan pembayaran</span>
                                </button>
                                {order.status === "cancelled" && newOrderHref ? (
                                    <Link
                                        href={newOrderHref}
                                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_38px_-18px_rgba(251,146,60,0.9)] transition hover:scale-[1.01] hover:shadow-[0_22px_42px_-18px_rgba(244,114,182,0.85)]"
                                    >
                                        Pesan Lagi dari Meja Ini
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className={`rounded-[28px] border p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)] ${summaryCardTone[order.status] || "border-slate-200 bg-white"}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status order</p>
                            <div className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${orderStatusTone[order.status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                                {statusLabel[order.status] || order.status}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {order.status === "pending_cashier_payment"
                                    ? "Pesanan masih menunggu pembayaran dan pengecekan dari kasir."
                                    : order.status === "paid"
                                      ? "Pembayaran sudah diterima dan pesanan sedang berjalan."
                                      : order.status === "cancelled"
                                        ? "Pesanan ini sudah dibatalkan dari sistem."
                                        : "Periksa ke kasir untuk memastikan status pesanan ini."}
                            </p>
                        </div>
                        <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Atas nama</p>
                            <p className="mt-3 text-lg font-bold text-slate-900">
                                {order.customer_name || customer?.name || "Pelanggan"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {order.customer_phone || customer?.no_telp || "-"}
                            </p>
                            <p className="mt-3 text-xs text-slate-400">
                                {customer?.member_code ? `Member ${customer.member_code}` : "Self-order meja"}
                            </p>
                        </div>
                        <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Waktu order</p>
                            <p className="mt-3 text-lg font-bold text-slate-900">
                                {order.created_at_label || "-"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {order.approved_at_label ? `Update status ${order.approved_at_label}` : "Belum ada approval kasir"}
                            </p>
                        </div>
                        <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Kasir & invoice</p>
                            <p className="mt-3 text-lg font-bold text-slate-900">
                                {order.transaction?.invoice || "Belum ada"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {order.transaction?.payment_method || "Pembayaran di kasir"}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Ringkasan Pesanan</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Detail utama order, instruksi tambahan, dan aksi cepat pelanggan.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {canCancelOrder ? (
                                    <button
                                        type="button"
                                        onClick={handleCancelOrder}
                                        disabled={cancelForm.processing}
                                        className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-[linear-gradient(180deg,_#fff1f2_0%,_#ffe4e6_100%)] px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-[0_12px_28px_-20px_rgba(225,29,72,0.55)] transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:opacity-60"
                                    >
                                        {cancelForm.processing ? "Membatalkan..." : "Batalkan pesanan"}
                                    </button>
                                ) : null}
                                {editOrderHref ? (
                                    <Link
                                        href={editOrderHref}
                                        className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                                            order.status === "cancelled"
                                                ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-slate-950 shadow-[0_18px_38px_-18px_rgba(251,146,60,0.9)] hover:scale-[1.01]"
                                                : "bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_100%)] text-white shadow-[0_18px_38px_-20px_rgba(15,23,42,0.55)] hover:-translate-y-0.5"
                                        }`}
                                    >
                                        {order.status === "cancelled"
                                            ? "Pesan Lagi Sekarang"
                                            : order.status === "pending_cashier_payment"
                                              ? "Edit atau tambah pesanan"
                                              : "Pesan lagi"}
                                    </Link>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr),minmax(280px,0.65fr)]">
                            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.28)]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Catatan order
                                </p>
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {order.notes || "Tidak ada catatan tambahan untuk kasir atau dapur."}
                                </p>
                            </div>
                            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#fffaf3_0%,_#fff6ea_100%)] p-4 shadow-[0_18px_45px_-36px_rgba(180,83,9,0.22)]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Aksi yang tersedia
                                </p>
                                <div className="mt-3 space-y-3 text-sm text-slate-600">
                                        <div className="rounded-2xl border border-amber-100 bg-white/90 p-3">
                                            Tunjukkan nomor order ini ke kasir saat pembayaran.
                                        </div>
                                        <div className="rounded-2xl border border-amber-100 bg-white/90 p-3">
                                            Pantau progress dapur di halaman ini setelah kasir menyelesaikan pembayaran.
                                        </div>
                                    {canCancelOrder ? (
                                        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-rose-700">
                                            Pesanan masih bisa dibatalkan karena belum dibuat transaksi kasir.
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                        <h2 className="text-lg font-semibold">Menu Pilihanmu</h2>
                        <div className="mt-4 space-y-3">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9fafb_100%)] px-4 py-4 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.26)]"
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
                                                <div className="mt-3 space-y-2">
                                                    {Object.entries(
                                                        modifierGroupsByItem[item.id] || {}
                                                    ).map(([groupName, modifiers]) => (
                                                        <div
                                                            key={`${item.id}-${groupName}`}
                                                            className="rounded-2xl border border-amber-200/70 bg-[linear-gradient(180deg,_#fff9f2_0%,_#fff1e1_100%)] p-3"
                                                        >
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b06a48]">
                                                                Kategori topping
                                                            </p>
                                                            <p className="mt-1 text-sm font-semibold text-[#7c3d21]">
                                                                {groupName}
                                                            </p>
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                {modifiers.map((modifier) => (
                                                                    <span
                                                                        key={modifier.id}
                                                                        className="rounded-full border border-amber-100 bg-white px-2.5 py-1 text-xs font-medium text-[#9b4b2e]"
                                                                    >
                                                                        {modifier.name} x{modifier.qty}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                            {item.notes ? (
                                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                                    {item.notes}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                {formatPrice(item.line_total)}
                                            </p>
                                            {item.discount_total > 0 ? (
                                                <p className="mt-1 text-[11px] text-rose-600">
                                                    Promo sedang berlaku
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 space-y-3 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#fcfcfd_0%,_#f8fafc_100%)] p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Total sebelum promo</span>
                                <span className="font-semibold text-slate-700">
                                    {formatPrice(order.base_subtotal || order.grand_total)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Hemat dari promo</span>
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

                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                        <h2 className="text-lg font-semibold">Riwayat Pelanggan</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Order terbaru dan transaksi sebelumnya yang terkait akun pelanggan ini.
                        </p>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Riwayat order meja
                                </p>
                                <div className="mt-3 space-y-3">
                                    {recentOrders.length > 0 ? (
                                        recentOrders.map((recentOrder) => (
                                            <div key={recentOrder.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-900">
                                                            {recentOrder.order_number}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {statusLabel[recentOrder.status] || recentOrder.status}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {formatPrice(recentOrder.grand_total)}
                                                    </p>
                                                </div>
                                                {recentOrder.access_token ? (
                                                    <Link href={route("table-order.status", recentOrder.access_token)} className="mt-2 inline-flex text-xs font-semibold text-sky-700">
                                                        Lihat detail status
                                                    </Link>
                                                ) : null}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                                            Belum ada riwayat order meja lain.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    Riwayat transaksi kasir
                                </p>
                                <div className="mt-3 space-y-3">
                                    {recentTransactions.length > 0 ? (
                                        recentTransactions.map((transaction) => (
                                            <div key={transaction.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-900">
                                                            {transaction.invoice}
                                                        </p>
                                                        <p className="mt-1 text-xs capitalize text-slate-500">
                                                            {transaction.payment_status}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {formatPrice(transaction.grand_total)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                                            Belum ada riwayat transaksi kasir.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                        <h2 className="text-lg font-semibold">Progress Dapur</h2>
                        {order.transaction?.kitchen_tickets?.length ? (
                            <div className="mt-4 space-y-4">
                                {order.transaction.kitchen_tickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.24)]"
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
                                                <div key={`${ticket.id}-${stepLabel}`} className="relative rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.2)]">
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
                                                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.2)]"
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

                    <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.24)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Butuh Panduan?</h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    Buka instruksi pesanan untuk melihat langkah pembayaran dan proses dapur.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInstructionModalOpen(true)}
                                className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 hover:text-sky-800"
                            >
                                Lihat instruksi pesanan
                            </button>
                        </div>

                        {order.transaction?.invoice ? (
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                Invoice kasir Anda:{" "}
                                <span className="font-semibold">
                                    {order.transaction.invoice}
                                </span>
                            </div>
                        ) : null}

                        {newOrderHref ? (
                            <Link
                                href={newOrderHref}
                                className={`mt-5 inline-flex rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                    order.status === "cancelled"
                                        ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-slate-950 shadow-[0_18px_38px_-18px_rgba(251,146,60,0.9)] hover:scale-[1.01]"
                                        : "bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_100%)] text-white shadow-[0_18px_38px_-20px_rgba(15,23,42,0.55)] hover:-translate-y-0.5"
                                }`}
                            >
                                {order.status === "cancelled"
                                    ? "Pesan Lagi dari Meja Ini"
                                    : "Buat Order Baru"}
                            </Link>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
}
