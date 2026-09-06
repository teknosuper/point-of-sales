import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import PaymentModal from "./components/PaymentModal";
import ChangePaymentMethodModal from "./components/ChangePaymentMethodModal";
import {
    formatPrice,
    paymentMethodLabel,
    STATUS_LABEL as statusLabel,
} from "./utils/tableOrderHelpers";

export default function Status({
    order,
    paymentMethods = [],
    bankAccounts = [],
}) {
    const { flash } = usePage().props;
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [changePaymentModalOpen, setChangePaymentModalOpen] = useState(false);
    const cancelForm = useForm({});
    const removeUnavailableForm = useForm({});
    const paymentStatusForm = useForm({});
    const seenStockAlertSignatureRef = useRef("");

    const canAdjustItems = Boolean(order.can_adjust_items);
    const canCancelOrder = Boolean(order.can_cancel);
    const canChangePaymentMethod = Boolean(order.can_change_payment_method);
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

    const isBankTransfer = String(orderPaymentMethod).toLowerCase() === "bank_transfer";
    const bankAccountInfo = order.transaction?.bank_account
        || (bankAccounts || []).find((b) => String(b.id) === String(order.transaction?.bank_account_id))
        || bankAccounts?.[0]
        || null;

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
        : isBankTransfer
          ? {
                badge: "Transfer Bank",
                title: order.status === "paid"
                    ? "Transfer sudah diverifikasi"
                    : "Transfer manual ke rekening",
                description: order.status === "paid"
                    ? "Kasir/admin sudah menerima dan memverifikasi transfer Anda."
                    : "Transfer sesuai nominal ke rekening tujuan, lalu konfirmasikan ke kasir/admin.",
                className:
                    "border-sky-200 bg-[linear-gradient(135deg,_#f0f9ff_0%,_#e0f2fe_100%)]",
                badgeClassName: "bg-sky-600 text-white",
                titleClassName: "text-sky-950",
                descriptionClassName: "text-sky-800",
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

            <PaymentModal
                open={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                isPakasirPayment={isPakasirPayment}
                isPakasirQris={isPakasirQris}
                pakasirQrImageUrl={pakasirQrImageUrl}
                pakasirPaymentNumber={pakasirPaymentNumber}
                pakasirExpiresAt={pakasirExpiresAt}
                grandTotal={order.grand_total}
                onCopyText={copyText}
                onDownloadQr={downloadQrImage}
                onCheckPaymentStatus={handleCheckPaymentStatus}
                paymentStatusProcessing={paymentStatusForm.processing}
            />

            <ChangePaymentMethodModal
                open={changePaymentModalOpen}
                onClose={() => setChangePaymentModalOpen(false)}
                order={order}
                paymentMethods={paymentMethods}
                bankAccounts={bankAccounts}
            />

            <div className="min-h-screen bg-slate-50">
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{order.table?.name || order.table?.code || "Meja"}</p>
                            <p className="truncate text-xs text-slate-500">{order.order_number}</p>
                        </div>
                        {newOrderHref ? (
                            <Link href={newOrderHref} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                                ← Menu
                            </Link>
                        ) : null}
                    </div>
                </div>

                <div className="mx-auto max-w-lg space-y-3 px-4 py-4 pb-8">
                    {/* Flash messages */}
                    {flash?.error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{flash.error}</div>}
                    {flash?.success && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{flash.success}</div>}
                    {flash?.info && <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">{flash.info}</div>}

                    {/* Status & total */}
                    <div id="ringkasan-order" className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/80">
                        <div className="bg-slate-900 px-5 py-5 text-white">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-4xl font-bold tracking-tight">{formatPrice(order.grand_total)}</p>
                                    <p className="mt-1 text-sm text-slate-400">
                                        {order.items.length} item
                                        {Number(order.payment_fee_total || 0) > 0 ? ` • +${formatPrice(order.payment_fee_total)} biaya` : ""}
                                    </p>
                                </div>
                                <span className={`mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                                    order.status === "paid"
                                        ? "bg-emerald-500 text-white"
                                        : order.status === "cancelled" || order.status === "rejected"
                                          ? "bg-rose-500 text-white"
                                          : "bg-amber-400 text-amber-950"
                                }`}>
                                    {displayStatusLabel}
                                </span>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            {/* Info singkat */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Meja</span>
                                <span className="font-semibold text-slate-900">{order.table?.code || order.table?.name || "-"}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm">
                                <span className="text-slate-500">Pembayaran</span>
                                <span className="font-semibold text-slate-900">{paymentMethodLabel(orderPaymentMethod)}</span>
                            </div>

                            {/* Badge metode bayar */}
                            <div className={`mt-4 rounded-2xl border px-4 py-3 ${paymentModeCard.className}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${paymentModeCard.badgeClassName}`}>
                                        {paymentModeCard.badge}
                                    </span>
                                    <span className={`text-sm font-semibold ${paymentModeCard.titleClassName}`}>
                                        {paymentModeCard.title}
                                    </span>
                                </div>
                            </div>

                            {/* Rincian rekening untuk transfer bank */}
                            {isBankTransfer && bankAccountInfo && (
                                <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
                                            Rekening Tujuan Transfer
                                        </p>
                                        <span className="rounded-md bg-sky-200/80 px-2 py-0.5 text-xs font-bold text-sky-900">
                                            {bankAccountInfo.bank_name}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white p-3 shadow-sm">
                                        <div className="min-w-0">
                                            <p className="font-mono text-base font-bold text-slate-900">
                                                {bankAccountInfo.account_number}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                a.n. {bankAccountInfo.account_name}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(bankAccountInfo.account_number, "Nomor rekening disalin")}
                                            className="shrink-0 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
                                        >
                                            Salin
                                        </button>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                        Transfer pas sesuai total <strong className="text-slate-800">{formatPrice(order.grand_total)}</strong>, lalu konfirmasi ke kasir.
                                    </p>
                                </div>
                            )}

                            {/* Tombol aksi */}
                            <div className="mt-4 flex flex-col gap-2">
                                {isOnlinePaymentPending && isPakasirPayment && (
                                    <button type="button" onClick={() => setPaymentModalOpen(true)} className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20">
                                        Bayar Sekarang
                                    </button>
                                )}
                                {isOnlinePaymentPending && !isPakasirPayment && (
                                    <a href={order.transaction?.payment_url || "#"} target="_blank" rel="noreferrer" className="block w-full rounded-xl bg-emerald-600 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-emerald-600/20">
                                        Bayar Sekarang
                                    </a>
                                )}
                                {isOnlinePaymentPending && (
                                    <button type="button" onClick={handleCheckPaymentStatus} disabled={paymentStatusForm.processing} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-medium text-slate-700 disabled:opacity-50">
                                        {paymentStatusForm.processing ? "Mengecek..." : "Cek Status Pembayaran"}
                                    </button>
                                )}
                                {canChangePaymentMethod && (
                                    <button
                                        type="button"
                                        onClick={() => setChangePaymentModalOpen(true)}
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 10h14l-4-4" />
                                            <path d="M17 14H3l4 4" />
                                        </svg>
                                        <span>Ganti Metode Pembayaran</span>
                                    </button>
                                )}
                                {canAdjustItems && editOrderHref && (
                                    <Link href={editOrderHref} className="block w-full rounded-xl border border-slate-200 bg-white py-3 text-center text-sm font-medium text-slate-700">
                                        Edit Pesanan
                                    </Link>
                                )}
                                {canCancelOrder && (
                                    <button type="button" onClick={handleCancelOrder} disabled={cancelForm.processing} className="w-full rounded-xl border border-rose-100 bg-rose-50 py-3 text-sm font-medium text-rose-600 disabled:opacity-50">
                                        {cancelForm.processing ? "Membatalkan..." : "Batalkan"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Nota pesanan */}
                    <div id="daftar-pesanan" className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/80">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Rincian Pesanan</p>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-slate-500">{order.order_number}</span>
                                <span className="font-semibold text-slate-900">{order.table?.code || order.table?.name}</span>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            <div className="space-y-3">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="font-medium text-slate-900">{item.product_title}</p>
                                            <p className="mt-0.5 text-sm text-slate-500">{item.qty} × {formatPrice(item.unit_price)}</p>
                                            {item.notes && <p className="mt-0.5 text-xs text-slate-400 italic">{item.notes}</p>}
                                        </div>
                                        <p className="shrink-0 font-semibold text-slate-900">{formatPrice(item.line_total)}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                                {receiptRows.map((row) => (
                                    <div key={row.label} className={`flex items-center justify-between gap-3 ${row.strong ? "text-base font-bold text-slate-900" : "text-sm text-slate-500"}`}>
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
