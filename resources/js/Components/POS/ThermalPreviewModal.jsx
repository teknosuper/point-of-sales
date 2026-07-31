// Modal preview struk thermal POS (sebelumnya inline di Transactions/Index.jsx).
import { IconX } from "@/Utils/icons";

export default function ThermalPreviewModal({
    open,
    transaction,
    thermalText,
    onClose,
}) {
    if (!open || !transaction) {
        return null;
    }

    const isEightyMm = transaction.receiptLayout?.paper_width === "80mm";
    const qrUrl = transaction.receiptLayout?.feedback?.qr_url;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={onClose}
            />
            {isEightyMm ? (
                <div className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Preview Thermal
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                Struk {transaction.invoice}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Tampilan real di printer thermal 80mm.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                            <IconX size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className="mx-auto rounded-lg bg-white px-4 py-4 shadow-inner ring-1 ring-slate-200">
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-tight text-black">
                                {thermalText}
                            </pre>
                            {qrUrl ? (
                                <div className="mt-4 flex flex-col items-center gap-2">
                                    <img
                                        src={qrUrl}
                                        alt="QR kritik dan saran"
                                        className="h-32 w-32"
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative z-10 flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                Preview Thermal
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                Struk {transaction.invoice}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Tampilan real di printer thermal 58mm.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                            <IconX size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className="mx-auto max-w-[280px] rounded-lg bg-white px-3 py-4 shadow-inner ring-1 ring-slate-200">
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-tight text-black">
                                {thermalText}
                            </pre>
                            {qrUrl ? (
                                <div className="mt-3 flex flex-col items-center gap-2">
                                    <img
                                        src={qrUrl}
                                        alt="QR kritik dan saran"
                                        className="h-28 w-28"
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
