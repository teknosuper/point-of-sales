import React, { useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import DashboardLayout from "@/Layouts/DashboardLayout";
import ConfirmPasswordModal from "@/Components/Dashboard/ConfirmPasswordModal";
import {
    IconArrowLeft,
    IconCashBanknote,
    IconFileDownload,
    IconFilter,
    IconReceipt,
    IconRotateClockwise2,
    IconSearch,
    IconWallet,
} from "@/Utils/icons";
import { useAuthorization } from "@/Utils/authorization";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDateTime = (value) => {
    if (!value) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
    }).format(new Date(value));
};

function MetricCard({ title, value, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Icon size={18} />
                <span>{title}</span>
            </div>
            <p className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                {value}
            </p>
        </div>
    );
}

const paymentStatusLabel = (value) => {
    switch (String(value || "").toLowerCase()) {
        case "paid":
            return "Lunas";
        case "pending":
            return "Menunggu";
        case "failed":
            return "Gagal";
        default:
            return value || "-";
    }
};

const orderTypeLabel = (value) => {
    switch (String(value || "").toLowerCase()) {
        case "dine_in":
            return "Dine In";
        case "take_away":
            return "Take Away";
        case "online":
            return "Online";
        default:
            return value || "-";
    }
};

export default function Show({
    cashierShift,
    canForceClose = false,
    paymentMethodBreakdown = [],
    transactionFilters = {},
    transactions,
    transactionFilterMeta = {},
}) {
    const { auth, errors } = usePage().props;
    const { can } = useAuthorization();
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const [actualCash, setActualCash] = useState(
        cashierShift.actual_cash !== null ? String(cashierShift.actual_cash) : ""
    );
    const [closeNotes, setCloseNotes] = useState(cashierShift.close_notes || "");
    const [isConfirmPasswordOpen, setIsConfirmPasswordOpen] = useState(false);
    const [filters, setFilters] = useState({
        q: transactionFilters?.q ?? "",
        payment_method: transactionFilters?.payment_method ?? "",
        payment_status: transactionFilters?.payment_status ?? "",
        order_type: transactionFilters?.order_type ?? "",
        per_page: String(transactionFilters?.per_page ?? 10),
    });

    const canCloseShift = useMemo(() => {
        if (cashierShift.status !== "open") return false;

        return (
            can("cashier-shifts-close") &&
            cashierShift.user?.id === auth?.user?.id
        );
    }, [
        auth?.user?.id,
        can,
        cashierShift.status,
        cashierShift.user?.id,
    ]);

    const canForceCloseShift = useMemo(() => {
        if (cashierShift.status !== "open") return false;

        return (
            can("cashier-shifts-close") &&
            cashierShift.user?.id !== auth?.user?.id &&
            (auth?.super || canForceClose)
        );
    }, [
        auth?.super,
        auth?.user?.id,
        can,
        canForceClose,
        cashierShift.status,
        cashierShift.user?.id,
    ]);

    const actualCashNumber = Number(actualCash || 0);
    const actualCashHelper =
        actualCash === "" ? null : formatCurrency(actualCashNumber);
    const difference = actualCash === ""
        ? null
        : actualCashNumber - Number(cashierShift.expected_cash || 0);
    const totalTransactions = Number(cashierShift.transactions_count || 0);
    const walkInTransactions = Number(
        cashierShift.walk_in_transactions_count || 0
    );
    const registeredTransactions = Number(
        cashierShift.registered_transactions_count || 0
    );
    const walkInShare =
        totalTransactions > 0
            ? ((walkInTransactions / totalTransactions) * 100).toFixed(0)
            : "0";
    const registeredShare =
        totalTransactions > 0
            ? ((registeredTransactions / totalTransactions) * 100).toFixed(0)
            : "0";

    const submitCloseShift = () => {
        router.post(route("cashier-shifts.close", cashierShift.id), {
            actual_cash: actualCashNumber,
            close_notes: closeNotes,
        });
    };

    const applyTransactionFilters = (nextFilters = filters) => {
        router.get(
            route("cashier-shifts.show", cashierShift.id),
            {
                ...nextFilters,
                transactions_page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const resetTransactionFilters = () => {
        const reset = {
            q: "",
            payment_method: "",
            payment_status: "",
            order_type: "",
            per_page: String(transactionFilterMeta?.per_page_options?.[0] || 10),
        };

        setFilters(reset);
        applyTransactionFilters(reset);
    };

    const handleCloseShift = async (event) => {
        event.preventDefault();

        const result = await Swal.fire({
            title: canForceCloseShift
                ? "Force Close Shift?"
                : "Tutup Shift Sekarang?",
            text: canForceCloseShift
                ? "Shift ini milik operator lain. Pastikan kas fisik dan catatan closing sudah benar sebelum menutup paksa."
                : "Pastikan kas fisik aktual sudah sesuai sebelum shift drawer difinalisasi.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: canForceCloseShift
                ? "Ya, Force Close"
                : "Ya, Tutup Shift",
            cancelButtonText: "Batal",
            confirmButtonColor: canForceCloseShift ? "#dc2626" : "#16a34a",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        if (canForceCloseShift) {
            setIsConfirmPasswordOpen(true);
            return;
        }

        submitCloseShift();
    };

    return (
        <>
            <Head title={`Shift #${cashierShift.id}`} />
            <ConfirmPasswordModal
                show={isConfirmPasswordOpen}
                onClose={() => setIsConfirmPasswordOpen(false)}
                challengeLabel="force close shift kasir"
                onConfirmed={submitCloseShift}
            />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link
                            href={route("cashier-shifts.index")}
                            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                        >
                            <IconArrowLeft size={16} />
                            <span>Kembali ke histori shift</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Shift Kasir {cashierShift.user?.name || "-"}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Dibuka {formatDateTime(cashierShift.opened_at)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Operator aktif: {(cashierShift.operators || []).map((operator) => operator.name).join(", ") || "-"}
                        </p>
                    </div>
                    <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${
                            cashierShift.status === "open"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : cashierShift.status === "force_closed"
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                    >
                        {cashierShift.status === "open"
                            ? "Shift Aktif"
                            : cashierShift.status === "force_closed"
                              ? "Force Closed"
                              : "Shift Closed"}
                    </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard title="Modal Awal" value={formatCurrency(cashierShift.opening_cash)} icon={IconWallet} />
                    <MetricCard title="Expected Cash" value={formatCurrency(cashierShift.expected_cash)} icon={IconCashBanknote} />
                    <MetricCard title="Penjualan Tunai" value={formatCurrency(cashierShift.cash_sales_total)} icon={IconReceipt} />
                    <MetricCard title="Harga Dasar Lunas" value={formatCurrency(cashierShift.base_sales_total)} icon={IconCashBanknote} />
                    <MetricCard title="Diskon Promo" value={formatCurrency(cashierShift.pricing_discount_total || 0)} icon={IconReceipt} />
                    {!isKitchenWorkspace ? (
                        <MetricCard title="Markup Owner" value={formatCurrency(cashierShift.markup_total)} icon={IconWallet} />
                    ) : null}
                    <MetricCard title="Refund Tunai" value={formatCurrency(cashierShift.cash_refund_total)} icon={IconRotateClockwise2} />
                    <MetricCard title="Transaksi Lunas" value={Number(cashierShift.paid_transactions_count || 0).toLocaleString("id-ID")} icon={IconReceipt} />
                    <MetricCard title="Transaksi Walk-in" value={walkInTransactions.toLocaleString("id-ID")} icon={IconReceipt} />
                    <MetricCard title="Customer Terdaftar" value={registeredTransactions.toLocaleString("id-ID")} icon={IconReceipt} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Detail Pembayaran per Metode
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Penjualan lunas pada shift ini diringkas per metode bayar.
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {paymentMethodBreakdown.length > 0 ? (
                            paymentMethodBreakdown.map((row) => (
                                <div
                                    key={row.payment_method}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                >
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        {row.payment_method_label}
                                    </p>
                                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(row.gross_total)}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {Number(row.transactions_count || 0).toLocaleString("id-ID")} transaksi
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Belum ada transaksi lunas pada shift ini.
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Ringkasan Shift
                        </h2>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kasir</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.user?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Operator</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">
                                    {(cashierShift.operators || []).map((operator) => operator.name).join(", ") || "-"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dibuka Oleh</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.opened_by?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Waktu Tutup</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatDateTime(cashierShift.closed_at)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ditutup Oleh</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.closed_by?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Transaksi</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.transactions_count}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transaksi Walk-in</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{walkInTransactions}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Customer Terdaftar</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{registeredTransactions}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Retur</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.sales_returns_count}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Penjualan Non Tunai</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatCurrency(cashierShift.non_cash_sales_total)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Refund Non Tunai</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatCurrency(cashierShift.non_cash_refund_total)}</p>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Komposisi Walk-in</p>
                                <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
                                    {walkInTransactions} transaksi, sekitar {walkInShare}% dari total shift.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-primary-50 p-4 dark:bg-primary-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">Komposisi Customer</p>
                                <p className="mt-2 text-sm text-primary-900 dark:text-primary-100">
                                    {registeredTransactions} transaksi, sekitar {registeredShare}% dari total shift.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Setoran Dasar Kasir</p>
                                <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
                                    Kasir bisa meminta <span className="font-semibold">{formatCurrency(cashierShift.base_sales_total)}</span> berdasarkan transaksi lunas pada shift ini.
                                </p>
                                <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                                    Promo yang mengurangi nilai dasar shift ini:{" "}
                                    <span className="font-semibold">
                                        {formatCurrency(cashierShift.pricing_discount_total || 0)}
                                    </span>
                                </p>
                                <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                                    Penerima setoran:{" "}
                                    <span className="font-semibold">
                                        {cashierShift.settlement_recipient?.name || "Belum diatur admin"}
                                    </span>
                                </p>
                            </div>
                            {!isKitchenWorkspace ? (
                                <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Markup Owner</p>
                                    <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
                                        Selisih dari harga beli ke harga jual pada shift ini adalah{" "}
                                        <span className="font-semibold">{formatCurrency(cashierShift.markup_total)}</span>.
                                    </p>
                                </div>
                            ) : null}
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catatan Shift</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{cashierShift.notes || "Tidak ada catatan pembukaan."}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catatan Closing</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{cashierShift.close_notes || "Tidak ada catatan penutupan."}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Cash Closing
                            </h2>
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Expected Cash</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(cashierShift.expected_cash)}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Actual Cash</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {cashierShift.actual_cash === null ? "-" : formatCurrency(cashierShift.actual_cash)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Selisih</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {cashierShift.cash_difference === null ? "-" : formatCurrency(cashierShift.cash_difference)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {(canCloseShift || canForceCloseShift) && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {canForceCloseShift ? "Force Close Shift" : "Tutup Shift"}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {canForceCloseShift
                                        ? "Input kas fisik akhir untuk menutup shift drawer milik operator lain dengan otorisasi tinggi."
                                        : "Input kas fisik akhir untuk finalisasi cash closing."}
                                </p>
                                <form onSubmit={handleCloseShift} className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Kas Fisik Aktual</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={actualCash}
                                            onChange={(event) => setActualCash(event.target.value)}
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        />
                                        {actualCashHelper && !errors?.actual_cash && (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Nilai terbaca: <span className="font-semibold text-slate-700 dark:text-slate-200">{actualCashHelper}</span>
                                            </p>
                                        )}
                                        {errors?.actual_cash && (
                                            <p className="mt-2 text-xs text-rose-500">{errors.actual_cash}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Closing</label>
                                        <textarea
                                            rows={4}
                                            value={closeNotes}
                                            onChange={(event) => setCloseNotes(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            placeholder="Opsional"
                                        />
                                    </div>
                                    {difference !== null && (
                                        <div
                                            className={`rounded-xl px-4 py-3 text-sm ${
                                                difference === 0
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                            }`}
                                        >
                                            Selisih closing: {formatCurrency(difference)}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                                    >
                                        <IconCashBanknote size={18} />
                                        <span>{canForceCloseShift ? "Force Close Shift" : "Finalisasi Closing"}</span>
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Transaksi dalam Shift
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Cari transaksi shift ini, lihat hak tenant dan markup owner, lalu ekspor ke PDF.
                            </p>
                        </div>
                        <a
                            href={route("cashier-shifts.transactions-pdf", {
                                cashierShift: cashierShift.id,
                                ...filters,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-primary-700 dark:hover:text-primary-400"
                        >
                            <IconFileDownload size={18} />
                            <span>Export PDF</span>
                        </a>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <div className="xl:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Cari invoice / customer / kasir
                                </label>
                                <div className="relative">
                                    <IconSearch
                                        size={18}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={filters.q}
                                        onChange={(event) =>
                                            setFilters((previous) => ({
                                                ...previous,
                                                q: event.target.value,
                                            }))
                                        }
                                        placeholder="Invoice, customer, kasir, waiter"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Metode Bayar
                                </label>
                                <select
                                    value={filters.payment_method}
                                    onChange={(event) =>
                                        setFilters((previous) => ({
                                            ...previous,
                                            payment_method: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <option value="">Semua</option>
                                    {(transactionFilterMeta.payment_methods || []).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Status Bayar
                                </label>
                                <select
                                    value={filters.payment_status}
                                    onChange={(event) =>
                                        setFilters((previous) => ({
                                            ...previous,
                                            payment_status: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <option value="">Semua</option>
                                    {(transactionFilterMeta.payment_statuses || []).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tipe Order
                                </label>
                                <select
                                    value={filters.order_type}
                                    onChange={(event) =>
                                        setFilters((previous) => ({
                                            ...previous,
                                            order_type: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <option value="">Semua</option>
                                    {(transactionFilterMeta.order_types || []).map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Per halaman
                                </label>
                                <select
                                    value={filters.per_page}
                                    onChange={(event) =>
                                        setFilters((previous) => ({
                                            ...previous,
                                            per_page: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-36 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    {(transactionFilterMeta.per_page_options || []).map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={resetTransactionFilters}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTransactionFilters()}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                                >
                                    <IconFilter size={18} />
                                    <span>Terapkan Filter</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    <th className="px-4 py-3">Transaksi</th>
                                    <th className="px-4 py-3">Pembayaran</th>
                                    <th className="px-4 py-3">Grand Total</th>
                                    <th className="px-4 py-3">Hak Tenant</th>
                                    <th className="px-4 py-3">Markup Owner</th>
                                    <th className="px-4 py-3">Waktu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(transactions?.data || []).length > 0 ? (
                                    transactions.data.map((row) => (
                                        <tr key={row.id}>
                                            <td className="px-4 py-4 align-top">
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    {row.invoice}
                                                </div>
                                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {row.customer_name}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Kasir:{" "}
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">
                                                        {row.cashier_name || "-"}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                    {orderTypeLabel(row.order_type)}
                                                    {row.table_label ? ` • ${row.table_label}` : ""}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                    {row.payment_method_label}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {paymentStatusLabel(row.payment_status)}
                                                </div>
                                                {row.payment_method === "cash" ? (
                                                    <div
                                                        className={cn(
                                                            "mt-2 space-y-1 rounded-xl border px-3 py-2 text-xs",
                                                            row.cash_flow_is_anomalous
                                                                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-300"
                                                                : "border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400"
                                                        )}
                                                    >
                                                        <div>
                                                            Bayar customer:{" "}
                                                            <span
                                                                className={cn(
                                                                    "font-medium",
                                                                    row.cash_flow_is_anomalous
                                                                        ? "text-rose-700 dark:text-rose-300"
                                                                        : "text-slate-700 dark:text-slate-200"
                                                                )}
                                                            >
                                                                {formatCurrency(row.cash_received)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            Kembalian:{" "}
                                                            <span
                                                                className={cn(
                                                                    "font-medium",
                                                                    row.cash_flow_is_anomalous
                                                                        ? "text-rose-700 dark:text-rose-300"
                                                                        : "text-slate-700 dark:text-slate-200"
                                                                )}
                                                            >
                                                                {formatCurrency(row.cash_change)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            Uang tunai transaksi:{" "}
                                                            <span
                                                                className={cn(
                                                                    "font-medium",
                                                                    row.cash_flow_is_anomalous
                                                                        ? "text-rose-700 dark:text-rose-300"
                                                                        : "text-slate-700 dark:text-slate-200"
                                                                )}
                                                            >
                                                                {formatCurrency(row.expected_cash_in)}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            Saldo kas setelah transaksi:{" "}
                                                            <span className="font-medium text-emerald-700 dark:text-emerald-300">
                                                                {formatCurrency(row.running_expected_cash)}
                                                            </span>
                                                        </div>
                                                        {row.cash_flow_is_anomalous ? (
                                                            <div className="pt-1 font-medium text-rose-700 dark:text-rose-300">
                                                                Ada kejanggalan nominal kas pada transaksi ini.
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                        Expected non tunai:{" "}
                                                        <span className="font-medium text-primary-700 dark:text-primary-300">
                                                            {formatCurrency(row.expected_non_cash_in)}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 align-top text-sm font-semibold text-slate-900 dark:text-white">
                                                {formatCurrency(row.grand_total)}
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(row.base_sales_total)}
                                                </div>
                                                {row.pricing_discount_total > 0 ? (
                                                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                                        Promo {formatCurrency(row.pricing_discount_total)}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(row.markup_total)}
                                                </div>
                                                {row.sales_returns_count > 0 ? (
                                                    <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                                        Retur {row.sales_returns_count} • {formatCurrency(row.returned_amount)}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-4 align-top text-sm text-slate-600 dark:text-slate-300">
                                                {formatDateTime(row.created_at)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                                        >
                                            Tidak ada transaksi yang cocok dengan filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {transactions?.links?.length > 1 ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                            {transactions.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        key={`${link.label}-${index}`}
                                        href={link.url}
                                        preserveScroll
                                        preserveState
                                        className={`rounded-lg px-3 py-2 text-sm ${
                                            link.active
                                                ? "bg-primary-500 text-white"
                                                : "border border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:text-slate-300"
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span
                                        key={`${link.label}-${index}`}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-300 dark:border-slate-700 dark:text-slate-600"
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                )
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
