// Modal cetak karcis parkir POS (sebelumnya inline di Transactions/Index.jsx).
import { IconX, IconLoader2, IconPrinter } from "@/Utils/icons";

export default function ParkingTicketModal({
    open,
    onClose,
    previewText,
    quantity,
    setQuantity,
    onQueue,
    isSubmitting,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Cetak Karcis Parkir
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Template sederhana dan masuk ke antrean printer kasir.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (!isSubmitting) {
                                onClose();
                            }
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Preview Template
                        </p>
                        <pre className="mx-auto w-full max-w-[240px] overflow-x-auto rounded-xl border border-slate-300 bg-white p-3 font-mono text-[11px] leading-4 text-slate-900 shadow-sm whitespace-pre-wrap break-words dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            {previewText}
                        </pre>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Preview ini dibaca dari payload `raw_base64` agar sama dengan format final yang dikirim ke printer.
                        </p>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Jumlah Cetak
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="200"
                            value={quantity}
                            onChange={(event) =>
                                setQuantity(
                                    event.target.value
                                )
                            }
                            placeholder="1"
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:ring-primary-900/40"
                        />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Jika isi `50`, sistem akan membuat 50 antrean karcis dan printer kasir akan mencetak 50 lembar.
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onQueue}
                        disabled={isSubmitting}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? (
                            <IconLoader2
                                size={16}
                                className="animate-spin"
                            />
                        ) : (
                            <IconPrinter size={16} />
                        )}
                        Masukkan ke Antrean Print
                    </button>
                </div>
            </div>
        </div>
    );
}
