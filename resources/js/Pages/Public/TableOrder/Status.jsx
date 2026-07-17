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
    pending_cashier_payment: "Menunggu pembayaran",
    paid: "Pembayaran selesai",
    rejected: "Belum bisa diproses",
    cancelled: "Pesanan dibatalkan",
};

const paymentMethodLabel = (value) => {
    const normalized = String(value || "").toLowerCase();

    return (
        {
            cash: "Bayar di kasir",
            bank_transfer: "Transfer bank",
            midtrans: "Midtrans",
            xendit: "Xendit",
            pakasir: "QRIS Otomatis (Online)",
        }[normalized] || value || "Pembayaran di kasir"
    );
};

export default function Status({ order }) {
    const { flash } = usePage().props;
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const cancelForm = useForm({});
    const removeUnavailableForm = useForm({});
    const paymentStatusForm = useForm({});
    const seenStockAlertSignatureRef = useRef("");

    const canAdjustItems = Boolean(order.can_adjust_items);
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

    const newOrderHref = order?.table?.qr_token
        ? route("table-order.show", order.table.qr_token)
        : null;

    const editOrderHref =
        canAdjustItems && order?.table?.qr_token && order?.access_token
            ? route("table-order.show", {
                  qrToken: order.table.qr_token,
                  edit_order: order.access_token,
              })
            : newOrderHref;

    const orderPaymentMethod =
        order.transaction?.payment_method || order.payment_method || "cash";
    const orderPaymentStatus =
        order.transaction?.payment_status ||
        (order.status === "paid" ? "paid" : "pending");
    const isSelfServiceOnlinePayment = ["midtrans", "xendit", "pakasir"].includes(
        String(orderPaymentMethod).toLowerCase()
    );
    const isOnlinePaymentPending =
        order.status === "pending_cashier_payment" &&
        isSelfServiceOnlinePayment &&
        orderPaymentStatus !== "paid";
    const displayStatusLabel = isOnlinePaymentPending
        ? "Menunggu pembayaran online"
        : statusLabel[order.status] || order.status;

    const paymentPayload = order.transaction?.payment_payload || null;
    const isPakasirPayment =
        String(orderPaymentMethod).toLowerCase() === "pakasir";
    const pakasirPaymentType = String(
        paymentPayload?.payment_method || ""
    ).toLowerCase();
    const pakasirPaymentNumber = String(
        paymentPayload?.payment_number || ""
    );
    const isPakasirQris = isPakasirPayment && pakasirPaymentType === "qris";
    const pakasirQrImageUrl =
        isPakasirQris && pakasirPaymentNumber
            ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
                  pakasirPaymentNumber
              )}`
            : null;
    const pakasirExpiresAt =
        order.transaction?.payment_expires_at || paymentPayload?.expired_at || null;
    const paymentModeCard = isSelfServiceOnlinePayment
        ? {
              badge: "Pembayaran Online",
              title: orderPaymentStatus === "paid"
                  ? "Sudah dibayar online"
                  : "Bayar online dari halaman ini",
              description: orderPaymentStatus === "paid"
                  ? "Pembayaran online sudah masuk dan pesanan dapat diproses."
                  : "Pesanan ini tidak dibayar di kasir. Selesaikan pembayaran online agar pesanan diproses.",
              className:
                  "border-emerald-200 bg-[linear-gradient(135deg,_#ecfdf5_0%,_#d1fae5_100%)]",
              badgeClassName: "bg-emerald-600 text-white",
              titleClassName: "text-emerald-950",
              descriptionClassName: "text-emerald-800",
          }
        : {
              badge: "Bayar di Kasir",
              title: order.status === "paid"
                  ? "Pembayaran kasir sudah selesai"
                  : "Pembayaran dilakukan di kasir",
              description: order.status === "paid"
                  ? "Kasir sudah menerima pembayaran untuk pesanan ini."
                  : "Pesanan ini dibayar langsung ke kasir, bukan lewat pembayaran online.",
              className:
                  "border-amber-200 bg-[linear-gradient(135deg,_#fff7ed_0%,_#ffedd5_100%)]",
              badgeClassName: "bg-amber-600 text-white",
              titleClassName: "text-amber-950",
              descriptionClassName: "text-amber-800",
          };
    const receiptRows = [
        {
            label: "Subtotal",
            value: formatPrice(order.subtotal || order.grand_total || 0),
        },
        Number(order.payment_fee_total || 0) > 0
            ? {
                  label: "Biaya pembayaran",
                  value: formatPrice(order.payment_fee_total || 0),
              }
            : null,
        {
            label: "Total",
            value: formatPrice(order.grand_total || 0),
            strong: true,
        },
    ].filter(Boolean);

    const scrollToSection = (sectionId) => {
        if (typeof window === "undefined") {
            return;
        }

        document.getElementById(sectionId)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

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

    useEffect(() => {
        if (!paymentModalOpen) {
            return;
        }

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setPaymentModalOpen(false);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleEscape);
        };
    }, [paymentModalOpen]);

    const handleCancelOrder = async () => {
        const result = await Swal.fire({
            title: "Batalkan pesanan ini?",
            text: "Pesanan yang dibatalkan harus dibuat ulang dari menu meja.",
            showCancelButton: true,
            confirmButtonText: "Ya, batalkan",
            cancelButtonText: "Kembali",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        cancelForm.post(route("table-order.cancel", order.access_token), {
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
            title: autoOpened ? "Stok menu berubah" : "Hapus menu yang kosong?",
            html: `
                <div style="text-align:left;display:grid;gap:12px;">
                    <div style="font-size:13px;line-height:1.6;color:#334155;">
                        Ada menu yang stoknya sudah berubah. Item di bawah ini bisa dihapus agar pesanan tetap lanjut.
                    </div>
                    <div style="display:grid;gap:8px;">${alertsHtml}</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Hapus item",
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

    const copyText = async (value, successMessage) => {
        if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
            return;
        }

        await navigator.clipboard.writeText(String(value));
        await Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: successMessage,
            showConfirmButton: false,
            timer: 1800,
        });
    };

    const downloadQrImage = async () => {
        if (!pakasirQrImageUrl || typeof window === "undefined") {
            return;
        }

        try {
            const response = await fetch(pakasirQrImageUrl);
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `${order.order_number || "order"}-pakasir-qris.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch {
            await Swal.fire({
                toast: true,
                position: "top-end",
                icon: "error",
                title: "Gagal mengunduh QR",
                showConfirmButton: false,
                timer: 1800,
            });
        }
    };

    return (
        <>
            <Head title={`Order ${order.order_number}`} />

            {paymentModalOpen && isPakasirPayment ? (
                <div
                    className="fixed inset-0 z-[95] bg-slate-950/60 px-4 py-6"
                    onClick={() => setPaymentModalOpen(false)}
                >
                    <div className="flex min-h-full items-center justify-center">
                        <div
                            className="max-h-[calc(100vh-3rem)] w-full max-w-md overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">
                                        {isPakasirQris
                                            ? "Bayar dengan QRIS"
                                            : "Selesaikan pembayaran"}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Selesaikan pembayaran di sini agar pesanan segera diproses.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPaymentModalOpen(false)}
                                    className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                                    aria-label="Tutup pembayaran"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                                </button>
                            </div>

                            <div className="max-h-[calc(100vh-10rem)] space-y-4 overflow-y-auto px-5 py-4">
                                {isPakasirQris && pakasirQrImageUrl ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                                        <img
                                            src={pakasirQrImageUrl}
                                            alt="QRIS Pakasir"
                                            className="mx-auto h-64 w-64 rounded-xl bg-white object-contain p-2"
                                        />
                                        <div className="mt-4 flex flex-col gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copyText(
                                                        pakasirPaymentNumber,
                                                        "QR berhasil disalin"
                                                    )
                                                }
                                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                                            >
                                                Salin QR
                                            </button>
                                            <button
                                                type="button"
                                                onClick={downloadQrImage}
                                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                                            >
                                                Download QR
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-sm text-slate-500">
                                            Nomor pembayaran
                                        </p>
                                        <p className="mt-2 break-all text-lg font-semibold text-slate-900">
                                            {pakasirPaymentNumber || "-"}
                                        </p>
                                        {pakasirPaymentNumber ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copyText(
                                                        pakasirPaymentNumber,
                                                        "Nomor pembayaran berhasil disalin"
                                                    )
                                                }
                                                className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                                            >
                                                Salin Nomor
                                            </button>
                                        ) : null}
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-500">Total bayar</span>
                                        <strong className="text-slate-900">
                                            {formatPrice(order.grand_total)}
                                        </strong>
                                    </div>
                                    {pakasirExpiresAt ? (
                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <span className="text-slate-500">Berlaku sampai</span>
                                            <strong className="text-slate-900">
                                                {new Date(pakasirExpiresAt).toLocaleString("id-ID")}
                                            </strong>
                                        </div>
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCheckPaymentStatus}
                                    disabled={paymentStatusForm.processing}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
                                >
                                    {paymentStatusForm.processing
                                        ? "Mengecek..."
                                        : "Cek Status Pembayaran"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
                <div className="mx-auto max-w-xl space-y-4">
                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] px-5 py-5 text-white">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                                        Status Pesanan
                                    </p>
                                    <h1 className="mt-2 text-2xl font-semibold">
                                        {order.table?.name || order.table?.code || "Order Meja"}
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-300">
                                        Cek progres pesanan, pembayaran, dan detail nota dari sini.
                                    </p>
                                </div>
                                {newOrderHref ? (
                                    <Link
                                        href={newOrderHref}
                                        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur"
                                    >
                                        Kembali ke Menu
                                    </Link>
                                ) : null}
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <button
                                    type="button"
                                    onClick={() => scrollToSection("ringkasan-order")}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
                                >
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        Bagian 1
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        Ringkasan Pesanan
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollToSection("daftar-pesanan")}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
                                >
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        Bagian 2
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        Nota Pesanan
                                    </p>
                                </button>
                                {isOnlinePaymentPending ? (
                                    <button
                                        type="button"
                                        onClick={() => scrollToSection("ringkasan-order")}
                                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left"
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                                            Bagian 3
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-emerald-900">
                                            Lanjutkan Pembayaran
                                        </p>
                                    </button>
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            Status
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">
                                            {displayStatusLabel}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {flash?.error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {flash.error}
                        </div>
                    ) : null}
                    {flash?.success ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {flash.success}
                        </div>
                    ) : null}
                    {flash?.info ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                            {flash.info}
                        </div>
                    ) : null}

                    <div
                        id="ringkasan-order"
                        className="rounded-[28px] border border-sky-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-5 shadow-sm"
                    >
                        <p className="text-sm text-slate-500">
                            Meja {order.table?.code || order.table?.name}
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold">
                            {order.order_number}
                        </h1>
                        <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                            {displayStatusLabel}
                        </div>
                        <p className="mt-4 text-3xl font-bold">
                            {formatPrice(order.grand_total)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            {order.items.length} item
                            {Number(order.payment_fee_total || 0) > 0
                                ? ` • termasuk biaya pembayaran ${formatPrice(order.payment_fee_total)}`
                                : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            {paymentMethodLabel(orderPaymentMethod)}
                        </p>

                        <div
                            className={`mt-4 rounded-[24px] border p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] ${paymentModeCard.className}`}
                        >
                            <span
                                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${paymentModeCard.badgeClassName}`}
                            >
                                {paymentModeCard.badge}
                            </span>
                            <p
                                className={`mt-3 text-base font-bold ${paymentModeCard.titleClassName}`}
                            >
                                {paymentModeCard.title}
                            </p>
                            <p
                                className={`mt-1 text-sm leading-6 ${paymentModeCard.descriptionClassName}`}
                            >
                                {paymentModeCard.description}
                            </p>
                        </div>

                        <div className="mt-4 flex flex-col gap-2">
                            {isOnlinePaymentPending && isPakasirPayment ? (
                                <button
                                    type="button"
                                    onClick={() => setPaymentModalOpen(true)}
                                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/25"
                                >
                                    Bayar Sekarang
                                </button>
                            ) : null}
                            {isOnlinePaymentPending && !isPakasirPayment ? (
                                <a
                                    href={order.transaction?.payment_url || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/25"
                                >
                                    Bayar Sekarang
                                </a>
                            ) : null}
                            {isOnlinePaymentPending ? (
                                <button
                                    type="button"
                                    onClick={handleCheckPaymentStatus}
                                    disabled={paymentStatusForm.processing}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
                                >
                                    {paymentStatusForm.processing
                                        ? "Mengecek..."
                                        : "Cek Status Pembayaran"}
                                </button>
                            ) : null}
                            {canAdjustItems && editOrderHref ? (
                                <Link
                                    href={editOrderHref}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700"
                                >
                                    Edit Pesanan
                                </Link>
                            ) : null}
                            {canCancelOrder ? (
                                <button
                                    type="button"
                                    onClick={handleCancelOrder}
                                    disabled={cancelForm.processing}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 disabled:opacity-60"
                                >
                                    {cancelForm.processing
                                        ? "Membatalkan..."
                                        : "Batalkan Pesanan"}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div
                        id="daftar-pesanan"
                        className="overflow-hidden rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fffaf5_100%)] shadow-sm"
                    >
                        <div className="border-b border-dashed border-slate-200 px-5 py-4">
                            <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                Nota Pesanan
                            </p>
                            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                        No. Order
                                    </p>
                                    <p className="font-semibold text-slate-900">
                                        {order.order_number}
                                    </p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Metode Bayar
                                    </p>
                                    <p className="font-semibold text-slate-900">
                                        {paymentMethodLabel(orderPaymentMethod)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Meja
                                    </p>
                                    <p className="font-semibold text-slate-900">
                                        {order.table?.code || order.table?.name || "-"}
                                    </p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Status
                                    </p>
                                    <p className="font-semibold text-slate-900">
                                        {displayStatusLabel}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            <div className="mb-3 flex items-center justify-between border-b border-dashed border-slate-200 pb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                <span>Item Pesanan</span>
                                <span>Total</span>
                            </div>

                            <div className="space-y-3">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-3 border-b border-dashed border-slate-100 pb-3 last:border-b-0 last:pb-0"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-900">
                                            {item.product_title}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {item.qty} x {formatPrice(item.unit_price)}
                                        </p>
                                        {item.notes ? (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {item.notes}
                                            </p>
                                        ) : null}
                                    </div>
                                    <strong className="whitespace-nowrap">
                                        {formatPrice(item.line_total)}
                                    </strong>
                                </div>
                            ))}
                        </div>

                            <div className="mt-4 space-y-2 border-t border-dashed border-slate-200 pt-4">
                                {receiptRows.map((row) => (
                                    <div
                                        key={row.label}
                                        className={`flex items-center justify-between gap-3 ${
                                            row.strong
                                                ? "text-base font-bold text-slate-900"
                                                : "text-sm text-slate-600"
                                        }`}
                                    >
                                        <span>{row.label}</span>
                                        <span>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
