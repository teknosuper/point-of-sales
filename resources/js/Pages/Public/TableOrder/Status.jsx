import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import PaymentModal from "./components/PaymentModal";
import ChangePaymentMethodModal from "./components/ChangePaymentMethodModal";
import {
    formatPrice,
    paymentMethodLabel,
    stripOrderTypeNotes,
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
    const kitchenTickets = order.transaction?.kitchen_tickets || [];
    const kitchenStatuses = kitchenTickets.map((ticket) =>
        String(ticket.status || "pending").toLowerCase()
    );
    const paymentCompleted =
        order.status === "paid" || orderPaymentStatus === "paid";
    const kitchenStarted = kitchenStatuses.some((status) =>
        ["acknowledged", "preparing", "ready", "completed"].includes(status)
    );
    const kitchenReady =
        kitchenStatuses.length > 0 &&
        kitchenStatuses.every((status) => ["ready", "completed"].includes(status));
    const isStopped = ["cancelled", "rejected"].includes(order.status);
    const progressSteps = [
        { label: "Dikirim", done: true, active: !paymentCompleted },
        {
            label: "Dibayar",
            done: paymentCompleted,
            active: paymentCompleted && !kitchenStarted,
        },
        {
            label: kitchenReady ? "Siap" : "Diproses",
            done: kitchenReady,
            active: paymentCompleted && (kitchenStarted || !kitchenReady),
        },
    ];

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
                pakasirPaymentUrl={order.transaction?.payment_url}
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

            <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
                <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status pesanan</p>
                            <p className="truncate text-sm font-bold text-slate-900">{order.order_number}</p>
                        </div>
                        {newOrderHref ? (
                            <Link href={newOrderHref} className="shrink-0 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200">
                                Kembali ke menu
                            </Link>
                        ) : null}
                    </div>
                </header>

                <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-10 sm:px-6">
                    {flash?.error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{flash.error}</div>}
                    {flash?.success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{flash.success}</div>}
                    {flash?.info && <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">{flash.info}</div>}

                    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)]">
                        <div className="p-5 sm:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                        paymentCompleted
                                            ? "bg-emerald-100 text-emerald-700"
                                            : isStopped
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-amber-100 text-amber-800"
                                    }`}>
                                        {displayStatusLabel}
                                    </span>
                                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                        {formatPrice(order.grand_total)}
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {order.items.length} item · Meja {order.table?.code || order.table?.name || "-"}
                                    </p>
                                </div>
                                <div className="text-right text-xs text-slate-400">
                                    <p>{order.created_at_label}</p>
                                    <p className="mt-1 font-semibold text-slate-600">{paymentMethodLabel(orderPaymentMethod)}</p>
                                </div>
                            </div>

                            {!isStopped ? (
                                <div className="mt-6 grid grid-cols-3 gap-2" aria-label="Progres pesanan">
                                    {progressSteps.map((step, index) => (
                                        <div key={step.label} className="relative text-center">
                                            {index > 0 ? (
                                                <span className={`absolute right-1/2 top-4 h-0.5 w-full ${step.done || step.active ? "bg-primary-400" : "bg-slate-200"}`} />
                                            ) : null}
                                            <span className={`relative z-[1] mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                                                step.done
                                                    ? "bg-primary-600 text-white"
                                                    : step.active
                                                      ? "bg-primary-100 text-primary-700 ring-4 ring-primary-50"
                                                      : "bg-slate-100 text-slate-400"
                                            }`}>
                                                {step.done ? "✓" : index + 1}
                                            </span>
                                            <p className={`mt-2 text-[11px] font-bold ${step.done || step.active ? "text-slate-800" : "text-slate-400"}`}>
                                                {step.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            <div className={`mt-5 rounded-2xl border px-4 py-3 ${paymentModeCard.className}`}>
                                <p className={`text-sm font-bold ${paymentModeCard.titleClassName}`}>{paymentModeCard.title}</p>
                                <p className={`mt-1 text-xs leading-5 ${paymentModeCard.descriptionClassName}`}>{paymentModeCard.description}</p>
                            </div>

                            {isOnlinePaymentPending ? (
                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    {isPakasirPayment ? (
                                        <button type="button" onClick={() => setPaymentModalOpen(true)} className="rounded-2xl bg-primary-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700">
                                            Bayar sekarang
                                        </button>
                                    ) : (
                                        <a href={order.transaction?.payment_url || "#"} target="_blank" rel="noreferrer" className="rounded-2xl bg-primary-600 px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700">
                                            Bayar sekarang
                                        </a>
                                    )}
                                    <button type="button" onClick={handleCheckPaymentStatus} disabled={paymentStatusForm.processing} className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                                        {paymentStatusForm.processing ? "Mengecek..." : "Cek pembayaran"}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </section>

                    {stockAlerts.length > 0 ? (
                        <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold text-rose-800">Stok pesanan berubah</p>
                                <p className="mt-1 text-xs text-rose-700">{stockAlerts.length} item perlu diperiksa sebelum dilanjutkan.</p>
                            </div>
                            <button type="button" onClick={() => handleRemoveUnavailableItems(false)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white">
                                Periksa item
                            </button>
                        </section>
                    ) : null}

                    {isBankTransfer && bankAccountInfo ? (
                        <section className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Rekening tujuan</p>
                                    <p className="mt-2 font-mono text-xl font-black text-slate-950">{bankAccountInfo.account_number}</p>
                                    <p className="mt-1 text-xs text-slate-500">{bankAccountInfo.bank_name} · a.n. {bankAccountInfo.account_name}</p>
                                </div>
                                <button type="button" onClick={() => copyText(bankAccountInfo.account_number, "Nomor rekening disalin")} className="rounded-xl bg-sky-100 px-4 py-2.5 text-xs font-bold text-sky-700">
                                    Salin
                                </button>
                            </div>
                        </section>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 p-3 shadow-sm sm:p-5">
                            <div className="mx-auto w-full max-w-[360px] bg-white px-5 py-6 font-mono text-[12px] leading-[1.45] text-slate-900 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.5)] sm:px-6">
                                <div className="text-center">
                                    <p className="text-sm font-black tracking-[0.12em]">RINCIAN PESANAN</p>
                                    <p className="mt-1 text-[10px] text-slate-500">{order.order_number} · {order.items.length} ITEM</p>
                                </div>

                                <div className="my-4 border-t border-dashed border-slate-400" />
                                <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between gap-3">
                                        <span>Tanggal</span>
                                        <span className="text-right">{order.created_at_label}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Meja</span>
                                        <span className="font-bold">{order.table?.code || order.table?.name || "-"}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span>Pelanggan</span>
                                        <span className="text-right font-bold">{order.customer_name || "Umum"}</span>
                                    </div>
                                </div>

                                <div className="my-4 border-t border-dashed border-slate-400" />
                                <div className="space-y-4">
                                    {order.items.map((item) => {
                                        const modifierTotal = (item.modifiers || []).reduce(
                                            (total, modifier) => total + Number(modifier.total_price || 0),
                                            0
                                        );
                                        const baseLineTotal = Math.max(0, Number(item.line_total || 0) - modifierTotal);
                                        const baseUnitPrice = baseLineTotal / Math.max(1, Number(item.qty || 1));
                                        const cleanNotes = stripOrderTypeNotes(item.notes);

                                        return (
                                            <article key={item.id}>
                                                <div className="flex items-start justify-between gap-3 font-black">
                                                    <span className="min-w-0 break-words uppercase">{item.product_title}</span>
                                                    <span className="shrink-0">{formatPrice(baseLineTotal)}</span>
                                                </div>
                                                <div className="mt-1 flex justify-between gap-3 text-[11px] text-slate-600">
                                                    <span>{item.qty} × {formatPrice(baseUnitPrice)}</span>
                                                    <span>{item.order_type === "take_away" ? "BUNGKUS" : "DINE IN"}</span>
                                                </div>
                                                {(item.modifiers || []).map((modifier) => (
                                                    <div key={modifier.id} className="mt-1 flex justify-between gap-3 text-[11px]">
                                                        <span className="min-w-0 break-words">+ {modifier.name}</span>
                                                        <span className="shrink-0">{formatPrice(modifier.total_price)}</span>
                                                    </div>
                                                ))}
                                                {cleanNotes ? (
                                                    <p className="mt-1 break-words text-[10px] italic text-slate-500">* {cleanNotes}</p>
                                                ) : null}
                                            </article>
                                        );
                                    })}
                                </div>

                                {order.notes ? (
                                    <>
                                        <div className="my-4 border-t border-dashed border-slate-400" />
                                        <p className="break-words text-[10px]">CATATAN: {order.notes}</p>
                                    </>
                                ) : null}

                                <div className="my-4 border-t border-dashed border-slate-400" />
                                <div className="space-y-1.5">
                                    {receiptRows.map((row) => (
                                        <div key={row.label} className={`flex items-center justify-between gap-3 ${row.strong ? "border-y border-double border-slate-700 py-2 text-sm font-black" : "text-[11px]"}`}>
                                            <span className={row.strong ? "uppercase" : ""}>{row.label}</span>
                                            <span>{row.value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 border-t border-dashed border-slate-400 pt-4 text-center text-[10px] text-slate-500">
                                    Simpan halaman ini sebagai bukti pesanan
                                </div>
                            </div>
                        </section>

                        {(canChangePaymentMethod || (canAdjustItems && editOrderHref) || canCancelOrder) ? (
                            <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Kelola pesanan</p>
                                <div className="mt-3 space-y-2">
                                    {canAdjustItems && editOrderHref ? (
                                        <Link href={editOrderHref} className="block rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white">Edit pesanan</Link>
                                    ) : null}
                                    {canChangePaymentMethod ? (
                                        <button type="button" onClick={() => setChangePaymentModalOpen(true)} className="group flex w-full items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-3 text-left transition hover:border-primary-300 hover:bg-primary-100 active:scale-[0.99]">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-lg font-black text-white shadow-sm">↔</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-black text-primary-900">Ganti pembayaran</span>
                                                <span className="mt-0.5 block text-[11px] text-primary-700">Saat ini {paymentMethodLabel(orderPaymentMethod)}</span>
                                            </span>
                                            <span className="text-lg font-bold text-primary-500 transition group-hover:translate-x-0.5">›</span>
                                        </button>
                                    ) : null}
                                    {canCancelOrder ? (
                                        <button type="button" onClick={handleCancelOrder} disabled={cancelForm.processing} className="w-full px-4 py-2.5 text-xs font-semibold text-rose-600 disabled:opacity-50">
                                            {cancelForm.processing ? "Membatalkan..." : "Batalkan pesanan"}
                                        </button>
                                    ) : null}
                                </div>
                            </aside>
                        ) : null}
                    </div>
                </main>
            </div>
        </>
    );
}
