import DashboardLayout from "@/Layouts/DashboardLayout";
import React, { useState } from "react";
import { Head, router, useForm, usePage, Link } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconAdjustmentsHorizontal,
    IconBolt,
    IconDatabaseOff,
    IconCirclePlus,
    IconFilterOff,
    IconInfoCircle,
    IconLayoutGrid,
    IconTrash,
    IconPencilCog,
    IconShield,
    IconMail,
    IconSearch,
    IconBuildingStore,
    IconChevronDown,
    IconChevronUp,
    IconChecklist,
} from "@/Utils/icons";
import Checkbox from "@/Components/Dashboard/Checkbox";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import { roleLabel } from "@/Utils/rolePresentation";
import { classifyUserAccess } from "@/Utils/rbacHelpers";
import Swal from "sweetalert2";

function presetMeta(template) {
    if (template.key === "super-admin") {
        return { group: "Admin Sistem", order: 1, badge: "Akses penuh" };
    }

    if (["system-admin", "owner-operations-admin"].includes(template.key)) {
        return { group: "Admin Sistem", order: 1, badge: "Disarankan" };
    }

    if (["cashier-basic", "waiter-basic", "kitchen-operator-basic"].includes(template.key)) {
        return { group: "Tim Operasional", order: 2, badge: "Operasional" };
    }

    if (["tenant-operational", "tenant-delivery", "tenant-promo", "tenant-owner"].includes(template.key)) {
        return { group: "Tenant", order: 3, badge: "Tenant" };
    }

    return { group: "Admin Modul", order: 4, badge: "Modul" };
}

function primaryOutlet(user) {
    const outlets = user.outlets || [];
    return outlets.find((outlet) => Boolean(outlet.pivot?.is_primary)) || outlets[0] || null;
}

function summarizeUser(user) {
    const mainOutlet = primaryOutlet(user);
    const classification = classifyUserAccess({
        roles: user.roles || [],
        outlets: user.outlets || [],
        preferredWorkspace: user.preferred_workspace || "standard",
        waiterServiceScope: user.waiter_service_scope || "outlet_all",
    });

    return {
        isKitchen: classification.isKitchenWorkspace,
        kindLabel: classification.kindLabel,
        mainOutlet,
        extraOutletCount: Math.max(0, (user.outlets || []).length - (mainOutlet ? 1 : 0)),
    };
}

function UserRow({ user, isSelected, onSelect, onDelete, canUpdate, canDelete }) {
    const avatarUrl = user.avatar;
    const initial =
        user.name?.charAt(0)?.toUpperCase() ||
        user.email?.charAt(0)?.toUpperCase() ||
        "?";
    const summary = summarizeUser(user);

    return (
        <div className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-lg font-bold overflow-hidden">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={user.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            initial
                        )}
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            {user.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <IconMail size={14} />
                            {user.email}
                        </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {summary.kindLabel}
                    </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.roles.map((role, index) => (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-400"
                        >
                            <IconShield size={12} />
                            {roleLabel(role.name)}
                        </span>
                    ))}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {user.roles.length > 0
                        ? `${user.roles.length} role aktif`
                        : "Belum ada role aktif"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {summary.mainOutlet ? (
                        <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                                <IconBuildingStore size={12} />
                                {summary.mainOutlet.code}
                            </span>
                            {summary.extraOutletCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    +{summary.extraOutletCount} outlet lain
                                </span>
                            ) : null}
                        </>
                    ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                            Belum ada outlet
                        </span>
                    )}
                </div>
                {summary.mainOutlet ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Outlet utama: {summary.mainOutlet.code ? `${summary.mainOutlet.code} - ` : ""}{summary.mainOutlet.name}
                    </p>
                ) : null}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Workspace default: {summary.isKitchen ? "Layar Dapur" : "Dashboard Umum"}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {canDelete && (
                    <Checkbox
                        value={user.id}
                        onChange={onSelect}
                        checked={isSelected}
                    />
                )}
                {canUpdate && (
                    <Link
                        href={route("users.edit", user.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                    >
                        <IconPencilCog size={16} />
                    </Link>
                )}
                {canDelete && (
                    <button
                        onClick={() => onDelete(user.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                        <IconTrash size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function Index() {
    const { users, filters = {}, perPageOptions = [], roleOptions = [], outletOptions = [], wizardTemplates = [] } = usePage().props;
    const { can } = useAuthorization();
    const canCreateUsers = can("users-create");
    const canUpdateUsers = can("users-update");
    const canDeleteUsers = can("users-delete");

    const {
        data,
        setData,
        delete: destroy,
    } = useForm({
        selectedUser: [],
    });
    const [showFilters, setShowFilters] = useState(
        Boolean(
            filters.search ||
                filters.role ||
                filters.workspace ||
                filters.outlet_type ||
                filters.outlet_id
        )
    );

    const setSelectedUser = (e) => {
        let items = data.selectedUser;
        if (items.some((id) => id === e.target.value))
            items = items.filter((id) => id !== e.target.value);
        else items.push(e.target.value);
        setData("selectedUser", items);
    };

    const deleteData = async (id) => {
        Swal.fire({
            title: "Hapus Pengguna?",
            text: "Data yang dihapus tidak dapat dikembalikan!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus!",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                destroy(route("users.destroy", [id]));
                Swal.fire({
                    title: "Berhasil!",
                    text: "Data berhasil dihapus!",
                    icon: "success",
                    showConfirmButton: false,
                    timer: 1500,
                });
                setData("selectedUser", []);
            }
        });
    };

    const userRows = users.data.map((user) => ({
        ...user,
        summary: summarizeUser(user),
    }));
    const summaryCards = [
        { label: "Total Pengguna", value: users.total || 0 },
        { label: "Mode Dapur", value: userRows.filter((user) => user.summary.isKitchen).length },
        { label: "Tenant Promo", value: userRows.filter((user) => user.summary.hasTenantPromo).length },
        { label: "Admin Pricing", value: userRows.filter((user) => user.summary.hasOwnerPricing).length },
        { label: "User Tenant", value: userRows.filter((user) => user.summary.mainOutlet?.outlet_type === "tenant").length },
        { label: "User Outlet Owner", value: userRows.filter((user) => user.summary.mainOutlet?.outlet_type !== "tenant").length },
    ];
    const groupedUsers = userRows.reduce((accumulator, user) => {
        const outlet = user.summary.mainOutlet;
        const key = outlet ? `outlet-${outlet.id}` : "without-outlet";
        const label = outlet
            ? `${outlet.code ? `${outlet.code} - ` : ""}${outlet.name}`
            : "Tanpa Outlet";
        const typeLabel = outlet?.outlet_type === "tenant" ? "Tenant" : "Outlet Owner";

        accumulator[key] = accumulator[key] || {
            key,
            label,
            typeLabel,
            items: [],
        };
        accumulator[key].items.push(user);
        return accumulator;
    }, {});
    const userGroups = Object.values(groupedUsers).sort((left, right) =>
        left.label.localeCompare(right.label, "id-ID")
    );

    const applyFilters = (nextFilters) => {
        router.get(route("users.index"), nextFilters, {
            preserveState: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        applyFilters({
            search: "",
            role: "",
            workspace: "",
            outlet_type: "",
            outlet_id: "",
            per_page: filters.per_page || 12,
        });
    };
    const groupedTemplates = wizardTemplates
        .map((template) => ({
            ...template,
            meta: presetMeta(template),
        }))
        .reduce((accumulator, template) => {
            const existing = accumulator[template.meta.group] || {
                label: template.meta.group,
                order: template.meta.order,
                items: [],
            };

            existing.items.push(template);
            accumulator[template.meta.group] = existing;

            return accumulator;
        }, {});
    const templateGroups = Object.values(groupedTemplates)
        .sort((left, right) => left.order - right.order)
        .map((group) => ({
            ...group,
            items: group.items.sort((left, right) =>
                left.label.localeCompare(right.label, "id-ID")
            ),
        }));

    return (
        <>
            <Head title="Pengguna" />

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Pengguna
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Kelola akun, paket akses, dan outlet yang dipakai user.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {canDeleteUsers && data.selectedUser.length > 0 && (
                            <Button
                                type={"bulk"}
                                icon={<IconTrash size={18} />}
                                className={
                                    "bg-danger-500 hover:bg-danger-600 text-white"
                                }
                                label={`Hapus ${data.selectedUser.length}`}
                                onClick={() => deleteData(data.selectedUser)}
                            />
                        )}
                        {canCreateUsers && (
                            <Button
                                type={"link"}
                                href={route("users.create")}
                                icon={
                                    <IconCirclePlus
                                        size={18}
                                        strokeWidth={1.5}
                                    />
                                }
                                className={
                                    "bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                                }
                                label={"Tambah Pengguna"}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {summaryCards.map((item) => (
                    <div
                        key={item.label}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {item.label}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                            {item.value}
                        </p>
                    </div>
                ))}
            </div>

            {canCreateUsers ? (
                <div className="mb-6 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-900/40 dark:bg-primary-950/20">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Buat User dari Template Akses
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Jika admin tidak ingin memilih role manual, mulai dari template yang paling dekat dengan tugas user.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                                Alur paling cepat
                            </p>
                            <p className="mt-1">Pilih template, cek role, lalu simpan user</p>
                        </div>
                    </div>
                    <div className="mt-5 space-y-4">
                        {templateGroups.map((group) => (
                            <div
                                key={group.label}
                                className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                                    <IconLayoutGrid size={16} className="text-primary-500" />
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {group.label}
                                    </p>
                                </div>
                                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {group.items.map((template) => (
                                        <div
                                            key={template.key}
                                            className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto]"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {template.label}
                                                    </p>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                        {template.meta.badge}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {template.description}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Ringkasan
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {template.use_all_permissions ? (
                                                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                                                            Semua izin sistem
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                            {template.permissions.length} izin inti
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start justify-start lg:justify-end">
                                                <Link
                                                    href={route("permissions.wizard", { template: template.key, step: "user" })}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                                                >
                                                    <IconBolt size={16} />
                                                    Pakai Template
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={route("permissions.index")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconChecklist size={16} />
                            Lihat Paket & Izin
                        </Link>
                        <Link
                            href={route("roles.index")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconShield size={16} />
                            Lihat Role Akses
                        </Link>
                    </div>
                </div>
            ) : null}

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <IconAdjustmentsHorizontal size={18} className="text-primary-500" />
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Filter Pengguna
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Buka jika ingin menyaring role akses, workspace, atau outlet.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowFilters((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        {showFilters ? "Sembunyikan" : "Buka"}
                    </button>
                </div>
                {showFilters && (
                <>
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <IconInfoCircle size={14} className="mt-0.5 shrink-0 text-primary-500" />
                    <p>
                        Gunakan filter jika Anda sudah punya banyak user. Untuk membuat user baru, paling cepat mulai dari template akses di atas.
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
                            placeholder="Cari nama atau email pengguna..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                            <IconSearch size={18} />
                        </div>
                    </div>
                    <select
                        value={filters.role || ""}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                role: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Role</option>
                        {roleOptions.map((role) => (
                            <option key={role.value} value={role.value}>
                                {roleLabel(role.value)}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.workspace || ""}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                workspace: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Workspace</option>
                        <option value="standard">Dashboard Umum</option>
                        <option value="kitchen">Layar Dapur</option>
                    </select>
                    <select
                        value={filters.outlet_type || ""}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                outlet_type: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Jenis Outlet</option>
                        <option value="main">Outlet Owner</option>
                        <option value="tenant">Tenant</option>
                    </select>
                    <select
                        value={filters.outlet_id || ""}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                outlet_id: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Outlet</option>
                        {outletOptions
                            .filter((outlet) => !filters.outlet_type || outlet.outlet_type === filters.outlet_type)
                            .map((outlet) => (
                            <option key={outlet.value} value={outlet.value}>
                                {outlet.label}
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
                    <select
                        value={filters.per_page || 12}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                per_page: event.target.value,
                            })
                        }
                        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                        {perPageOptions.map((option) => (
                            <option key={option} value={option}>
                                {option} per halaman
                            </option>
                        ))}
                    </select>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        Group outlet aktif: {userGroups.length}
                    </span>
                </div>
                </>
                )}
            </div>

            {users.data.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Daftar Pengguna per Outlet / Tenant
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {userGroups.map((group) => (
                            <div key={group.key}>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                            {group.label}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {group.typeLabel} • {group.items.length} user • {group.items.reduce((total, item) => total + (item.roles?.length || 0), 0)} role aktif
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                        group.typeLabel === "Tenant"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                                    }`}>
                                        {group.typeLabel}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {group.items.map((user) => (
                                        <UserRow
                                            key={user.id}
                                            user={user}
                                            isSelected={data.selectedUser.includes(
                                                user.id.toString()
                                            )}
                                            onSelect={setSelectedUser}
                                            onDelete={deleteData}
                                            canUpdate={canUpdateUsers}
                                            canDelete={canDeleteUsers}
                                        />
                                    ))}
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
                        Belum Ada Pengguna
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Tambahkan pengguna pertama Anda.
                    </p>
                    {canCreateUsers && (
                        <Button
                            type={"link"}
                            icon={<IconCirclePlus size={18} />}
                            className={
                                "bg-primary-500 hover:bg-primary-600 text-white"
                            }
                            label={"Tambah Pengguna"}
                            href={route("users.create")}
                        />
                    )}
                </div>
            )}

            <Pagination links={users.links} />
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
