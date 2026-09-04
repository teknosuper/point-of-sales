import React, { useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router, usePage } from "@inertiajs/react";
import {
    IconAdjustmentsHorizontal,
    IconChevronDown,
    IconChevronUp,
    IconDatabaseOff,
    IconFilterOff,
    IconInfoCircle,
    IconKey,
    IconSearch,
    IconShield,
} from "@/Utils/icons";
import Pagination from "@/Components/Dashboard/Pagination";
import { decoratePermission } from "@/Utils/permissionPresentation";

export default function Index() {
    const { permissions, filters = {}, groupCounts = [], groupOptions = [], perPageOptions = [] } = usePage().props;
    const rows = permissions.data.map(decoratePermission);
    const [showGuide, setShowGuide] = useState(false);
    const [showFilters, setShowFilters] = useState(
        Boolean(filters.search || filters.group)
    );
    const activeGroupLabel = filters.group
        ? groupOptions.find((group) => group.key === filters.group)?.label || "Semua Group"
        : "Semua Group";
    const activeFilterCount = useMemo(
        () => [filters.search, filters.group].filter(Boolean).length,
        [filters.group, filters.search]
    );

    const applyFilters = (nextFilters) => {
        router.get(route("permissions.index"), nextFilters, {
            preserveState: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        applyFilters({
            search: "",
            group: "",
            per_page: filters.per_page || 20,
        });
    };
    return (
        <>
            <Head title="Izin Sistem" />

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconKey size={28} className="text-primary-500" />
                            Izin Sistem
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Lihat daftar izin yang dipakai saat menyusun role akses.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Total Izin
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {permissions.total || 0}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Group Aktif
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                        {activeGroupLabel}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Halaman Saat Ini
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                        {rows.length} item
                    </p>
                </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <button
                    type="button"
                    onClick={() => setShowGuide((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                >
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Panduan singkat
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Buka jika Anda perlu contoh izin tenant dan owner.
                        </p>
                    </div>
                    {showGuide ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                </button>
                {showGuide ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                            Tenant promo butuh akses buat lihat, tambah, dan ubah aturan harga.
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                            Ubah harga owner outlet harus dibatasi hanya ke admin pricing owner.
                        </div>
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100">
                            Atur izin di role dulu, lalu pasang role itu ke user.
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <IconAdjustmentsHorizontal
                            size={18}
                            className="text-primary-500"
                        />
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Filter
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {activeFilterCount > 0 ? `${activeFilterCount} filter aktif` : "Semua izin ditampilkan"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowFilters((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        {showFilters ? "Sembunyikan filter" : "Buka filter"}
                    </button>
                </div>
                {showFilters ? (
                <>
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <IconInfoCircle size={14} className="mt-0.5 shrink-0 text-primary-500" />
                    <p>
                        Gunakan halaman ini untuk mencari izin tertentu. Untuk setup user harian, lebih cepat lewat wizard di atas.
                    </p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="relative md:col-span-2">
                        <input
                            type="text"
                            defaultValue={filters.search || ""}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    applyFilters({
                                        ...filters,
                                        search: event.currentTarget.value,
                                    });
                                }
                            }}
                            placeholder="Cari nama teknis atau fungsi izin..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                            <IconSearch size={18} />
                        </div>
                    </div>
                    <select
                        value={filters.group || ""}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                group: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Group</option>
                        {groupOptions.map((group) => (
                            <option key={group.key} value={group.key}>
                                {group.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.per_page || 20}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                per_page: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        {perPageOptions.map((option) => (
                            <option key={option} value={option}>
                                {option} per halaman
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <IconFilterOff size={14} />
                        Reset Filter
                    </button>
                    {groupCounts.map((group) => (
                        <button
                            key={group.key}
                            type="button"
                            onClick={() =>
                                applyFilters({
                                    ...filters,
                                    group: group.key,
                                })
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                filters.group === group.key
                                    ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                        >
                            {group.label}: {group.count}
                        </button>
                    ))}
                </div>
                </>
                ) : null}
            </div>

            {rows.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Daftar Izin
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {rows.map((permission, i) => (
                            <div
                                key={permission.id || i}
                                className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 md:flex-row md:items-start md:justify-between"
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
                                        <IconShield size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {permission.label}
                                            </p>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {permission.group_label}
                                            </span>
                                        </div>
                                        <p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                                            {permission.name}
                                        </p>
                                        {permission.description ? (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                {permission.description}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                        #{permission.id}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <IconDatabaseOff
                            size={32}
                            className="text-slate-400"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Belum Ada Izin
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Hak akses tidak ditemukan.
                    </p>
                </div>
            )}

            <Pagination links={permissions.links} />
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
