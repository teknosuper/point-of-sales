import { useForm } from "@inertiajs/react";
import { useEffect } from "react";
import { formatPrice } from "../utils/tableOrderHelpers";

export default function ChangePaymentMethodModal({
    open,
    onClose,
    order,
    paymentMethods = [],
    bankAccounts = [],
}) {
    const currentMethod = order?.transaction?.payment_method || order?.payment_method || "cash";
    const currentBankId = order?.transaction?.bank_account?.id
        ? String(order.transaction.bank_account.id)
        : bankAccounts?.[0]?.id
          ? String(bankAccounts[0].id)
          : "";

    const form = useForm({
        payment_method: currentMethod,
        bank_account_id: currentBankId,
    });

    useEffect(() => {
        if (open) {
            form.setData({
                payment_method: currentMethod,
                bank_account_id: currentBankId,
            });
            form.clearErrors();
        }
    }, [open, currentMethod, currentBankId]);

    if (!open) return null;

    const selectedMethod = (paymentMethods || []).find(
        (m) => m.value === form.data.payment_method
    );

    const handleSubmit = (e) => {
        e.preventDefault();

        if (form.data.payment_method === "bank_transfer" && !form.data.bank_account_id) {
            form.setError("bank_account_id", "Pilih rekening bank tujuan.");
            return;
        }

        form.post(route("table-order.change-payment-method", order.access_token), {
            preserveScroll: true,
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">
                            Ganti Metode Pembayaran
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                            Pesanan #{order.order_number} • Total {formatPrice(order.grand_total)}
                        </p>
                    </div>
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

                <form onSubmit={handleSubmit} className="p-5">
                    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Pilih Cara Pembayaran
                            </p>
                            <div className="mt-2.5 space-y-2.5">
                                {(paymentMethods || []).map((method) => {
                                    const isSelected = form.data.payment_method === method.value;
                                    return (
                                        <label
                                            key={method.value}
                                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all ${
                                                isSelected
                                                    ? "border-primary-500 bg-primary-50/50 shadow-sm ring-2 ring-primary-500/20"
                                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="payment_method"
                                                value={method.value}
                                                checked={isSelected}
                                                onChange={() => {
                                                    form.setData("payment_method", method.value);
                                                    if (method.value !== "bank_transfer") {
                                                        form.setData("bank_account_id", "");
                                                    } else if (!form.data.bank_account_id && bankAccounts[0]?.id) {
                                                        form.setData("bank_account_id", String(bankAccounts[0].id));
                                                    }
                                                }}
                                                className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {method.label}
                                                    </p>
                                                    {method.value === currentMethod && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                                            Saat Ini
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                                                    {method.description}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            {form.errors.payment_method && (
                                <p className="mt-2 text-xs font-medium text-rose-600">
                                    {form.errors.payment_method}
                                </p>
                            )}
                        </div>

                        {form.data.payment_method === "bank_transfer" && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                                    Pilih Rekening Tujuan
                                </p>
                                {bankAccounts.length > 0 ? (
                                    <div className="mt-3 space-y-2">
                                        {bankAccounts.map((account) => {
                                            const isSelected = String(form.data.bank_account_id) === String(account.id);
                                            return (
                                                <label
                                                    key={account.id}
                                                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                                                        isSelected
                                                            ? "border-amber-400 bg-white shadow-sm ring-2 ring-amber-400/20"
                                                            : "border-amber-100 bg-white/80 hover:bg-white"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="bank_account_id"
                                                            value={account.id}
                                                            checked={isSelected}
                                                            onChange={() => form.setData("bank_account_id", String(account.id))}
                                                            className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                                                        />
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900">
                                                                {account.bank_name}
                                                            </p>
                                                            <p className="text-xs font-mono text-slate-600">
                                                                {account.account_number}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400">
                                                                a.n. {account.account_name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-amber-700">
                                        Belum ada rekening bank yang aktif di outlet ini.
                                    </p>
                                )}
                                {form.errors.bank_account_id && (
                                    <p className="mt-2 text-xs font-medium text-rose-600">
                                        {form.errors.bank_account_id}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">Catatan: </span>
                            {form.data.payment_method === "cash" && "Setelah diubah, Anda dapat langsung menyelesaikan pembayaran di kasir."}
                            {form.data.payment_method === "bank_transfer" && "Setelah diubah, nomor rekening akan muncul di halaman status untuk transfer manual."}
                            {["midtrans", "xendit", "pakasir"].includes(form.data.payment_method) && "Setelah diubah, QRIS atau link pembayaran online akan langsung tersedia untuk dibayar dari meja."}
                        </div>
                    </div>

                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={form.processing}
                            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing || form.data.payment_method === currentMethod && (form.data.payment_method !== "bank_transfer" || String(form.data.bank_account_id) === String(currentBankId))}
                            className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 hover:bg-primary-700 disabled:opacity-50"
                        >
                            {form.processing ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
