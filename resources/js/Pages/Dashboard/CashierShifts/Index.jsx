import React, { useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconCashBanknote,
    IconClockHour4,
    IconChevronDown,
    IconChevronUp,
    IconFileDownload,
    IconEye,
    IconUser,
} from "@/Utils/icons";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDateTime = (value) => {
    if (!value) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
};

export default function Index({
    shifts,
    filters,
    cashiers = [],
    activeShift = null,
    outletOpenShift = null,
    otherOpenShifts = [],
}) {
    const { auth, errors, activeOutlet } = usePage().props;
    const { can } = useAuthorization();
    const [openingCash, setOpeningCash] = useState("");
    const [notes, setNotes] = useState("");
    const [showOpenShiftForm, setShowOpenShiftForm] = useState(false);
    const canOpenShift = can("cashier-shifts-open");

    const currentFilters = useMemo(
        () => ({
            cashier_id: filters?.cashier_id || "",
            status: filters?.status || "",
            opened_from: filters?.opened_from || "",
            opened_to: filters?.opened_to || "",
        }),
        [filters]
    );

    const handleFilterChange = (key, value) => {
        router.get(
            route("cashier-shifts.index"),
            {
                ...currentFilters,
                [key]: value,
            },
            {
                preserveState: true,
                replace: true,
            }
        );
    };

    const handleOpenShift = (event) => {
        event.preventDefault();

        router.post(route("cashier-shifts.store"), {
            opening_cash: Number(openingCash || 0),
            notes,
        });
    };

    const handleJoinShift = () => {
        router.post(route("cashier-shifts.store"), {
            join_existing: true,
        });
    };

    return (
        <>
            <Head title="Shift Kasir" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Shift Kasir
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Cek shift aktif dan buka shift baru saat mulai operasional.
                        </p>
                    </div>
                    <div className="flex gap-2">
                    {!activeShift && !outletOpenShift && canOpenShift && (
                        <button
                            type="button"
                            onClick={() => setShowOpenShiftForm((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {showOpenShiftForm ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                            {showOpenShiftForm ? "Sembunyikan form" : "Buka shift baru"}
                        </button>
                    )}
                    {activeShift && (
                        <Link
                            href={route("cashier-shifts.show", activeShift.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/30 transition-colors hover:bg-primary-600"
                        >
                            <IconEye size={18} />
                            <span>Lihat Shift Aktif</span>
                        </Link>
                    )}
                    </div>
                </div>

                {!activeShift && outletOpenShift && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                                    Drawer outlet sudah aktif
                                </h2>
                                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                                    Shift ini dibuka oleh {outletOpenShift.user?.name || "-"} dan bisa dipakai bersama dalam satu drawer.
                                </p>
                                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                                    Operator aktif: {(outletOpenShift.operators || []).map((operator) => operator.name).join(", ") || "-"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleJoinShift}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                            >
                                <IconUser size={18} />
                                <span>Gabung Shift Aktif</span>
                            </button>
                        </div>
                        {errors?.shift && (
                            <p className="mt-3 text-xs text-rose-500">{errors.shift}</p>
                        )}
                    </div>
                )}

                {!activeShift && !outletOpenShift && canOpenShift && showOpenShiftForm && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Buka Shift Baru
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Isi modal awal, lalu mulai shift.
                            </p>
                        </div>

                        <form onSubmit={handleOpenShift} className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Modal Awal
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={openingCash}
                                    onChange={(event) => setOpeningCash(event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="0"
                                />
                                {errors?.opening_cash && (
                                    <p className="mt-2 text-xs text-rose-500">{errors.opening_cash}</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Catatan
                                </label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="Opsional"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                                >
                                    <IconCashBanknote size={18} />
                                    <span>Buka Shift</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeShift && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                Shift Aktif
                            </p>
                            <p className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                                {activeShift.user?.name}
                            </p>
                            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                                {formatDateTime(activeShift.opened_at)}
                            </p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                {activeShift.outlet?.code || activeShift.outlet?.name || activeOutlet?.name || "Outlet aktif"}
                            </p>
                            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                                Operator: {(activeShift.operators || []).map((operator) => operator.name).join(", ") || "-"}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Modal Awal
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(activeShift.opening_cash)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Expected Cash
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(activeShift.expected_cash)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Total Transaksi
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                {activeShift.transactions_count}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Komposisi
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                Walk-in {activeShift.walk_in_transactions_count ?? 0} • Customer {activeShift.registered_transactions_count ?? 0}
                            </p>
                        </div>
                    </div>
                )}

                {otherOpenShifts.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                            Ada shift open di outlet lain
                        </h2>
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                            Histori di bawah sudah dibatasi ke outlet aktif{activeOutlet?.name ? `: ${activeOutlet.name}` : ""}, tetapi masih ada shift open lain yang perlu ditinjau.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {otherOpenShifts.map((shift) => (
                                <Link
                                    key={shift.id}
                                    href={route("cashier-shifts.show", shift.id)}
                                    className="inline-flex items-center gap-2 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/30"
                                >
                                    <span>{shift.outlet?.code || shift.outlet?.name || "Tanpa outlet"}</span>
                                    <span>•</span>
                                    <span>{shift.user?.name || "-"}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
                    {cashiers.length > 1 ? (
                        <select
                            value={currentFilters.cashier_id}
                            onChange={(event) => handleFilterChange("cashier_id", event.target.value)}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="">Semua Kasir</option>
                            {cashiers.map((cashier) => (
                                <option key={cashier.id} value={cashier.id}>
                                    {cashier.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <IconUser size={18} className="mr-2" />
                            {cashiers[0]?.name || auth?.user?.name}
                        </div>
                    )}
                    <select
                        value={currentFilters.status}
                        onChange={(event) => handleFilterChange("status", event.target.value)}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Status</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="force_closed">Force Closed</option>
                    </select>
                    <input
                        type="date"
                        value={currentFilters.opened_from}
                        onChange={(event) => handleFilterChange("opened_from", event.target.value)}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <input
                        type="date"
                        value={currentFilters.opened_to}
                        onChange={(event) => handleFilterChange("opened_to", event.target.value)}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                </div>

                <Table.Card title="Histori Shift Kasir">
                    <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                        Menampilkan histori untuk outlet aktif{activeOutlet?.name ? `: ${activeOutlet.name}` : ""}.
                    </div>
                    <Table>
                        <Table.Thead>
                            <tr>
                                <Table.Th>Kasir</Table.Th>
                                <Table.Th>Outlet</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Buka</Table.Th>
                                <Table.Th>Tutup</Table.Th>
                                <Table.Th>Expected Cash</Table.Th>
                                <Table.Th>Selisih</Table.Th>
                                <Table.Th className="w-32 text-center">Aksi</Table.Th>
                            </tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {shifts.data.length > 0 ? (
                                shifts.data.map((shift) => (
                                    <tr key={shift.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <Table.Td>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {shift.user?.name || "-"}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Modal {formatCurrency(shift.opening_cash)}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                        Walk-in:{" "}
                                                        {shift.walk_in_transactions_count ??
                                                            0}
                                                    </span>
                                                    <span className="inline-flex rounded-full bg-primary-50 px-2 py-1 text-[11px] font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                        Customer:{" "}
                                                        {shift.registered_transactions_count ??
                                                            0}
                                                    </span>
                                                </div>
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                                {shift.outlet?.name || "-"}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                {shift.outlet?.code || "Tanpa kode"}
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    shift.status === "open"
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                        : shift.status === "force_closed"
                                                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                }`}
                                            >
                                                {shift.status === "open"
                                                    ? "Open"
                                                    : shift.status === "force_closed"
                                                      ? "Force Closed"
                                                      : "Closed"}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>{formatDateTime(shift.opened_at)}</Table.Td>
                                        <Table.Td>{formatDateTime(shift.closed_at)}</Table.Td>
                                        <Table.Td>{formatCurrency(shift.expected_cash)}</Table.Td>
                                        <Table.Td>
                                            {shift.cash_difference === null
                                                ? "-"
                                                : formatCurrency(shift.cash_difference)}
                                        </Table.Td>
                                        <Table.Td className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    href={route("cashier-shifts.show", shift.id)}
                                                    className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:text-primary-400"
                                                    title="Detail shift"
                                                >
                                                    <IconEye size={18} />
                                                </Link>
                                                <a
                                                    href={route("cashier-shifts.transactions-pdf", shift.id)}
                                                    className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:text-primary-400"
                                                    title="Download laporan PDF"
                                                >
                                                    <IconFileDownload size={18} />
                                                </a>
                                            </div>
                                        </Table.Td>
                                    </tr>
                                ))
                            ) : (
                                <Table.Empty
                                    colSpan={8}
                                    message={
                                        <div className="text-slate-500 dark:text-slate-400">
                                            Belum ada histori shift kasir.
                                        </div>
                                    }
                                >
                                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                        <IconClockHour4 size={28} className="text-slate-400" />
                                    </div>
                                </Table.Empty>
                            )}
                        </Table.Tbody>
                    </Table>
                </Table.Card>

                {shifts.last_page > 1 && <Pagination links={shifts.links} />}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
