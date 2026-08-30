// Modal riwayat transaksi POS (sebelumnya inline di Transactions/Index.jsx).
// Dipisah agar halaman POS tidak membawa ~700 baris modal setiap dibaca/diedit.
import { useEffect, useState } from "react";
import { Link } from "@inertiajs/react";
import {
    IconHistory,
    IconX,
    IconChevronDown,
    IconChevronUp,
    IconReceipt,
    IconPrinter,
    IconCheck,
    IconSearch,
} from "@/Utils/icons";
import { formatPrice } from "@/Utils/posFormat";
import {
    PROMO_TOTAL_LABEL,
    REWARD_ITEM_LABEL,
    promoTitleText,
    promoDetailText,
} from "@/Utils/pricingRules";

export default function HistoryModal({
    open,
    historyFilters,
    updateHistoryFilter,
    resetHistoryFilters,
    historyTransactions,
    historyMeta,
    isHistoryLoading,
    isHistoryFilterExpanded,
    setIsHistoryFilterExpanded,
    selectedHistoryTransaction,
    setSelectedHistoryTransactionId,
    closeHistoryModal,
    canCreateSalesReturn,
    canConfirmPayment,
    handleOpenHistoryReceipt,
    handleRequeueHistoryReceipt,
    handleConfirmHistoryPayment,
    openThermalPreview,
    isRequeueingHistoryReceipt,
    isConfirmingHistoryPayment,
}) {
    const [mobilePane, setMobilePane] = useState("list");

    useEffect(() => {
        if (open) {
            setMobilePane("list");
        }
    }, [open]);

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[76] flex items-end justify-center sm:items-center sm:p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={closeHistoryModal}
            />
            <div className="relative z-10 flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
                            Riwayat Kasir
                        </p>
                        <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                            <IconHistory size={18} />
                            <span className="sm:hidden">Riwayat transaksi</span>
                            <span className="hidden sm:inline">
                                Perjalanan transaksi pelanggan
                            </span>
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                            Detail, status bayar, dan cetak struk.
                        </p>
                        <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                            Pantau detail belanja, status pembayaran, dan cetak struk tanpa pindah halaman.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={closeHistoryModal}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setMobilePane("list")}
                        className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            mobilePane === "list"
                                ? "bg-white text-primary-600 shadow-sm dark:bg-slate-800 dark:text-primary-400"
                                : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                        Daftar
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobilePane("detail")}
                        disabled={!selectedHistoryTransaction}
                        className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            mobilePane === "detail"
                                ? "bg-white text-primary-600 shadow-sm dark:bg-slate-800 dark:text-primary-400"
                                : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                        Detail
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[360px,1fr]">
                    <div
                        className={`min-h-0 flex-col border-b border-slate-200 dark:border-slate-800 lg:flex lg:border-b-0 lg:border-r ${
                            mobilePane === "list" ? "flex" : "hidden"
                        }`}
                    >
                        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
                            <div className="grid gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <IconSearch
                                            size={18}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            type="text"
                                            value={historyFilters.q}
                                            onChange={(event) =>
                                                updateHistoryFilter(
                                                    "q",
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Cari invoice, pelanggan, kasir, atau keterangan..."
                                            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsHistoryFilterExpanded(
                                                (current) => !current
                                            )
                                        }
                                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        Filter
                                        {isHistoryFilterExpanded ? (
                                            <IconChevronUp size={16} />
                                        ) : (
                                            <IconChevronDown size={16} />
                                        )}
                                    </button>
                                </div>
                                {isHistoryFilterExpanded && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="date"
                                                value={
                                                    historyFilters.start_date
                                                }
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "start_date",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            />
                                            <input
                                                type="date"
                                                value={historyFilters.end_date}
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "end_date",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={
                                                    historyFilters.payment_status
                                                }
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "payment_status",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                <option value="">
                                                    Semua status
                                                </option>
                                                <option value="paid">
                                                    Lunas
                                                </option>
                                                <option value="pending">
                                                    Pending
                                                </option>
                                                <option value="failed">
                                                    Gagal
                                                </option>
                                                <option value="expired">
                                                    Kedaluwarsa
                                                </option>
                                            </select>
                                            <select
                                                value={
                                                    historyFilters.customer_scope
                                                }
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "customer_scope",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                <option value="">
                                                    Semua pelanggan
                                                </option>
                                                <option value="walk_in">
                                                    Umum
                                                </option>
                                                <option value="registered">
                                                    Terdaftar
                                                </option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-[1fr,110px,90px] gap-2">
                                            <select
                                                value={
                                                    historyFilters.payment_method
                                                }
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "payment_method",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                <option value="">
                                                    Semua metode
                                                </option>
                                                <option value="cash">
                                                    Tunai
                                                </option>
                                                <option value="bank_transfer">
                                                    Transfer
                                                </option>
                                                <option value="midtrans">
                                                    Midtrans
                                                </option>
                                                <option value="xendit">
                                                    Xendit
                                                </option>
                                                <option value="pay_later">
                                                    Piutang
                                                </option>
                                            </select>
                                            <select
                                                value={historyFilters.per_page}
                                                onChange={(event) =>
                                                    updateHistoryFilter(
                                                        "per_page",
                                                        Number(
                                                            event.target.value
                                                        )
                                                    )
                                                }
                                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                {[10, 15, 20, 30].map(
                                                    (option) => (
                                                        <option
                                                            key={option}
                                                            value={option}
                                                        >
                                                            {option}/hal
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={resetHistoryFilters}
                                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </>
                                )}
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                    <span>
                                        {historyMeta.total || 0} transaksi
                                    </span>
                                    {isHistoryLoading ? (
                                        <span>Memuat...</span>
                                    ) : historyMeta.from ? (
                                        <span>
                                            {historyMeta.from}-{historyMeta.to}
                                        </span>
                                    ) : (
                                        <span>0 hasil</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                            <div className="space-y-2">
                                {historyTransactions.length > 0 ? (
                                    historyTransactions.map(
                                        (transaction) => {
                                            const isSelected =
                                                Number(
                                                    transaction.id
                                                ) ===
                                                Number(
                                                    selectedHistoryTransaction?.id
                                                );
                                            const isPaid =
                                                transaction.payment_status ===
                                                "paid";

                                            return (
                                                <button
                                                    key={
                                                        transaction.id
                                                    }
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedHistoryTransactionId(
                                                            transaction.id
                                                        );
                                                        setMobilePane(
                                                            "detail"
                                                        );
                                                    }}
                                                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                                        isSelected
                                                            ? "border-primary-300 bg-primary-50 shadow-sm dark:border-primary-700 dark:bg-primary-950/30"
                                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-950/40"
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                                {
                                                                    transaction.invoice
                                                                }
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {
                                                                    transaction.created_at_label
                                                                }
                                                            </p>
                                                        </div>
                                                        <span
                                                            className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                                                isPaid
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                            }`}
                                                        >
                                                            {isPaid
                                                                ? "Lunas"
                                                                : "Pending"}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                                                                {transaction.customer
                                                                    ?.name ||
                                                                    transaction.order_reference_name ||
                                                                    "Pelanggan Umum"}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {transaction.order_reference_notes
                                                                    ? `${transaction.total_items} item · ${transaction.order_reference_notes}`
                                                                    : `${transaction.total_items} item`}
                                                            </p>
                                                        </div>
                                                        <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                                            {formatPrice(
                                                                transaction.grand_total
                                                            )}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        }
                                    )
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                        {isHistoryLoading
                                            ? "Memuat riwayat transaksi..."
                                            : "Tidak ada transaksi yang cocok dengan pencarian ini."}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800 sm:px-4 sm:py-3">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateHistoryFilter(
                                            "page",
                                            Math.max(
                                                1,
                                                Number(
                                                    historyMeta.current_page || 1
                                                ) - 1
                                            )
                                        )
                                    }
                                    disabled={
                                        isHistoryLoading ||
                                        Number(
                                            historyMeta.current_page || 1
                                        ) <= 1
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:px-3 sm:text-xs"
                                >
                                    <span className="sm:hidden">Prev</span>
                                    <span className="hidden sm:inline">Sebelumnya</span>
                                </button>
                                <span className="text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                                    {historyMeta.current_page || 1} /{" "}
                                    {historyMeta.last_page || 1}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateHistoryFilter(
                                            "page",
                                            Math.min(
                                                Number(
                                                    historyMeta.last_page || 1
                                                ),
                                                Number(
                                                    historyMeta.current_page || 1
                                                ) + 1
                                            )
                                        )
                                    }
                                    disabled={
                                        isHistoryLoading ||
                                        Number(
                                            historyMeta.current_page || 1
                                        ) >=
                                            Number(
                                                historyMeta.last_page || 1
                                            )
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:px-3 sm:text-xs"
                                >
                                    <span className="sm:hidden">Next</span>
                                    <span className="hidden sm:inline">Berikutnya</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`min-h-0 flex-col overflow-y-auto border-t border-slate-200 dark:border-slate-800 lg:flex lg:border-t-0 ${
                            mobilePane === "detail" ? "flex" : "hidden"
                        }`}
                    >
                        {selectedHistoryTransaction ? (
                            <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                            Detail Transaksi
                                        </p>
                                        <h4 className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                                            {
                                                selectedHistoryTransaction.invoice
                                            }
                                        </h4>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {
                                                selectedHistoryTransaction.created_at_label
                                            }
                                        </p>
                                    </div>
                                <div className="flex flex-wrap gap-2">
                                    <span
                                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                            selectedHistoryTransaction.payment_status ===
                                            "paid"
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                            }`}
                                        >
                                            {selectedHistoryTransaction.payment_status ===
                                            "paid"
                                                ? "Sudah Dibayar"
                                                : "Menunggu Pembayaran"}
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            {selectedHistoryTransaction.payment_method ||
                                                "cash"}
                                        </span>
                                        {selectedHistoryTransaction.sales_return_summary
                                            ?.status !== "none" && (
                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                {selectedHistoryTransaction
                                                    .sales_return_summary
                                                    ?.status === "full"
                                                    ? "Retur penuh"
                                                    : "Retur sebagian"}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Pelanggan
                                        </p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                            {selectedHistoryTransaction.customer
                                                ?.name ||
                                                "Pelanggan Umum"}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {selectedHistoryTransaction.customer
                                                ?.phone || "-"}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Kasir
                                        </p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                            {selectedHistoryTransaction.cashier
                                                ?.name || "-"}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Item
                                        </p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                            {
                                                selectedHistoryTransaction.total_items
                                            }{" "}
                                            item
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Total
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatPrice(
                                                selectedHistoryTransaction.grand_total
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {(selectedHistoryTransaction
                                    .tenant_allocations || []).length >
                                    0 && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/20">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                            Tenant Terkait
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {selectedHistoryTransaction.tenant_allocations.map(
                                                (allocation) => (
                                                    <span
                                                        key={
                                                            allocation.id
                                                        }
                                                        className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300"
                                                    >
                                                        {allocation
                                                            .tenant_outlet
                                                            ?.name ||
                                                            allocation
                                                                .tenant_outlet
                                                                ?.code ||
                                                            `Tenant ${allocation.tenant_outlet_id}`}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/20">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                                Item Transaksi
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                Ringkasan item yang sudah masuk ke transaksi ini.
                                            </p>
                                        </div>
                                        {Number(
                                            selectedHistoryTransaction.total_discount ||
                                                0
                                        ) > 0 && (
                                            <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                                                {PROMO_TOTAL_LABEL}{" "}
                                                {formatPrice(
                                                    selectedHistoryTransaction.total_discount
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {selectedHistoryTransaction.details.map(
                                            (detail) => (
                                                <div
                                                    key={detail.id}
                                                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {
                                                                detail.product_name
                                                            }
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            {detail.qty} x{" "}
                                                            {formatPrice(
                                                                detail.price
                                                            )}
                                                        </p>
                                                        {promoTitleText(
                                                            detail
                                                        ) ? (
                                                            <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                                                                {promoTitleText(
                                                                    detail
                                                                )}
                                                            </p>
                                                        ) : null}
                                                        {detail.is_promo_reward ? (
                                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                    {REWARD_ITEM_LABEL}
                                                                </span>
                                                                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                                    {detail.promo_reward_rule_name ||
                                                                        "Promo aktif"}
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                        {promoDetailText(
                                                            detail
                                                        ) ? (
                                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                {promoDetailText(
                                                                    detail
                                                                )}
                                                            </p>
                                                        ) : null}
                                                        {Number(
                                                            detail.discount_total ||
                                                                0
                                                        ) > 0 && (
                                                            <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                                                                Diskon item{" "}
                                                                {formatPrice(
                                                                    detail.discount_total
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                                        {formatPrice(
                                                            detail.total
                                                        )}
                                                    </p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                Pilih transaksi di sisi kiri untuk melihat detailnya.
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/80 md:grid-cols-3 xl:grid-cols-[1fr,1fr,1fr,1fr,1.2fr]">
                    <button
                        type="button"
                        onClick={closeHistoryModal}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                        Tutup
                    </button>
                    {selectedHistoryTransaction &&
                    canCreateSalesReturn &&
                    selectedHistoryTransaction.can_create_sales_return ? (
                        <Link
                            href={route(
                                "sales-returns.create",
                                selectedHistoryTransaction.id
                            )}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                        >
                            <IconReceipt size={16} />
                            Buat Retur
                        </Link>
                    ) : (
                        <div className="hidden md:block" />
                    )}
                    {selectedHistoryTransaction ? (
                        <button
                            type="button"
                            onClick={() =>
                                handleOpenHistoryReceipt(
                                    selectedHistoryTransaction.invoice
                                )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconPrinter size={16} />
                            Cetak Struk
                        </button>
                    ) : (
                        <div />
                    )}
                    {selectedHistoryTransaction ? (
                        <button
                            type="button"
                            onClick={() =>
                                openThermalPreview(selectedHistoryTransaction)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                        >
                            <IconReceipt size={16} />
                            Preview Thermal
                        </button>
                    ) : (
                        <div />
                    )}
                    {selectedHistoryTransaction ? (
                        <button
                            type="button"
                            onClick={() =>
                                handleRequeueHistoryReceipt(
                                    selectedHistoryTransaction.id
                                )
                            }
                            disabled={
                                isRequeueingHistoryReceipt ||
                                selectedHistoryTransaction.payment_status !==
                                    "paid"
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 disabled:opacity-60 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                        >
                            <IconPrinter size={16} />
                            {isRequeueingHistoryReceipt
                                ? "Mengirim ke Queue..."
                                : "Print Ulang ke Queue"}
                        </button>
                    ) : (
                        <div className="hidden xl:block" />
                    )}
                    {selectedHistoryTransaction &&
                    canConfirmPayment &&
                    selectedHistoryTransaction.payment_status !==
                        "paid" ? (
                        <button
                            type="button"
                            onClick={() =>
                                handleConfirmHistoryPayment(
                                    selectedHistoryTransaction.id
                                )
                            }
                            disabled={isConfirmingHistoryPayment}
                            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 xl:col-span-1"
                        >
                            <IconCheck size={16} />
                            {isConfirmingHistoryPayment
                                ? "Memproses..."
                                : "Konfirmasi Lunas"}
                        </button>
                    ) : (
                        <div className="hidden xl:block" />
                    )}
                </div>
            </div>
        </div>
    );
}
