import React, { useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import ListBox from "@/Components/Dashboard/ListBox";
import Modal from "@/Components/Dashboard/Modal";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import {
    decoratePermission,
    permissionGroupLabel,
} from "@/Utils/permissionPresentation";
import { roleDescription, roleLabel } from "@/Utils/rolePresentation";
import { hasAnyPermissionName } from "@/Utils/rbacHelpers";
import {
    IconAdjustmentsHorizontal,
    IconBolt,
    IconChevronDown,
    IconChevronUp,
    IconDatabaseOff,
    IconCirclePlus,
    IconChecks,
    IconInfoCircle,
    IconLayoutGrid,
    IconTrash,
    IconUserShield,
    IconPencilCog,
    IconPencilCheck,
    IconSearch,
    IconShield,
    IconFilterOff,
    IconUserPlus,
} from "@/Utils/icons";

function summarizeRole(role) {
    const permissions = (role.permissions || []).map(decoratePermission);
    const groups = [...new Set(permissions.map((permission) => permission.group_label))];
    const permissionNames = permissions.map((permission) => permission.name);
    const kindLabel = role.name === "super-admin"
        ? "Super Admin"
        : hasAnyPermissionName(permissionNames, ["users-access", "roles-access", "permissions-access"])
          ? "Admin Sistem"
          : hasAnyPermissionName(permissionNames, ["waiter-board-access"])
            ? "Petugas Antar"
            : hasAnyPermissionName(permissionNames, ["kitchen-access", "kitchen-manage"])
              ? "Operator Dapur"
              : hasAnyPermissionName(permissionNames, ["transactions-access"])
                ? "Kasir / Operasional"
                : hasAnyPermissionName(permissionNames, ["business-settings-update", "payment-settings-update", "cashier-settlements-approve"])
                  ? "Admin / Owner Outlet"
                  : hasAnyPermissionName(permissionNames, ["pricing-rules-access", "products-pricing-update"])
                    ? "Tenant / Pricing"
                    : "Role Admin";

    return {
        permissions,
        groups,
        kindLabel,
    };
}

function RoleRow({ role, onEdit, onDelete, canUpdate, canDelete, canCreateUsers }) {
    const summary = summarizeRole(role);
    const previewPermissions = summary.permissions.slice(0, 6);

    return (
        <div className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300">
                        <IconUserShield size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 capitalize">
                            {roleLabel(role.name)}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {roleDescription(role.name) || `${role.permissions.length} izin aktif`}
                        </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {summary.kindLabel}
                    </span>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                    {role.name}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {summary.groups.slice(0, 4).map((group) => (
                        <span
                            key={group}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            {group}
                        </span>
                    ))}
                    {summary.groups.length > 4 && (
                        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            +{summary.groups.length - 4} group izin
                        </span>
                    )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {previewPermissions.map((permission, index) => (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-medium text-accent-700 dark:bg-accent-900/50 dark:text-accent-300"
                        >
                            <IconShield size={10} />
                            {permission.label}
                        </span>
                    ))}
                    {role.permissions.length > 8 && (
                        <span className="px-2 py-1 text-[11px] font-medium text-slate-500">
                            +{role.permissions.length - 6} izin lainnya
                        </span>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {canCreateUsers ? (
                    <Link
                        href={route("users.create", { role: role.name })}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary-200 bg-primary-50 text-primary-600 hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300"
                    >
                        <IconUserPlus size={16} />
                    </Link>
                ) : null}
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {role.permissions.length} izin
                </span>
                {canUpdate && (
                    <button
                        onClick={onEdit}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                    >
                        <IconPencilCog size={16} />
                    </button>
                )}
                {canDelete && (
                    <button
                        onClick={onDelete}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                        <IconTrash size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}

function presetMeta(template) {
    if (template.key === "super-admin") {
        return {
            group: "Admin Sistem",
            groupOrder: 1,
            badge: "Akses penuh",
            hint: "Hanya untuk pemilik sistem atau admin inti.",
            tone: "rose",
        };
    }

    if (["system-admin", "owner-operations-admin"].includes(template.key)) {
        return {
            group: "Admin Sistem",
            groupOrder: 1,
            badge: "Disarankan",
            hint: "Cocok untuk admin owner atau admin internal.",
            tone: "primary",
        };
    }

    if (["cashier-basic", "waiter-basic", "kitchen-operator-basic"].includes(template.key)) {
        return {
            group: "Tim Operasional",
            groupOrder: 2,
            badge: "Operasional",
            hint: "Dipakai untuk user lapangan yang fokus ke tugas harian.",
            tone: "emerald",
        };
    }

    if (["tenant-operational", "tenant-delivery", "tenant-promo", "tenant-owner"].includes(template.key)) {
        return {
            group: "Tenant",
            groupOrder: 3,
            badge: template.key === "tenant-owner" ? "Owner Tenant" : "Tenant",
            hint: "Khusus untuk tenant foodcourt dan tim tenant.",
            tone: "amber",
        };
    }

    if (["inventory-admin", "report-viewer", "owner-pricing"].includes(template.key)) {
        return {
            group: "Admin Modul",
            groupOrder: 4,
            badge: "Modul khusus",
            hint: "Dipakai untuk staf dengan tugas khusus per modul.",
            tone: "blue",
        };
    }

    return {
        group: "Lainnya",
        groupOrder: 99,
        badge: "Template",
        hint: "Mulai dari template ini lalu sesuaikan jika perlu.",
        tone: "slate",
    };
}

function presetToneClasses(tone) {
    const tones = {
        rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200",
        primary:
            "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-200",
        emerald:
            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200",
        amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200",
        blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200",
        slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
    };

    return tones[tone] || tones.slate;
}

export default function Index() {
    const { roles, permissions, errors, filters = {}, perPageOptions = [], wizardTemplate = null, wizardTemplates = [] } = usePage().props;
    const { can } = useAuthorization();
    const canCreateRoles = can("roles-create");
    const canUpdateRoles = can("roles-update");
    const canDeleteRoles = can("roles-delete");
    const canCreateUsers = can("users-create");
    const [showGuide, setShowGuide] = useState(false);
    const [showFilters, setShowFilters] = useState(
        Boolean(filters.search || filters.kind)
    );
    const wizardPermissionObjects = (wizardTemplate?.permissions || [])
        .map((name) => permissions.find((permission) => permission.name === name))
        .filter(Boolean);

    const {
        data,
        setData,
        transform,
        post,
        delete: destroy,
    } = useForm({
        id: "",
        name: wizardTemplate?.suggested_role_name || "",
        selectedPermission: wizardPermissionObjects,
        isUpdate: false,
        isOpen: Boolean(wizardTemplate && canCreateRoles),
    });

    const setSelectedPermission = (value) =>
        setData("selectedPermission", value);

    transform((data) => ({
        ...data,
        selectedPermission: data.selectedPermission.map(
            (permission) => permission.id
        ),
        _method: data.isUpdate === true ? "put" : "post",
    }));

    const saveRole = async (e) => {
        e.preventDefault();
        post(route("roles.store"), {
            onSuccess: () =>
                setData({ selectedPermission: [], name: "", isOpen: false }),
        });
    };

    const updateRole = async (e) => {
        e.preventDefault();
        post(route("roles.update", data.id), {
            onSuccess: () =>
                setData({
                    id: "",
                    name: "",
                    selectedPermission: [],
                    isUpdate: false,
                    isOpen: false,
                }),
        });
    };

    const handleEdit = (role) => {
        setData({
            id: role.id,
            selectedPermission: role.permissions,
            name: role.name,
            isUpdate: true,
            isOpen: true,
        });
    };

    const handleDelete = (roleId) => {
        if (confirm("Hapus role ini?")) {
            destroy(route("roles.destroy", roleId));
        }
    };

    const groupedPermissionCounts = permissions.reduce((accumulator, permission) => {
        const decorated = decoratePermission(permission);
        const key = decorated.group;

        accumulator[key] = accumulator[key] || {
            key,
            label: permissionGroupLabel(permission.name),
            count: 0,
        };
        accumulator[key].count += 1;

        return accumulator;
    }, {});

    const permissionGroups = Object.values(groupedPermissionCounts).sort((left, right) =>
        left.label.localeCompare(right.label, "id-ID")
    );
    const roleRows = roles.data.map((role) => ({
        ...role,
        summary: summarizeRole(role),
    }));
    const summaryCards = [
        {
            label: "Total Role",
            value: roles.total || 0,
        },
        {
            label: "Role Sistem",
            value: roleRows.filter((role) =>
                ["super-admin", "cashier", "waiter", "kitchen-operator", "kasir-operasional", "petugas-antar", "operator-dapur"].includes(role.name)
            ).length,
        },
        {
            label: "Role Tenant",
            value: roleRows.filter((role) =>
                ["Tenant Operasional", "Tenant Delivery", "Tenant Promo", "Tenant Owner"].includes(role.summary.kindLabel)
            ).length,
        },
        {
            label: "Role Owner Pricing",
            value: roleRows.filter((role) => role.summary.hasOwnerPricing && role.summary.kindLabel !== "Tenant Owner").length,
        },
    ];
    const activeFilterCount = useMemo(
        () => [filters.search, filters.kind].filter(Boolean).length,
        [filters.kind, filters.search]
    );

    const applyFilters = (nextFilters) => {
        router.get(route("roles.index"), nextFilters, {
            preserveState: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        applyFilters({
            search: "",
            kind: "",
            per_page: filters.per_page || 12,
        });
    };
    const permissionPresets = wizardTemplates.map((template) => ({
        key: template.key,
        label: template.label,
        permissions: template.permissions,
    }));
    const groupedTemplates = wizardTemplates
        .map((template) => ({
            ...template,
            meta: presetMeta(template),
        }))
        .reduce((accumulator, template) => {
            const groupKey = template.meta.group;
            const existing = accumulator[groupKey] || {
                label: template.meta.group,
                order: template.meta.groupOrder,
                items: [],
            };

            existing.items.push(template);
            accumulator[groupKey] = existing;

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
            <Head title="Role Akses" />

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconUserShield
                                size={28}
                                className="text-primary-500"
                            />
                            Role Akses
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Pilih paket akses siap pakai, lalu sesuaikan jika perlu.
                        </p>
                    </div>
                    {canCreateRoles && (
                        <Button
                            type={"button"}
                            icon={
                                <IconCirclePlus
                                    size={18}
                                    strokeWidth={1.5}
                                />
                            }
                            className={
                                "bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                            }
                            label={"Tambah Role"}
                            onClick={() => setData("isOpen", true)}
                        />
                    )}
                </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-4">
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

            {wizardTemplate ? (
                <div className="mb-6 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 text-sm dark:border-primary-900/40 dark:bg-primary-950/20">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Wizard RBAC aktif: {wizardTemplate.label}
                            </p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                                Paket ini sudah menyiapkan izin yang paling umum. Simpan role, lalu lanjut buat user dari role tersebut.
                            </p>
                        </div>
                        {canCreateRoles ? (
                            <Button
                                type={"button"}
                                icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                                className={"bg-primary-500 hover:bg-primary-600 text-white"}
                                label={"Buka Paket Role"}
                                onClick={() =>
                                    setData({
                                        id: "",
                                        name: wizardTemplate?.suggested_role_name || "",
                                        selectedPermission: wizardPermissionObjects,
                                        isUpdate: false,
                                        isOpen: true,
                                    })
                                }
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}

            {!wizardTemplate ? (
                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Template Role Akses
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Mulai dari paket yang paling dekat dengan tugas user. Ini lebih cepat daripada memilih izin satu per satu.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                                Urutan paling mudah
                            </p>
                            <p className="mt-1">
                                1. Pilih template 2. Simpan role 3. Buat pengguna dari role itu
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 space-y-4">
                        {templateGroups.map((group) => (
                            <div key={group.label} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
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
                                            className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto]"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {template.label}
                                                    </p>
                                                    <span
                                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${presetToneClasses(
                                                            template.meta.tone
                                                        )}`}
                                                    >
                                                        {template.meta.badge}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {template.description}
                                                </p>
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    {template.meta.hint}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    Ringkasan akses
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {template.use_all_permissions ? (
                                                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                                                            Semua izin sistem
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                                {template.permissions.length} izin inti
                                                            </span>
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                Role: {roleLabel(template.suggested_role_name || template.label)}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start justify-start lg:justify-end">
                                                <Button
                                                    type={"button"}
                                                    className={"bg-primary-500 hover:bg-primary-600 text-white"}
                                                    label={"Pakai Template"}
                                                    onClick={() =>
                                                        setData({
                                                            id: "",
                                                            name: template.suggested_role_name || "",
                                                            selectedPermission: template.use_all_permissions
                                                                ? permissions
                                                                : permissions.filter((permission) =>
                                                                      template.permissions.includes(permission.name)
                                                                  ),
                                                            isUpdate: false,
                                                            isOpen: true,
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

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
                            Buka jika Anda perlu contoh paket role tenant dan owner.
                        </p>
                    </div>
                    {showGuide ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                </button>
                {showGuide ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-4">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                            Role tenant operasional: produk, outlet, dan kontrol buka tutup operasional.
                        </div>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
                            Role tenant delivery: petugas yang fokus mengambil pesanan siap antar dan mengantarkannya ke meja atau pelanggan.
                        </div>
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                            Role tenant promo: akses buat dan ubah promo tenant.
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                            Role tenant owner: paket lengkap untuk owner tenant yang mengelola operasional, promo, stok, dan pengantaran tenant.
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <IconAdjustmentsHorizontal size={18} className="text-primary-500" />
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Filter
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {activeFilterCount > 0 ? `${activeFilterCount} filter aktif` : "Semua role ditampilkan"}
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
                            placeholder="Cari nama role..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                            <IconSearch size={18} />
                        </div>
                    </div>
                    <select
                        value={filters.kind || ""}
                        onChange={(event) =>
                            applyFilters({
                                ...filters,
                                kind: event.target.value,
                            })
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value="">Semua Jenis Role</option>
                        <option value="system">Role Sistem</option>
                        <option value="tenant">Role Tenant</option>
                        <option value="pricing">Role Pricing</option>
                        <option value="admin">Role Admin Modul</option>
                    </select>
                    <select
                        value={filters.per_page || 12}
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
                    {permissionGroups.map((group) => (
                        <span
                            key={group.key}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                            {group.label}: {group.count}
                        </span>
                    ))}
                </div>
                </>
                ) : null}
            </div>

            {/* Modal */}
            <Modal
                show={data.isOpen}
                onClose={() =>
                    setData({
                        isOpen: false,
                        id: "",
                        name: "",
                        selectedPermission: [],
                        isUpdate: false,
                    })
                }
                title={
                    data.isUpdate ? "Ubah Role Akses" : "Tambah Role Akses"
                }
                icon={<IconUserShield size={20} strokeWidth={1.5} />}
            >
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                        Urutan paling mudah
                    </p>
                    <p className="mt-1">1. Isi nama role 2. Pakai template jika ada 3. Buka detail izin hanya jika perlu</p>
                </div>
                <form onSubmit={data.isUpdate ? updateRole : saveRole}>
                    <div className="mb-4">
                        <Input
                            label={"Nama role"}
                            type={"text"}
                            placeholder={"Contoh: kasir-utama atau admin-stok"}
                            value={data.name}
                            onChange={(e) => setData("name", e.target.value)}
                            errors={errors.name}
                        />
                        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <p>Gunakan nama role yang singkat dan mudah dikenali tim admin.</p>
                            {data.name ? (
                                <p>
                                    Label tampilan: <span className="font-medium text-slate-700 dark:text-slate-200">{roleLabel(data.name)}</span>
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="mb-4">
                        <ListBox
                            label={"Pilih izin"}
                            data={permissions}
                            selected={data.selectedPermission}
                            setSelected={setSelectedPermission}
                            errors={errors.selectedPermission}
                            presets={permissionPresets}
                        />
                        <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                            <IconInfoCircle size={14} className="mt-0.5 shrink-0 text-primary-500" />
                            <p>
                                Pilih template jika ingin cepat. Setelah itu, hapus atau tambah izin hanya bila memang perlu.
                            </p>
                        </div>
                    </div>
                    <Button
                        type={"submit"}
                        icon={<IconPencilCheck size={18} />}
                        className={
                            "bg-primary-500 hover:bg-primary-600 text-white w-full justify-center"
                        }
                        label={"Simpan"}
                    />
                </form>
            </Modal>

            {/* Content */}
            {roles.data.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Daftar Role Akses
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {roles.data.map((role) => (
                            <RoleRow
                            key={role.id}
                            role={role}
                            onEdit={() => handleEdit(role)}
                            onDelete={() => handleDelete(role.id)}
                            canUpdate={canUpdateRoles}
                            canDelete={canDeleteRoles}
                            canCreateUsers={canCreateUsers}
                        />
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
                        Belum Ada Role
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Tambahkan role akses pertama.
                    </p>
                    <Button
                        type={"button"}
                        icon={<IconCirclePlus size={18} />}
                        className={
                            "bg-primary-500 hover:bg-primary-600 text-white"
                        }
                        label={"Tambah Role"}
                        onClick={() => setData("isOpen", true)}
                    />
                </div>
            )}

            <Pagination links={roles.links} />
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
