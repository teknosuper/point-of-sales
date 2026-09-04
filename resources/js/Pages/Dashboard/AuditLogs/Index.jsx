import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import Swal from "sweetalert2";
import {
    IconActivity,
    IconCalendarStats,
    IconChevronDown,
    IconDatabaseOff,
    IconFileSearch,
    IconFilter,
    IconFilterOff,
    IconLoader2,
    IconSearch,
    IconTrash,
    IconUser,
    IconUsers,
    IconX,
} from "@/Utils/icons";

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(new Date(value))
        : "-";

const EVENT_COLORS = {
    created: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    updated: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    deleted: "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    approved: "bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300",
    rejected: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
    login: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300",
    logout: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    "audit.cleaned": "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
};

const resolveEventClass = (event = "") => {
    if (EVENT_COLORS[event]) return EVENT_COLORS[event];
    if (event.includes("create") || event.endsWith(".created")) return EVENT_COLORS.created;
    if (event.includes("delete") || event.endsWith(".deleted")) return EVENT_COLORS.deleted;
    if (event.includes("reject")) return EVENT_COLORS.rejected;
    if (event.includes("approve")) return EVENT_COLORS.approved;
    if (event.includes("update")) return EVENT_COLORS.updated;
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
};

export default function Index({
    auditLogs,
    filters,
    stats = {},
    users = [],
    modules = [],
    events = [],
}) {
    const { flash } = usePage().props;
    const rows = auditLogs?.data ?? [];
    const links = auditLogs?.links ?? [];

    const currentFilters = useMemo(
        () => ({
            user_id: filters?.user_id || "",
            module: filters?.module || "",
            event: filters?.event || "",
            date_from: filters?.date_from || "",
            date_to: filters?.date_to || "",
            search: filters?.search || "",
        }),
        [filters]
    );

    const [draftFilters, setDraftFilters] = useState(currentFilters);
    const [searchInput, setSearchInput] = useState(currentFilters.search);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const searchTimer = useRef(null);

    useEffect(() => {
        setDraftFilters(currentFilters);
        setSearchInput(currentFilters.search);
    }, [currentFilters]);

    useEffect(() => {
        if (flash?.success) {
            Swal.fire({
                icon: "success",
                title: "Berhasil",
                text: flash.success,
                timer: 2500,
                showConfirmButton: false,
            });
        }
        if (flash?.info) {
            Swal.fire({
                icon: "info",
                title: "Info",
                text: flash.info,
                timer: 2500,
                showConfirmButton: false,
            });
        }
    }, [flash]);

    const updateFilters = (nextFilters, { replace = true } = {}) => {
        router.get(route("audit-logs.index"), nextFilters, {
            preserveState: true,
            replace,
        });
    };

    // Debounced search: only fires after user stops typing ~500ms
    const handleSearchChange = (value) => {
        setSearchInput(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setDraftFilters((prev) => ({ ...prev, search: value }));
            updateFilters({ ...currentFilters, search: value });
        }, 500);
    };

    useEffect(
        () => () => clearTimeout(searchTimer.current),
        []
    );

    const handleSelectChange = (field, value) => {
        const next = { ...currentFilters, [field]: value };
        setDraftFilters(next);
        updateFilters(next);
    };

    const hasActiveFilters = Boolean(
        currentFilters.user_id ||
            currentFilters.module ||
            currentFilters.event ||
            currentFilters.date_from ||
            currentFilters.date_to ||
            currentFilters.search
    );

    const resetFilters = () => {
        const empty = {
            user_id: "",
            module: "",
            event: "",
            date_from: "",
            date_to: "",
            search: "",
        };
        setSearchInput("");
        setDraftFilters(empty);
        updateFilters(empty);
    };

    const confirmCleanup = () => {
        Swal.fire({
            title: "Bersihkan Log Lama?",
            html: `
                <p class="text-sm text-slate-600 mb-3">Hapus log yang lebih lama dari interval yang dipilih. Tindakan ini tidak bisa dibatalkan.</p>
                <select id="swal-cleanup-months" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                    <option value="1">Lebih dari 1 bulan</option>
                    <option value="3" selected>Lebih dari 3 bulan</option>
                    <option value="6">Lebih dari 6 bulan</option>
                    <option value="12">Lebih dari 12 bulan</option>
                    <option value="24">Lebih dari 24 bulan</option>
                </select>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Bersihkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#e11d48",
            reverseButtons: true,
            didOpen: () => {
                document
                    .getElementById("swal-cleanup-months")
                    ?.addEventListener("keydown", (e) => {
                        if (e.key === "Enter") e.stopPropagation();
                    });
            },
            preConfirm: () => {
                const el = document.getElementById("swal-cleanup-months");
                return Number(el?.value ?? 3);
            },
        }).then((result) => {
            if (!result.isConfirmed) return;
            setCleaning(true);
            router.post(
                route("audit-logs.cleanup"),
                { keep_months: result.value },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onFinish: () => setCleaning(false),
                }
            );
        });
    };

    return (
        <>
            <Head title="Audit Log" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400">
                                <IconFileSearch size={22} />
                            </span>
                            Audit Log
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Histori aktivitas sensitif untuk investigasi operasional dan administratif.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                                showAdvanced || hasActiveFilters
                                    ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            }`}
                        >
                            <IconFilter size={16} />
                            Filter
                            {hasActiveFilters && (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">
                                    {[currentFilters.user_id, currentFilters.module, currentFilters.event, currentFilters.date_from, currentFilters.date_to, currentFilters.search].filter(Boolean).length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={confirmCleanup}
                            disabled={cleaning}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                        >
                            {cleaning ? (
                                <IconLoader2 size={16} className="animate-spin" />
                            ) : (
                                <IconTrash size={16} />
                            )}
                            Bersihkan Log
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400">
                                <IconDatabaseOff size={18} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Total Log
                                </p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {Number(stats.total ?? 0).toLocaleString("id-ID")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                <IconActivity size={18} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Hari Ini
                                </p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {Number(stats.today ?? 0).toLocaleString("id-ID")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                                <IconCalendarStats size={18} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Bulan Ini
                                </p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {Number(stats.this_month ?? 0).toLocaleString("id-ID")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                <IconUsers size={18} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Aktor Aktif
                                </p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {Number(stats.unique_users ?? 0).toLocaleString("id-ID")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="relative">
                        <IconSearch
                            size={18}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(event) => handleSearchChange(event.target.value)}
                            placeholder="Cari nama pengguna, deskripsi, atau target..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => handleSearchChange("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                            >
                                <IconX size={16} />
                            </button>
                        )}
                    </div>
                    {currentFilters.search && (
                        <p className="mt-2 text-xs text-slate-400">
                            Hasil untuk <strong>"{currentFilters.search}"</strong>
                        </p>
                    )}

                    {/* Advanced Filters */}
                    {showAdvanced && (
                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-5">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Aktor
                                </label>
                                <select
                                    value={draftFilters.user_id}
                                    onChange={(e) => handleSelectChange("user_id", e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    <option value="">Semua Aktor</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Modul
                                </label>
                                <select
                                    value={draftFilters.module}
                                    onChange={(e) => handleSelectChange("module", e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    <option value="">Semua Modul</option>
                                    {modules.map((module) => (
                                        <option key={module} value={module}>
                                            {module}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Event
                                </label>
                                <select
                                    value={draftFilters.event}
                                    onChange={(e) => handleSelectChange("event", e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    <option value="">Semua Event</option>
                                    {events.map((event) => (
                                        <option key={event} value={event}>
                                            {event}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Dari Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={draftFilters.date_from}
                                    onChange={(e) => handleSelectChange("date_from", e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Sampai Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={draftFilters.date_to}
                                    onChange={(e) => handleSelectChange("date_to", e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Module / Event breakdown */}
                {(stats?.by_module?.length > 0 || stats?.by_event?.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {stats?.by_module?.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Top Modul
                                </p>
                                <div className="space-y-2">
                                    {stats.by_module.map((item) => {
                                        const max = Math.max(...stats.by_module.map((m) => m.total), 1);
                                        const pct = Math.round((item.total / max) * 100);
                                        return (
                                            <div key={item.module} className="flex items-center gap-3">
                                                <span className="w-32 truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {item.module}
                                                </span>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                    <div
                                                        className="h-full rounded-full bg-primary-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-12 text-right text-sm font-semibold text-slate-600 dark:text-slate-400">
                                                    {item.total}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {stats?.by_event?.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Top Event
                                </p>
                                <div className="space-y-2">
                                    {stats.by_event.map((item) => {
                                        const max = Math.max(...stats.by_event.map((m) => m.total), 1);
                                        const pct = Math.round((item.total / max) * 100);
                                        return (
                                            <div key={item.event} className="flex items-center gap-3">
                                                <span className="inline-flex w-32 items-center gap-1.5">
                                                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${resolveEventClass(item.event)}`}>
                                                        {item.event}
                                                    </span>
                                                </span>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                    <div
                                                        className="h-full rounded-full bg-indigo-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-12 text-right text-sm font-semibold text-slate-600 dark:text-slate-400">
                                                    {item.total}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Table */}
                <Table.Card>
                    <Table>
                        <Table.Thead>
                            <tr>
                                <Table.Th>Waktu</Table.Th>
                                <Table.Th>Event</Table.Th>
                                <Table.Th>Modul</Table.Th>
                                <Table.Th>Aktor</Table.Th>
                                <Table.Th>Deskripsi</Table.Th>
                                <Table.Th className="text-center">Aksi</Table.Th>
                            </tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.length > 0 ? (
                                rows.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <Table.Td>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">
                                                {formatDateTime(log.created_at)}
                                            </p>
                                            {log.target_label && (
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    {log.target_label}
                                                </p>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${resolveEventClass(log.event)}`}>
                                                {log.event}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {log.module}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            {log.user ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                                                        <IconUser size={14} />
                                                    </span>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-slate-200">
                                                            {log.user.name}
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            {log.user.email || "-"}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-400">System</span>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <p className="max-w-xs truncate text-sm text-slate-600 dark:text-slate-300">
                                                {log.description}
                                            </p>
                                        </Table.Td>
                                        <Table.Td className="text-center">
                                            <Link
                                                href={route("audit-logs.show", log.id)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                <IconFileSearch size={14} />
                                                Detail
                                            </Link>
                                        </Table.Td>
                                    </tr>
                                ))
                            ) : (
                                <Table.Empty
                                    colSpan={6}
                                    message="Belum ada data audit log."
                                >
                                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                                        <IconFileSearch size={26} />
                                    </span>
                                </Table.Empty>
                            )}
                        </Table.Tbody>
                    </Table>
                </Table.Card>

                {links.length > 3 && <Pagination links={links} />}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
