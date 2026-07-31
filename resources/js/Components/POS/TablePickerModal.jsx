// Modal pemilih meja dine-in POS (sebelumnya inline di Transactions/Index.jsx).
import { IconX } from "@/Utils/icons";

const resolveTableStatus = (table) => {
    const minutesSinceLastTransaction = table.latest_transaction_at
        ? Math.max(0, Math.round((Date.now() - new Date(table.latest_transaction_at).getTime()) / 60000))
        : null;
    let lastTxLabel = null;
    let lastTxClass = "";
    let statusBadge = null;
    let statusClass = "";
    if (minutesSinceLastTransaction === null) {
        // Belum pernah transaksi — TERSEDIA
        statusBadge = "TERSEDIA";
        statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
        lastTxClass = "text-slate-400 dark:text-slate-500";
    } else if (minutesSinceLastTransaction <= 15) {
        // Baru transaksi — DIPESAN
        statusBadge = "DIPESAN";
        statusClass = "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300";
        lastTxLabel = `${minutesSinceLastTransaction} menit yang lalu`;
        lastTxClass = "text-rose-600 dark:text-rose-400";
    } else if (minutesSinceLastTransaction <= 60) {
        // Mungkin masih ditempati — KEMUNGKINAN KOSONG
        statusBadge = "KEMUNGKINAN KOSONG";
        statusClass = "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
        lastTxLabel = `${minutesSinceLastTransaction} menit yang lalu`;
        lastTxClass = "text-amber-600 dark:text-amber-400";
    } else if (minutesSinceLastTransaction < 1440) {
        // Antara 1-23 jam — KEMUNGKINAN KOSONG
        statusBadge = "KEMUNGKINAN KOSONG";
        statusClass = "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300";
        const hours = Math.floor(minutesSinceLastTransaction / 60);
        const mins = minutesSinceLastTransaction % 60;
        lastTxLabel = hours > 0
            ? `${hours} jam${mins > 0 ? ` ${mins} menit` : ""} yang lalu`
            : `${minutesSinceLastTransaction} menit yang lalu`;
        lastTxClass = "text-orange-600 dark:text-orange-400";
    } else {
        // Lebih dari 24 jam — TERSEDIA
        statusBadge = "TERSEDIA";
        statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
        const days = Math.floor(minutesSinceLastTransaction / 1440);
        const remainingHours = Math.floor((minutesSinceLastTransaction % 1440) / 60);
        if (days === 1) {
            lastTxLabel = remainingHours > 0
                ? `1 hari ${remainingHours} jam yang lalu`
                : `1 hari yang lalu`;
        } else {
            lastTxLabel = remainingHours > 0
                ? `${days} hari ${remainingHours} jam yang lalu`
                : `${days} hari yang lalu`;
        }
        lastTxClass = "text-slate-400 dark:text-slate-500";
    }

    return { lastTxLabel, lastTxClass, statusBadge, statusClass };
};

export default function TablePickerModal({
    open,
    onClose,
    diningTables,
    isDraftTablePicker,
    selectedId,
    onSelect,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                            Dine In
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                            Pilih Meja
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Pilih meja aktif untuk transaksi makan di tempat.
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

                <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
                    {diningTables.length > 0 ? (
                        diningTables.map((table) => {
                            const isActive =
                                String(selectedId) === String(table.id);
                            const { lastTxLabel, lastTxClass, statusBadge, statusClass } =
                                resolveTableStatus(table);

                            return (
                                <button
                                    key={table.id}
                                    type="button"
                                    onClick={() => {
                                        onSelect(String(table.id));
                                        onClose();
                                    }}
                                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                        isActive
                                            ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30"
                                            : statusBadge === "DIPESAN"
                                            ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20"
                                            : statusBadge === "KEMUNGKINAN KOSONG"
                                            ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {table.code
                                                    ? `${table.code} - ${table.name}`
                                                    : table.name}
                                            </p>
                                            {statusBadge && (
                                                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>
                                                    {statusBadge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Kapasitas {table.capacity} orang
                                        </p>
                                        {lastTxLabel && (
                                            <p className={`mt-0.5 text-[11px] font-medium ${lastTxClass}`}>
                                                {lastTxLabel}
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        className={`ml-3 h-5 w-5 shrink-0 rounded-md border ${
                                            isActive
                                                ? "border-primary-500 bg-primary-500"
                                                : "border-slate-300 dark:border-slate-600"
                                        }`}
                                    />
                                </button>
                            );
                        })
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                            Belum ada meja aktif untuk outlet ini.
                        </div>
                    )}
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
        </div>
    );
}
