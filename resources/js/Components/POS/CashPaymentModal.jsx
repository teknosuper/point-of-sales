// Modal pembayaran tunai POS (sebelumnya inline di Transactions/Index.jsx).
import { formatPrice } from "@/Utils/posFormat";

export default function CashPaymentModal({
    open,
    onClose,
    quickCashAmounts,
    cashInput,
    setCashInput,
    cash,
    payable,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                        Pembayaran Tunai
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        Atur Nominal Bayar
                    </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Pilih nominal cepat atau isi jumlah pembayaran pelanggan.
                        </p>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Nominal Cepat
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {quickCashAmounts.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() =>
                                        setCashInput(String(amt))
                                    }
                                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                                        Number(cashInput) === amt
                                            ? "bg-primary-500 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                    }`}
                                >
                                    {formatPrice(amt)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Jumlah Bayar (Rp)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                Rp
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={cashInput}
                                onChange={(e) =>
                                    setCashInput(
                                        e.target.value.replace(
                                            /[^\d]/g,
                                            ""
                                        )
                                    )
                                }
                                placeholder="0"
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-base font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-emerald-700 dark:text-emerald-300">
                                Kembalian
                            </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                {formatPrice(
                                    Math.max(0, cash - payable)
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600"
                    >
                        Simpan Nominal
                    </button>
                </div>
            </div>
        </div>
    );
}
