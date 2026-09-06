import { Link } from "@inertiajs/react";
import { formatPrice, paymentMethodLabel } from "../utils/tableOrderHelpers";

export default function PaymentModal({
    open,
    onClose,
    isPakasirPayment,
    isPakasirQris,
    pakasirQrImageUrl,
    pakasirPaymentNumber,
    pakasirExpiresAt,
    grandTotal,
    onCopyText,
    onDownloadQr,
    onCheckPaymentStatus,
    paymentStatusProcessing,
}) {
    if (!open || !isPakasirPayment) return null;

    return (
        <div
            className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 className="text-base font-bold text-slate-900">
                        {isPakasirQris ? "Bayar QRIS" : "Selesaikan Pembayaran"}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3 p-5">
                    {isPakasirQris && pakasirQrImageUrl ? (
                        <div className="text-center">
                            <img
                                src={pakasirQrImageUrl}
                                alt="QRIS"
                                className="mx-auto h-56 w-56 rounded-2xl bg-slate-50 object-contain p-2"
                            />
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onCopyText(pakasirPaymentNumber, "QR disalin")}
                                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700"
                                >
                                    Salin QR
                                </button>
                                <button
                                    type="button"
                                    onClick={onDownloadQr}
                                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700"
                                >
                                    Unduh
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs text-slate-500">Nomor pembayaran</p>
                            <p className="mt-1 break-all text-lg font-bold text-slate-900">
                                {pakasirPaymentNumber || "-"}
                            </p>
                            {pakasirPaymentNumber && (
                                <button
                                    type="button"
                                    onClick={() => onCopyText(pakasirPaymentNumber, "Nomor disalin")}
                                    className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
                                >
                                    Salin
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <span className="text-slate-500">Total</span>
                        <strong className="text-slate-900">{formatPrice(grandTotal)}</strong>
                    </div>

                    {pakasirExpiresAt && (
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                            <span className="text-slate-500">Berlaku sampai</span>
                            <strong className="text-slate-900">
                                {new Date(pakasirExpiresAt).toLocaleString("id-ID")}
                            </strong>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={onCheckPaymentStatus}
                        disabled={paymentStatusProcessing}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                        {paymentStatusProcessing ? "Mengecek..." : "Cek Status"}
                    </button>
                </div>
            </div>
        </div>
    );
}
