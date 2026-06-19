import React, { useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import DashboardLayout from "@/Layouts/DashboardLayout";
import ConfirmPasswordModal from "@/Components/Dashboard/ConfirmPasswordModal";
import {
    IconArrowLeft,
    IconCashBanknote,
    IconReceipt,
    IconRotateClockwise2,
    IconWallet,
} from "@/Utils/icons";
import { useAuthorization } from "@/Utils/authorization";

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

export default function Show({ cashierShift, canForceClose = false }) {
    const { auth, errors } = usePage().props;
    const { can } = useAuthorization();
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const [actualCash, setActualCash] = useState(
        cashierShift.actual_cash !== null ? String(cashierShift.actual_cash) : ""
    );
    const [closeNotes, setCloseNotes] = useState(cashierShift.close_notes || "");
    const [isConfirmPasswordOpen, setIsConfirmPasswordOpen] = useState(false);

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
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
