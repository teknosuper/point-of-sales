// Modal info pelanggan + jenis pesanan POS (sebelumnya inline di Transactions/Index.jsx).
import CustomerSelect from "@/Components/POS/CustomerSelect";

export default function CustomerInfoModal({
    open,
    onClose,
    customers,
    draftCustomer,
    setDraftCustomer,
    errors,
    loyaltyTierOptions,
    openAddCustomerModalSignal,
    draftOrderType,
    setDraftOrderType,
    setDraftSelectedTableId,
    draftOrderReferenceName,
    setDraftOrderReferenceName,
    diningTables,
    draftSelectedDiningTable,
    onOpenTablePicker,
    onSave,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[72] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                        Info Pelanggan
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        Atur pelanggan dan jenis pesanan
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Tab pembayaran baru bisa dibuka setelah data ini lengkap.
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-4 pb-2">
                    <CustomerSelect
                        customers={customers}
                        selected={draftCustomer}
                        onSelect={setDraftCustomer}
                        placeholder="Pilih pelanggan umum atau terdaftar..."
                        error={errors?.customer_id}
                        tierOptions={loyaltyTierOptions}
                        openAddModalSignal={openAddCustomerModalSignal}
                    />

                    <div>
                        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Jenis Pesanan
                        </p>
                        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                            {[
                                {
                                    value: "take_away",
                                    label: "Bawa Pulang",
                                },
                                {
                                    value: "dine_in",
                                    label: "Makan di Tempat",
                                },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setDraftOrderType(
                                            option.value
                                        );
                                        if (
                                            option.value ===
                                            "take_away"
                                        ) {
                                            setDraftSelectedTableId(
                                                ""
                                            );
                                        }
                                    }}
                                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                        draftOrderType === option.value
                                            ? "bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300"
                                            : "text-slate-600 dark:text-slate-300"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-rose-50 px-4 py-4 shadow-sm dark:border-amber-700/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-rose-950/20">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Nama untuk keterangan order
                            </label>
                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                Wajib
                            </span>
                        </div>
                        <input
                            type="text"
                            value={draftOrderReferenceName}
                            onChange={(event) =>
                                setDraftOrderReferenceName(
                                    event.target.value
                                )
                            }
                            placeholder="Wajib isi nama order, contoh: Diah / Pak Budi / Rina"
                            className="h-13 w-full rounded-2xl border-2 border-amber-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-amber-200/60 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-amber-900/30"
                        />
                        <p className="mt-3 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                            Jangan dikosongkan. Catatan item otomatis menjadi{" "}
                            {draftOrderType === "dine_in"
                                ? "Meja ... - Nama"
                                : "Take Away - Nama"}
                            .
                        </p>
                        {draftCustomer?.is_walk_in && (
                            <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                                Untuk pelanggan umum, kasir harus mengisi nama ini secara manual.
                            </p>
                        )}
                    </div>

                    {draftOrderType === "dine_in" && (
                        <div>
                            <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                Pilih Meja
                            </label>
                            <button
                                type="button"
                                onClick={onOpenTablePicker}
                                className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 transition hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                        Meja
                                    </p>
                                    <p className="truncate font-medium">
                                        {draftSelectedDiningTable
                                            ? draftSelectedDiningTable.code
                                                ? `${draftSelectedDiningTable.code} - ${draftSelectedDiningTable.name}`
                                                : draftSelectedDiningTable.name
                                            : "Pilih meja"}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                                    Pilih
                                </span>
                            </button>
                            {diningTables.length === 0 ? (
                                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">
                                    Belum ada meja aktif untuk outlet ini.
                                </p>
                            ) : null}
                            {draftSelectedDiningTable ? (
                                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    Meja terpilih:{" "}
                                    {draftSelectedDiningTable.code
                                        ? `${draftSelectedDiningTable.code} - ${draftSelectedDiningTable.name}`
                                        : draftSelectedDiningTable.name}
                                </p>
                            ) : null}
                        </div>
                    )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600"
                    >
                        Simpan info pelanggan
                    </button>
                </div>
            </div>
        </div>
    );
}
