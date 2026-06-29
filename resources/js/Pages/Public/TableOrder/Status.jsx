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

const paymentMethodLabel = (value) => {
    const normalized = String(value || "").toLowerCase();

    return (
        {
            cash: "Bayar di Kasir",
            bank_transfer: "Transfer Bank",
            midtrans: "Midtrans",
            xendit: "Xendit Invoice",
        }[normalized] || value || "Pembayaran di kasir"
    );
};

const historyOrderTone = (status) =>
    ({
        pending_cashier_payment:
            "border-amber-200 bg-amber-50 text-amber-700",
        paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
        cancelled: "border-slate-200 bg-slate-100 text-slate-700",
        rejected: "border-rose-200 bg-rose-50 text-rose-700",
    }[String(status || "").toLowerCase()] ||
    "border-slate-200 bg-slate-100 text-slate-700");

const transactionStatusLabel = (value) =>
    ({
        paid: "Pembayaran diterima",
        pending: "Menunggu pembayaran",
        failed: "Pembayaran gagal",
        expired: "Invoice kedaluwarsa",
    }[String(value || "").toLowerCase()] || value || "-");

const transactionStatusTone = (value) =>
    ({
        paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
        pending: "border-sky-200 bg-sky-50 text-sky-700",
        failed: "border-rose-200 bg-rose-50 text-rose-700",
        expired: "border-amber-200 bg-amber-50 text-amber-700",
    }[String(value || "").toLowerCase()] ||
    "border-slate-200 bg-slate-100 text-slate-700");

const actionButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition duration-200";

const primaryActionButtonClass =
    `${actionButtonClass} bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_52%,_#0ea5e9_100%)] text-white shadow-[0_20px_42px_-22px_rgba(30,64,175,0.7)] hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-20px_rgba(14,165,233,0.55)]`;

const warmActionButtonClass =
    `${actionButtonClass} bg-[linear-gradient(135deg,_#facc15_0%,_#fb923c_55%,_#f43f5e_100%)] text-slate-950 shadow-[0_20px_42px_-18px_rgba(249,115,22,0.7)] hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-18px_rgba(244,63,94,0.45)]`;

const luxurySurfaceClass =
    "border-[#ddd1bf] bg-[linear-gradient(180deg,_#fffdf9_0%,_#f6f1e8_100%)] shadow-[0_18px_60px_-34px_rgba(88,63,39,0.18)]";

const luxuryInsetClass =
    "border-[#e6dccd] bg-[linear-gradient(180deg,_#fffefb_0%,_#f8f4ec_100%)] shadow-[0_18px_45px_-36px_rgba(88,63,39,0.14)]";

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

const onlinePendingInstructionSteps = [
    {
        title: "1. Selesaikan pembayaran online",
        description:
            "Gunakan tombol bayar untuk membuka halaman invoice dan selesaikan pembayaran dari meja Anda.",
    },
    {
        title: "2. Tunggu status pembayaran masuk",
        description:
            "Halaman ini akan memeriksa status pembayaran otomatis. Anda tidak perlu datang ke kasir selama invoice masih aktif.",
    },
    {
        title: "3. Pesanan otomatis diteruskan",
        description:
            "Begitu pembayaran sukses, pesanan langsung masuk ke alur proses tanpa konfirmasi manual kasir.",
    },
    {
        title: "4. Pantau progres pesanan",
        description:
            "Setelah dibayar, cek halaman ini untuk melihat progres dapur sampai pesanan siap.",
    },
];

export default function Status({ order }) {
    const { storeProfile, identity, flash } = usePage().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [instructionModalOpen, setInstructionModalOpen] = useState(false);
    const cancelForm = useForm({});
    const removeUnavailableForm = useForm({});
    const paymentLinkForm = useForm({});
    const paymentStatusForm = useForm({});
    const seenStockAlertSignatureRef = useRef("");
    const customer = identity?.customer || null;
    const recentOrders = customer?.recent_orders || [];
    const recentTransactions = customer?.recent_transactions || [];
    const recentOrdersPagination = customer?.recent_orders_pagination || null;
    const recentTransactionsPagination =
        customer?.recent_transactions_pagination || null;
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
    const orderPaymentMethod = order.transaction?.payment_method || order.payment_method || "cash";
    const orderPaymentStatus = order.transaction?.payment_status || (order.status === "paid" ? "paid" : "pending");
    const isSelfServiceOnlinePayment = ["midtrans", "xendit"].includes(
        String(orderPaymentMethod).toLowerCase()
    );
    const isManualTransferPayment =
        String(orderPaymentMethod).toLowerCase() === "bank_transfer";
    const isOnlinePaymentPending =
        order.status === "pending_cashier_payment" &&
        isSelfServiceOnlinePayment &&
        orderPaymentStatus !== "paid";
    const displayStatusKey = isOnlinePaymentPending
        ? "pending_online_payment"
        : order.status;
    const displayStatusLabel =
        displayStatusKey === "pending_online_payment"
            ? "Menunggu pembayaran online"
            : statusLabel[order.status] || order.status;
    const instructionSteps = isOnlinePaymentPending
        ? onlinePendingInstructionSteps
        : orderInstructionSteps[order.status] || [
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
    const statusPageParams = (overrides = {}) => ({
        orders_page: recentOrdersPagination?.current_page || 1,
        transactions_page: recentTransactionsPagination?.current_page || 1,
        ...overrides,
    });
    const handleSidebarNavigate = (sectionId) => {
        setSidebarOpen(false);

        if (typeof window === "undefined") {
            return;
        }

        window.setTimeout(() => {
            document.getElementById(sectionId)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 180);
    };
    const stockAlerts = order.stock_alerts || [];
    const canRegeneratePaymentLink =
        isOnlinePaymentPending &&
        !order.transaction?.payment_url;
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

    const handleRegeneratePaymentLink = () => {
        paymentLinkForm.post(route("table-order.payment-link", order.access_token), {
            preserveScroll: true,
        });
    };

    const handleCheckPaymentStatus = () => {
        paymentStatusForm.post(route("table-order.check-payment", order.access_token), {
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
                        <div className="mb-4 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status saat ini</p>
                            <div className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${orderStatusTone[order.status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                                {displayStatusLabel}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-slate-900">
                                Meja {order.table?.code || order.table?.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {isSelfServiceOnlinePayment
                                    ? "Pembayaran bisa diselesaikan langsung dari meja"
                                    : isManualTransferPayment
                                      ? "Transfer manual menunggu konfirmasi admin/kasir"
                                      : "Pembayaran diselesaikan di kasir"}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-slate-900">
                                {formatPrice(order.grand_total)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {order.items.length} item • {paymentMethodLabel(orderPaymentMethod)}
                            </p>
                        </div>

                        <div className="mb-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
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

                        <div className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)]">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Navigasi cepat</p>
                            <div className="mt-3 grid gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSidebarNavigate("order-summary")}
                                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    <span>Ringkasan pesanan</span>
                                    <span className="text-slate-400">›</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSidebarNavigate("kitchen-progress")}
                                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    <span>Progress dapur</span>
                                    <span className="text-slate-400">›</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSidebarNavigate("order-help")}
                                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    <span>Panduan pesanan</span>
                                    <span className="text-slate-400">›</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSidebarNavigate("customer-history")}
                                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    <span>Riwayat pelanggan</span>
                                    <span className="text-slate-400">›</span>
                                </button>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
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
                                className={`w-full ${
                                    order.status === "cancelled"
                                        ? warmActionButtonClass
                                        : primaryActionButtonClass
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
                                    {displayStatusLabel}
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

            <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,248,235,0.85),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(214,211,209,0.32),_transparent_28%),linear-gradient(180deg,_#f7f1e7_0%,_#f4ede3_26%,_#f6f3ee_58%,_#f8f7f4_100%)] px-4 py-10 text-slate-900">
                <div className="mx-auto max-w-2xl space-y-6">
                    {flash?.error ? (
                        <div className="rounded-[24px] border border-rose-200 bg-[linear-gradient(180deg,_#fff7f7_0%,_#ffe9e9_100%)] px-5 py-4 text-sm text-rose-700 shadow-[0_18px_40px_-34px_rgba(225,29,72,0.45)]">
                            {flash.error}
                        </div>
                    ) : null}
                    {flash?.success ? (
                        <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,_#f4fdf7_0%,_#e7f9ee_100%)] px-5 py-4 text-sm text-emerald-700 shadow-[0_18px_40px_-34px_rgba(5,150,105,0.45)]">
                            {flash.success}
                        </div>
                    ) : null}
                    {flash?.info ? (
                        <div className="rounded-[24px] border border-sky-200 bg-[linear-gradient(180deg,_#f5fbff_0%,_#eaf6ff_100%)] px-5 py-4 text-sm text-sky-700 shadow-[0_18px_40px_-34px_rgba(2,132,199,0.35)]">
                            {flash.info}
                        </div>
                    ) : null}
                    <div className="overflow-hidden rounded-[32px] border border-[#d8c7ab] bg-[linear-gradient(145deg,_#241c18_0%,_#3d2f27_42%,_#69513f_100%)] p-6 text-white shadow-[0_32px_90px_-42px_rgba(54,35,24,0.5)]">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-[0.22em] text-[#f4dfbf]">
                                    Perjalanan Pesanan
                                </p>
                                <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">{order.order_number}</h1>
                                <p className="mt-3 text-sm text-[#efe3d6]">
                                    Meja {order.table?.code || order.table?.name}
                                </p>
                                <div className={`mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${heroStatusTone[order.status] || "border-white/15 bg-white/10 text-slate-100"}`}>
                                    {displayStatusLabel}
                                </div>
                                {isOnlinePaymentPending ? (
                                    <div className="mt-4 max-w-md rounded-[24px] border border-[#d9c7a7]/45 bg-[rgba(255,248,236,0.08)] p-4 text-white shadow-[0_18px_40px_-28px_rgba(120,84,52,0.42)] backdrop-blur-sm">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f4dfbf]">
                                            Langkah berikutnya
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-[#f8efe4]">
                                            Selesaikan pembayaran Xendit terlebih dulu agar pesanan otomatis lanjut diproses.
                                        </p>
                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                            {order.transaction?.payment_url ? (
                                                <a
                                                    href={order.transaction.payment_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#facc15_0%,_#f59e0b_100%)] px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_38px_-20px_rgba(250,204,21,0.65)] hover:-translate-y-0.5"
                                                >
                                                    Bayar Sekarang
                                                </a>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={handleCheckPaymentStatus}
                                                disabled={paymentStatusForm.processing}
                                                className="inline-flex items-center justify-center rounded-2xl border border-[#e8d8bf]/40 bg-[rgba(255,248,236,0.08)] px-4 py-3 text-sm font-semibold text-[#fff8f0] transition hover:bg-[rgba(255,248,236,0.16)] disabled:opacity-60"
                                            >
                                                {paymentStatusForm.processing
                                                    ? "Mengecek..."
                                                    : "Cek Status Pembayaran"}
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            <div className="grid gap-3 sm:w-[260px]">
                                <div className="rounded-[26px] border border-[#e3d3ba]/20 bg-[rgba(255,248,236,0.08)] p-4 backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e7d5bf]">
                                        Total order
                                    </p>
                                    <p className="mt-2 text-2xl font-black text-white">
                                        {formatPrice(order.grand_total)}
                                    </p>
                                    <p className="mt-1 text-xs text-[#efe3d6]">
                                        {order.items.length} item • {order.transaction?.invoice || "Belum ada invoice kasir"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setInstructionModalOpen(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e8d8bf]/35 bg-[rgba(255,248,236,0.08)] px-4 py-3 text-sm font-semibold text-[#fff8f0] transition hover:bg-[rgba(255,248,236,0.16)]"
                                >
                                    <span>Lihat panduan pembayaran</span>
                                </button>
                                {order.status === "cancelled" && newOrderHref ? (
                                    <Link
                                        href={newOrderHref}
                                        className={warmActionButtonClass}
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
                                {displayStatusLabel}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {order.status === "pending_cashier_payment"
                                    ? isSelfServiceOnlinePayment
                                        ? "Pesanan menunggu pembayaran online dari meja. Setelah berhasil dibayar, order otomatis lanjut diproses."
                                        : isManualTransferPayment
                                          ? "Pesanan menunggu transfer manual dan konfirmasi admin/kasir sebelum lanjut diproses."
                                          : "Pesanan masih menunggu pembayaran dan pengecekan dari kasir."
                                    : order.status === "paid"
                                      ? "Pembayaran sudah diterima dan pesanan sedang berjalan."
                                      : order.status === "cancelled"
                                        ? "Pesanan ini sudah dibatalkan dari sistem."
                                        : "Periksa ke kasir untuk memastikan status pesanan ini."}
                            </p>
                        </div>
                        <div className={`rounded-[28px] border p-5 ${luxurySurfaceClass}`}>
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
                        <div className={`rounded-[28px] border p-5 ${luxurySurfaceClass}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Waktu order</p>
                            <p className="mt-3 text-lg font-bold text-slate-900">
                                {order.created_at_label || "-"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {order.approved_at_label ? `Update status ${order.approved_at_label}` : "Belum ada konfirmasi pembayaran"}
                            </p>
                        </div>
                        <div className={`rounded-[28px] border p-5 ${luxurySurfaceClass}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Kasir & invoice</p>
                            <p className="mt-3 text-lg font-bold text-slate-900">
                                {order.transaction?.invoice || "Belum ada"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {paymentMethodLabel(orderPaymentMethod)}
                            </p>
                            {order.transaction?.bank_account ? (
                                <p className="mt-2 text-xs text-slate-500">
                                    {order.transaction.bank_account.bank_name} •{" "}
                                    {order.transaction.bank_account.account_number} a.n.{" "}
                                    {order.transaction.bank_account.account_name}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div id="order-summary" className={`rounded-[30px] border p-6 ${luxurySurfaceClass}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Ringkasan Pesanan</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Detail utama order, instruksi tambahan, dan aksi cepat pelanggan.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {canRegeneratePaymentLink ? (
                                    <button
                                        type="button"
                                        onClick={handleRegeneratePaymentLink}
                                        disabled={paymentLinkForm.processing}
                                        className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,_#f5fbff_0%,_#e0f2fe_100%)] px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-[0_18px_38px_-20px_rgba(2,132,199,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60"
                                    >
                                        {paymentLinkForm.processing
                                            ? "Membuat link..."
                                            : "Buat Ulang Link Bayar"}
                                    </button>
                                ) : null}
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
                                        className={`${
                                            order.status === "cancelled"
                                                ? warmActionButtonClass
                                                : primaryActionButtonClass
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
                            <div className={`flex h-full flex-col rounded-[24px] border p-4 ${luxuryInsetClass}`}>
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

                    <div id="kitchen-progress" className={`rounded-[30px] border p-6 ${luxurySurfaceClass}`}>
                        <h2 className="text-lg font-semibold">Menu Pilihanmu</h2>
                        <div className="mt-4 space-y-3">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className={`rounded-[24px] border px-4 py-4 ${luxuryInsetClass}`}
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

                        <div className={`mt-6 space-y-3 rounded-[24px] border p-4 ${luxuryInsetClass}`}>
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


                    <div className={`rounded-[30px] border p-6 ${luxurySurfaceClass}`}>
                        <h2 className="text-lg font-semibold">Progress Dapur</h2>
                        {order.transaction?.kitchen_tickets?.length ? (
                            <div className="mt-4 space-y-4">
                                {order.transaction.kitchen_tickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className={`rounded-[24px] border p-4 ${luxuryInsetClass}`}
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

                    <div id="order-help" className={`rounded-[30px] border p-6 ${luxurySurfaceClass}`}>
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
                                className={`mt-5 ${
                                    order.status === "cancelled"
                                        ? warmActionButtonClass
                                        : primaryActionButtonClass
                                }`}
                            >
                                {order.status === "cancelled"
                                    ? "Pesan Lagi dari Meja Ini"
                                    : "Buat Order Baru"}
                            </Link>
                        ) : null}
                    </div>

                    <div id="customer-history" className={`rounded-[30px] border p-6 ${luxurySurfaceClass}`}>
                        <h2 className="text-lg font-semibold">Riwayat Pelanggan</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Order meja dan transaksi kasir sebelumnya untuk akun pelanggan ini.
                        </p>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className={`flex h-full flex-col rounded-[24px] border p-4 ${luxuryInsetClass}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                            Riwayat order meja
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Lacak status pesanan pelanggan dari meja.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                        {recentOrders.length} order
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-1 flex-col">
                                    <div className="space-y-3">
                                    {recentOrders.length > 0 ? (
                                        recentOrders.map((recentOrder) => (
                                            <div
                                                key={recentOrder.id}
                                                className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.24)]"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-900">
                                                            {recentOrder.order_number}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${historyOrderTone(
                                                                    recentOrder.status
                                                                )}`}
                                                            >
                                                                {statusLabel[recentOrder.status] || recentOrder.status}
                                                            </span>
                                                            {recentOrder.payment_method ? (
                                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                                    {paymentMethodLabel(recentOrder.payment_method)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-slate-900">
                                                            {formatPrice(recentOrder.grand_total)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                        Status order pelanggan
                                                    </div>
                                                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                        Pantau detail status pesanan ini
                                                    </div>
                                                </div>
                                                {recentOrder.access_token ? (
                                                    <Link
                                                        href={route("table-order.status", recentOrder.access_token)}
                                                        className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                                                    >
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
                                    {recentOrdersPagination &&
                                    recentOrdersPagination.total >
                                        recentOrdersPagination.per_page ? (
                                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                            <p className="text-xs text-slate-500">
                                                Halaman {recentOrdersPagination.current_page} dari{" "}
                                                {recentOrdersPagination.last_page}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {recentOrdersPagination.has_prev ? (
                                                    <Link
                                                        href={route(
                                                            "table-order.status",
                                                            order.access_token
                                                        )}
                                                        data={statusPageParams({
                                                            orders_page:
                                                                recentOrdersPagination.current_page -
                                                                1,
                                                        })}
                                                        preserveScroll
                                                        className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                                    >
                                                        Previous
                                                    </Link>
                                                ) : null}
                                                {recentOrdersPagination.has_next ? (
                                                    <Link
                                                        href={route(
                                                            "table-order.status",
                                                            order.access_token
                                                        )}
                                                        data={statusPageParams({
                                                            orders_page:
                                                                recentOrdersPagination.current_page +
                                                                1,
                                                        })}
                                                        preserveScroll
                                                        className="inline-flex items-center rounded-2xl border border-[#d8c7ab] bg-[#f7efe2] px-3 py-2 text-xs font-semibold text-[#7a5338] hover:bg-[#f1e5d2]"
                                                    >
                                                        Next
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className={`flex h-full flex-col rounded-[24px] border p-4 ${luxuryInsetClass}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                            Riwayat transaksi kasir
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Riwayat invoice pembayaran yang sudah tercatat di sistem.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                        {recentTransactions.length} transaksi
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-1 flex-col">
                                    <div className="space-y-3">
                                    {recentTransactions.length > 0 ? (
                                        recentTransactions.map((transaction) => (
                                            <div
                                                key={transaction.id}
                                                className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.24)]"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-900">
                                                            {transaction.invoice}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${transactionStatusTone(
                                                                    transaction.payment_status
                                                                )}`}
                                                            >
                                                                {transactionStatusLabel(transaction.payment_status)}
                                                            </span>
                                                            {transaction.payment_method ? (
                                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                                    {paymentMethodLabel(transaction.payment_method)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-slate-900">
                                                            {formatPrice(transaction.grand_total)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                        Invoice kasir / gateway pembayaran
                                                    </div>
                                                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                                        Status pembayaran terakhir yang tercatat
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                                            Belum ada riwayat transaksi kasir.
                                        </div>
                                    )}
                                    </div>
                                    {recentTransactionsPagination &&
                                    recentTransactionsPagination.total >
                                        recentTransactionsPagination.per_page ? (
                                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                                            <p className="text-xs text-slate-500">
                                                Halaman {recentTransactionsPagination.current_page} dari{" "}
                                                {recentTransactionsPagination.last_page}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {recentTransactionsPagination.has_prev ? (
                                                    <Link
                                                        href={route(
                                                            "table-order.status",
                                                            order.access_token
                                                        )}
                                                        data={statusPageParams({
                                                            transactions_page:
                                                                recentTransactionsPagination.current_page -
                                                                1,
                                                        })}
                                                        preserveScroll
                                                        className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                                    >
                                                        Previous
                                                    </Link>
                                                ) : null}
                                                {recentTransactionsPagination.has_next ? (
                                                    <Link
                                                        href={route(
                                                            "table-order.status",
                                                            order.access_token
                                                        )}
                                                        data={statusPageParams({
                                                            transactions_page:
                                                                recentTransactionsPagination.current_page +
                                                                1,
                                                        })}
                                                        preserveScroll
                                                        className="inline-flex items-center rounded-2xl border border-[#d8c7ab] bg-[#f7efe2] px-3 py-2 text-xs font-semibold text-[#7a5338] hover:bg-[#f1e5d2]"
                                                    >
                                                        Next
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
