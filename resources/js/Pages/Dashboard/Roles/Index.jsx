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
    IconChevronDown,
    IconChevronUp,
    IconDatabaseOff,
    IconCirclePlus,
    IconChecks,
    IconInfoCircle,
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
    const isSuperAdmin = role.name === "super-admin";
    const isSystem = isSuperAdmin || hasAnyPermissionName(permissionNames, ["users-access", "roles-access", "permissions-access"]);
    const isTenant = hasAnyPermissionName(permissionNames, [
        "products-access",
        "products-create",
        "products-edit",
        "products-delete",
        "products-pricing-update",
        "pricing-rules-access",
        "waiter-board-access",
        "kitchen-access",
        "kitchen-manage",
        "cashier-settlements-request",
    ]);
    const hasOwnerPricing = hasAnyPermissionName(permissionNames, [
        "pricing-rules-access",
        "pricing-rules-create",
        "pricing-rules-update",
        "pricing-rules-delete",
        "products-pricing-update",
    ]);
    const kindLabel = role.name === "super-admin"
        ? "Super Admin"
        : isSystem
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
        isSystem,
        isTenant,
        hasOwnerPricing,
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
                            {roleLabel(role)}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {roleDescription(role) || `${role.permissions.length} izin aktif`}
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

export default function Index() {
    const { roles, permissions, errors, filters = {}, perPageOptions = [] } = usePage().props;
    const { can } = useAuthorization();
    const canCreateRoles = can("roles-create");
    const canUpdateRoles = can("roles-update");
    const canDeleteRoles = can("roles-delete");
    const canCreateUsers = can("users-create");
    const [showGuide, setShowGuide] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterDraft, setFilterDraft] = useState({
        search: filters.search || "",
        kind: filters.kind || "",
        per_page: filters.per_page || 12,
    });
    const {
        data,
        setData,
        transform,
        post,
        delete: destroy,
    } = useForm({
        id: "",
        name: "",
        selectedPermission: [],
        isUpdate: false,
        isOpen: false,
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
            value: roleRows.filter((role) => role.summary.isSystem).length,
        },
        {
            label: "Role Tenant",
            value: roleRows.filter((role) => role.summary.isTenant).length,
        },
        {
            label: "Role Pricing",
            value: roleRows.filter((role) => role.summary.hasOwnerPricing).length,
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

    const openFilterModal = () => {
        setFilterDraft({
            search: filters.search || "",
            kind: filters.kind || "",
            per_page: filters.per_page || 12,
        });
        setShowFilterModal(true);
    };

    const applyFilterModal = () => {
        applyFilters({
            search: filterDraft.search,
            kind: filterDraft.kind,
            per_page: filterDraft.per_page,
        });
        setShowFilterModal(false);
    };

    const resetFilterModal = () => {
        setFilterDraft({ search: "", kind: "", per_page: 12 });
        applyFilters({ search: "", kind: "", per_page: 12 });
        setShowFilterModal(false);
    };
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
                            Kelola role akses langsung dari kombinasi permission yang benar-benar dibutuhkan.
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
                        onClick={openFilterModal}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <IconAdjustmentsHorizontal size={16} />
                        Filter
                    </button>
                </div>
            </div>

            {/* Modal Filter */}
            <Modal
                show={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                title="Filter Role Akses"
                icon={<IconAdjustmentsHorizontal size={20} strokeWidth={1.5} />}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Nama role
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={filterDraft.search}
                                onChange={(e) =>
                                    setFilterDraft({ ...filterDraft, search: e.target.value })
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        applyFilterModal();
                                    }
                                }}
                                placeholder="Cari nama role..."
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                <IconSearch size={18} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Jenis role
                        </label>
                        <select
                            value={filterDraft.kind}
                            onChange={(e) =>
                                setFilterDraft({ ...filterDraft, kind: e.target.value })
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="">Semua Jenis Role</option>
                            <option value="system">Role Sistem</option>
                            <option value="tenant">Role Tenant</option>
                            <option value="pricing">Role Pricing</option>
                            <option value="admin">Role Admin Modul</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Jumlah per halaman
                        </label>
                        <select
                            value={filterDraft.per_page}
                            onChange={(e) =>
                                setFilterDraft({ ...filterDraft, per_page: e.target.value })
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            {perPageOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option} per halaman
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {permissionGroups.map((group) => (
                            <span
                                key={group.key}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                                {group.label}: {group.count}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <Button
                        type="button"
                        icon={<IconFilterOff size={16} />}
                        label="Reset"
                        onClick={resetFilterModal}
                        className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    />
                    <Button
                        type="button"
                        label="Terapkan Filter"
                        icon={<IconChecks size={16} />}
                        onClick={applyFilterModal}
                        className="bg-primary-500 hover:bg-primary-600 text-white"
                    />
                </div>
            </Modal>

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
                    <p className="mt-1">1. Isi nama role 2. Pilih izin yang dibutuhkan 3. Simpan</p>
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
                        />
                        <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                            <IconInfoCircle size={14} className="mt-0.5 shrink-0 text-primary-500" />
                            <p>
                                Pilih hanya izin yang benar-benar dibutuhkan role ini.
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
