// Modal riwayat sinkronisasi offline POS (sebelumnya inline di Transactions/Index.jsx).
import { IconX } from "@/Utils/icons";
import { formatPrice } from "@/Utils/posFormat";

export default function OfflineHistoryModal({
    open,
    onClose,
    offlinePendingItems,
    offlineFailedItems,
    offlineSyncedItems,
    offlineHistoryFilter,
    setOfflineHistoryFilter,
    offlineQueue,
    handlePrintOfflineQueueItem,
    handlePrintSyncedReceipt,
    retrySingleOfflineTransaction,
    removeOfflineQueueItem,
    syncOfflineQueue,
    isOfflineMode,
    isSyncingOfflineQueue,
}) {
    if (!open) {
        return null;
    }

    const visibleQueue = offlineQueue.filter((item) => {
        if (offlineHistoryFilter === "pending") {
            return item.status !== "failed";
        }

        if (offlineHistoryFilter === "failed") {
            return item.status === "failed";
        }

        return offlineHistoryFilter !== "synced";
    });

    const showQueue =
        offlineHistoryFilter === "all" ||
        offlineHistoryFilter === "pending" ||
        offlineHistoryFilter === "failed";

    const showSynced =
        offlineHistoryFilter === "all" || offlineHistoryFilter === "synced";

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={() => onClose()}
            />
            <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
                            Offline Sync
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                            Riwayat Sinkronisasi Offline
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Pantau transaksi tunai yang masih pending, gagal, atau sudah berhasil disinkronkan.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onClose()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Pending
                        </p>
                        <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-300">
                            {offlinePendingItems.length}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Gagal
                        </p>
                        <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-300">
                            {offlineFailedItems.length}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Tersinkron
                        </p>
                        <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-300">
                            {offlineSyncedItems.length}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                            {[
                                ["all", "Semua"],
                                ["pending", "Pending"],
                                ["failed", "Gagal"],
                                ["synced", "Tersinkron"],
                            ].map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        setOfflineHistoryFilter(value)
                                    }
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                        offlineHistoryFilter === value
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                            : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div>
                            <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Antrean Aktif
                            </p>
                            <div className="space-y-2">
                                {showQueue && visibleQueue.length > 0 ? (
                                    visibleQueue.map((item) => (
                                        <div
                                            key={item.offline_reference}
                                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                        {item.offline_reference}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        {item.customer_name || "Pelanggan Umum"} • {formatPrice(item.grand_total || 0)}
                                                    </p>
                                                    {item.last_error && (
                                                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                                                            {item.last_error}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                            item.status === "failed"
                                                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                        }`}
                                                    >
                                                        {item.status === "failed" ? "Gagal" : "Pending"}
                                                    </span>
                                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                        Attempt {Number(item.sync_attempts || 0)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handlePrintOfflineQueueItem(
                                                            item
                                                        )
                                                    }
                                                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                >
                                                    Cetak Draft
                                                </button>
                                                {!isOfflineMode && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            retrySingleOfflineTransaction(
                                                                item.offline_reference
                                                            )
                                                        }
                                                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                    >
                                                        Sync Ulang
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeOfflineQueueItem(
                                                            item.offline_reference
                                                        )
                                                    }
                                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                                                >
                                                    Hapus Antrean
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                        {offlineHistoryFilter === "synced"
                                            ? "Filter saat ini hanya menampilkan transaksi yang sudah tersinkron."
                                            : "Tidak ada antrean offline aktif."}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Riwayat Tersinkron Terakhir
                            </p>
                            <div className="space-y-2">
                                {showSynced && offlineSyncedItems.length > 0 ? (
                                    offlineSyncedItems.slice(0, 10).map((item) => (
                                        <div
                                            key={`${item.offline_reference}-${item.synced_at || item.server_invoice || "history"}`}
                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                        {item.offline_reference}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Invoice server: {item.server_invoice || "-"}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                        Synced
                                                    </span>
                                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                        {item.synced_at
                                                            ? new Date(item.synced_at).toLocaleString("id-ID")
                                                            : "-"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handlePrintSyncedReceipt(
                                                            item
                                                        )
                                                    }
                                                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-200"
                                                >
                                                    Cetak Struk Server
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                        {offlineHistoryFilter === "pending" ||
                                        offlineHistoryFilter === "failed"
                                            ? "Filter saat ini hanya menampilkan antrean aktif."
                                            : "Belum ada riwayat sinkronisasi."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => onClose()}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={syncOfflineQueue}
                        disabled={isOfflineMode || isSyncingOfflineQueue || offlineQueue.length === 0}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                    >
                        {isSyncingOfflineQueue ? "Menyinkronkan..." : "Sinkronkan Pending"}
                    </button>
                </div>
            </div>
        </div>
    );
}
