import React from "react";
import { Head, usePage, useForm, Link } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconUserEdit,
    IconBolt,
    IconDeviceFloppy,
    IconArrowLeft,
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconChevronUp,
    IconSearch,
    IconShield,
    IconBuildingStore,
    IconLayoutGrid,
} from "@/Utils/icons";
import Input from "@/Components/Dashboard/Input";
import Checkbox from "@/Components/Dashboard/Checkbox";
import toast from "react-hot-toast";
import { useState } from "react";
import { roleDescription, roleLabel } from "@/Utils/rolePresentation";
import {
    decoratePermission,
    permissionGroupLabel,
} from "@/Utils/permissionPresentation";
import {
    hasAnyPermissionName,
    permissionNamesFromRoles,
} from "@/Utils/rbacHelpers";
import Swal from "sweetalert2";

function groupOutlets(outlets = []) {
    return {
        owner: outlets.filter((outlet) => (outlet.outlet_type || "main") !== "tenant"),
        tenant: outlets.filter((outlet) => outlet.outlet_type === "tenant"),
    };
}

const OWNER_SCOPE_PERMISSIONS = [
    "users-access",
    "roles-access",
    "permissions-access",
    "payment-settings-access",
    "payment-settings-update",
    "business-settings-access",
    "business-settings-update",
    "cashier-settlements-approve",
    "outlets-create",
    "outlets-update",
];

function roleGroupMeta(roleName) {
    if (["cashier", "waiter", "kitchen-operator", "kasir-operasional", "petugas-antar", "operator-dapur"].includes(roleName)) {
        return { key: "operational", label: "Operasional" };
    }

    if (
        roleName.includes("pricing") ||
        roleName.includes("product") ||
        roleName.includes("category") ||
        roleName.includes("outlet")
    ) {
        return { key: "catalog", label: "Produk, Harga, dan Outlet" };
    }

    if (
        roleName.includes("customer") ||
        roleName.includes("crm") ||
        roleName.includes("voucher") ||
        roleName.includes("segment") ||
        roleName.includes("dining")
    ) {
        return { key: "customer", label: "Pelanggan dan CRM" };
    }

    if (
        roleName.includes("stock") ||
        roleName.includes("supplier") ||
        roleName.includes("purchase") ||
        roleName.includes("receivable") ||
        roleName.includes("payable") ||
        roleName.includes("goods")
    ) {
        return { key: "inventory", label: "Stok dan Pengadaan" };
    }

    if (
        roleName.includes("report") ||
        roleName.includes("profit") ||
        roleName.includes("audit")
    ) {
        return { key: "report", label: "Laporan dan Audit" };
    }

    if (
        roleName.includes("role") ||
        roleName.includes("permission") ||
        roleName.includes("user") ||
        roleName === "super-admin"
    ) {
        return { key: "admin", label: "Admin Sistem" };
    }

    return { key: "other", label: "Lainnya" };
}

function templateMeta(template) {
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

function templateMatchesRole(template, role, allPermissions = []) {
    if (role.name === "super-admin" && !template.use_all_permissions) {
        return false;
    }

    if (template.use_all_permissions) {
        return role.name === "super-admin" || (role.permissions || []).length === allPermissions.length;
    }

    const names = new Set((role.permissions || []).map((permission) => permission.name));

    return (template.permissions || []).every((permission) => names.has(permission));
}

function resolveTemplateMatchedRole(template, roles = [], allPermissions = []) {
    const matches = roles.filter((role) =>
        templateMatchesRole(template, role, allPermissions)
    );

    if (matches.length === 0) {
        return null;
    }

    const requiredCount = template.use_all_permissions
        ? allPermissions.length
        : (template.permissions || []).length;

    return [...matches].sort((left, right) => {
        const leftIsSuggested = left.name === template.suggested_role_name;
        const rightIsSuggested = right.name === template.suggested_role_name;

        if (leftIsSuggested !== rightIsSuggested) {
            return leftIsSuggested ? -1 : 1;
        }

        const leftIsSuperAdmin = left.name === "super-admin";
        const rightIsSuperAdmin = right.name === "super-admin";

        if (leftIsSuperAdmin !== rightIsSuperAdmin) {
            return leftIsSuperAdmin ? 1 : -1;
        }

        const leftPermissionCount = (left.permissions || []).length;
        const rightPermissionCount = (right.permissions || []).length;
        const leftExtra = Math.max(0, leftPermissionCount - requiredCount);
        const rightExtra = Math.max(0, rightPermissionCount - requiredCount);

        if (leftExtra !== rightExtra) {
            return leftExtra - rightExtra;
        }

        return left.name.localeCompare(right.name, "id-ID");
    })[0];
}

export default function Edit() {
    const {
        roles,
        user,
        outlets = [],
        tenantOutlets = [],
        kitchenStations = [],
        wizardTemplates = [],
    } = usePage().props;

    const selectedOutletIds = user.outlets?.map((outlet) => outlet.id) ?? [];
    const primaryOutletId =
        user.outlets?.find((outlet) => Boolean(outlet.pivot?.is_primary))?.id ?? "";

    const { data, setData, post, errors, processing } = useForm({
        name: user.name,
        email: user.email,
        password: "",
        password_confirmation: "",
        selectedRoles: user.roles.map((role) => role.name),
        selectedOutlets: selectedOutletIds,
        primary_outlet_id: primaryOutletId,
        preferred_workspace: user.preferred_workspace || "standard",
        preferred_kitchen_station_id: user.preferred_kitchen_station_id || "",
        waiter_service_scope: user.waiter_service_scope || "outlet_all",
        waiter_tenant_outlet_ids:
            user.waiter_tenant_outlets?.map((outlet) => outlet.id) || [],
        avatar: null,
        _method: "PUT",
    });

    const [avatarPreview, setAvatarPreview] = useState(user.avatar || null);
    const [showAccessGuide, setShowAccessGuide] = useState(false);
    const [showRoleLibrary, setShowRoleLibrary] = useState(false);
    const [roleSearch, setRoleSearch] = useState("");
    const [showPermissionSummary, setShowPermissionSummary] = useState(false);
    const [showOutletDetail, setShowOutletDetail] = useState(false);
    const [showWorkMode, setShowWorkMode] = useState(false);
    const [showWaiterScope, setShowWaiterScope] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const setSelectedRoles = (e) => {
        let items = [...data.selectedRoles];
        if (items.includes(e.target.value)) {
            items = items.filter((name) => name !== e.target.value);
        } else {
            items.push(e.target.value);
        }
        setData("selectedRoles", items);
    };

    const setSelectedOutlets = (e) => {
        const value = Number(e.target.value);
        let items = [...data.selectedOutlets];
        if (items.includes(value)) {
            items = items.filter((id) => id !== value);
        } else {
            items.push(value);
        }

        setData("selectedOutlets", items);

        if (data.primary_outlet_id && !items.includes(Number(data.primary_outlet_id))) {
            setData("primary_outlet_id", "");
        }
    };

    const setSelectedWaiterTenantOutlets = (e) => {
        const value = Number(e.target.value);
        let items = [...data.waiter_tenant_outlet_ids];

        if (items.includes(value)) {
            items = items.filter((id) => id !== value);
        } else {
            items.push(value);
        }

        setData("waiter_tenant_outlet_ids", items);
    };

    const applyOutletPreset = (mode) => {
        const nextOutlets =
            mode === "owner"
                ? outletGroups.owner.map((outlet) => outlet.id)
                : mode === "tenant"
                  ? outletGroups.tenant.map((outlet) => outlet.id)
                  : outlets.map((outlet) => outlet.id);

        setData((current) => ({
            ...current,
            selectedOutlets: nextOutlets,
            primary_outlet_id: nextOutlets.includes(Number(current.primary_outlet_id))
                ? current.primary_outlet_id
                : nextOutlets[0]
                  ? String(nextOutlets[0])
                  : "",
            preferred_kitchen_station_id: "",
            waiter_tenant_outlet_ids: current.waiter_tenant_outlet_ids.filter((id) => nextOutlets.includes(id)),
        }));
    };

    const submit = (e) => {
        e.preventDefault();
        post(route("users.update", user.id), {
            onSuccess: () => toast.success("Pengguna berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui pengguna"),
        });
    };

    const selectedRoleObjects = roles.filter((role) =>
        data.selectedRoles.includes(role.name)
    );
    const selectedPermissionNames = permissionNamesFromRoles(selectedRoleObjects);
    const availableKitchenStations = kitchenStations.filter((station) =>
        data.selectedOutlets.includes(Number(station.outlet_id))
    );
    const isWaiterSelected = hasAnyPermissionName(selectedPermissionNames, [
        "waiter-board-access",
    ]);
    const isKitchenOperatorSelected = hasAnyPermissionName(selectedPermissionNames, [
        "kitchen-access",
        "kitchen-manage",
    ]);
    const accessibleTenantOutlets = tenantOutlets.filter((outlet) =>
        data.selectedOutlets.includes(outlet.id)
    );
    const isTenantScopedSelection =
        selectedPermissionNames.length > 0 &&
        !hasAnyPermissionName(selectedPermissionNames, OWNER_SCOPE_PERMISSIONS);
    const unselectedRoleObjects = roles.filter(
        (role) => !data.selectedRoles.includes(role.name)
    );
    const filteredUnselectedRoleObjects = unselectedRoleObjects.filter((role) => {
        const haystack = [
            role.name,
            roleLabel(role.name),
            roleDescription(role.name) || "",
        ]
            .join(" ")
            .toLowerCase();

        return haystack.includes(roleSearch.toLowerCase());
    });
    const groupedFilteredUnselectedRoles = Object.values(
        filteredUnselectedRoleObjects.reduce((accumulator, role) => {
            const group = roleGroupMeta(role.name);

            if (!accumulator[group.key]) {
                accumulator[group.key] = {
                    key: group.key,
                    label: group.label,
                    items: [],
                };
            }

            accumulator[group.key].items.push(role);

            return accumulator;
        }, {})
    );
    const templateGroups = React.useMemo(() => {
        const grouped = wizardTemplates
            .map((template) => ({
                ...template,
                meta: templateMeta(template),
                matchedRole: resolveTemplateMatchedRole(
                    template,
                    roles,
                    roles.flatMap((item) => item.permissions || [])
                ),
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

        return Object.values(grouped)
            .sort((left, right) => left.order - right.order)
            .map((group) => ({
                ...group,
                items: group.items.sort((left, right) =>
                    left.label.localeCompare(right.label, "id-ID")
                ),
            }));
    }, [roles, wizardTemplates]);
    const effectivePermissions = Array.from(
        new Map(
            selectedRoleObjects
                .flatMap((role) => role.permissions || [])
                .map((permission) => [permission.name, decoratePermission(permission)])
        ).values()
    ).sort((left, right) => left.label.localeCompare(right.label, "id-ID"));
    const groupedPermissions = effectivePermissions.reduce((accumulator, permission) => {
        const key = permission.group;

        accumulator[key] = accumulator[key] || {
            key,
            label: permissionGroupLabel(permission.name),
            items: [],
        };
        accumulator[key].items.push(permission);

        return accumulator;
    }, {});
    const permissionGroups = Object.values(groupedPermissions).sort((left, right) =>
        left.label.localeCompare(right.label, "id-ID")
    );
    const hasTenantPricingAccess = effectivePermissions.some((permission) =>
        permission.name.startsWith("pricing-rules-")
    );
    const hasOwnerPricingAccess = effectivePermissions.some(
        (permission) => permission.name === "products-pricing-update"
    );
    const outletGroups = groupOutlets(outlets);
    const selectedOutletObjects = outlets.filter((outlet) =>
        data.selectedOutlets.includes(outlet.id)
    );
    const selectedTenantCount = selectedOutletObjects.filter(
        (outlet) => outlet.outlet_type === "tenant"
    ).length;
    const selectedOwnerCount = selectedOutletObjects.length - selectedTenantCount;
    const wizardSteps = [
        { key: "account", title: "Akun", description: "Nama, avatar, dan sandi." },
        { key: "roles", title: "Role", description: "Pilih role akses aktif." },
        { key: "outlets", title: "Outlet", description: "Atur akses outlet." },
        { key: "advanced", title: "Lanjutan", description: "Mode kerja dan detail tambahan." },
    ];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === wizardSteps.length - 1;

    const applyRoleTemplate = async (template) => {
        if (!template?.matchedRole) {
            return;
        }

        const nextRoleName = template.matchedRole.name;
        const nextRoleLabel = roleLabel(nextRoleName);
        const currentRoleLabels = selectedRoleObjects.map((role) => roleLabel(role.name));
        const hasSameSingleRole =
            selectedRoleObjects.length === 1 &&
            selectedRoleObjects[0]?.name === nextRoleName;

        if (hasSameSingleRole) {
            toast("Role ini sudah aktif untuk pengguna ini.");

            return;
        }

        const result = await Swal.fire({
            title: "Pakai template role ini?",
            html: `
                <div style="text-align:left">
                    <p>Role aktif akan diganti menjadi <strong>${nextRoleLabel}</strong>.</p>
                    <p style="margin-top:8px">Akses outlet <strong>tidak berubah otomatis</strong>. Jika user hanya boleh masuk ke satu tenant, cek lagi bagian <strong>Akses Outlet</strong>.</p>
                    ${
                        currentRoleLabels.length
                            ? `<p style="margin-top:8px">Role saat ini: ${currentRoleLabels.join(", ")}</p>`
                            : ""
                    }
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, pakai role ini",
            cancelButtonText: "Batal",
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#64748b",
        });

        if (!result.isConfirmed) {
            return;
        }

        setData("selectedRoles", [nextRoleName]);
        toast.success(`Role aktif diganti ke ${nextRoleLabel}`);
    };

    const focusSingleOutlet = (outletId) => {
        const nextOutletId = Number(outletId);

        setData((current) => ({
            ...current,
            selectedOutlets: [nextOutletId],
            primary_outlet_id: String(nextOutletId),
            preferred_kitchen_station_id: "",
            waiter_tenant_outlet_ids: current.waiter_tenant_outlet_ids.filter(
                (id) => Number(id) === nextOutletId
            ),
        }));

        toast.success("Akses outlet dibatasi ke outlet utama ini.");
    };

    return (
        <>
            <Head title="Edit Pengguna" />

            <div className="mb-6">
                <Link
                    href={route("users.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Pengguna
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconUserEdit size={28} className="text-primary-500" />
                    Wizard Edit Pengguna
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Ubah data pengguna langkah demi langkah agar lebih mudah dipahami.
                </p>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-primary-900/40 dark:bg-primary-950/20">
                            <p className="text-xs uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                Sedang mengedit
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                {user.name} • {user.email}
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Langkah {currentStep + 1} dari {wizardSteps.length}: {wizardSteps[currentStep].title}
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-4">
                            {wizardSteps.map((step, index) => (
                                <button
                                    key={step.key}
                                    type="button"
                                    onClick={() => setCurrentStep(index)}
                                    className={`rounded-xl border px-4 py-3 text-left transition ${
                                        currentStep === index
                                            ? "border-primary-500 bg-primary-50 dark:bg-primary-950/20"
                                            : "border-slate-200 dark:border-slate-700"
                                    }`}
                                >
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Langkah {index + 1}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                        {step.title}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {step.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Account Info */}
                    <div className={currentStep === 0 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                            Informasi Akun
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Avatar
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-slate-600 font-semibold">
                                        {avatarPreview ? (
                                            <img
                                                src={avatarPreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span>
                                                {user.name
                                                    ? user.name
                                                          .charAt(0)
                                                          .toUpperCase()
                                                    : "?"}
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setData("avatar", file);
                                                setAvatarPreview(
                                                    URL.createObjectURL(file)
                                                );
                                            }
                                        }}
                                        errors={errors.avatar}
                                    />
                                </div>
                            </div>
                            <Input
                                type="text"
                                label="Nama Lengkap"
                                placeholder="Nama pengguna"
                                value={data.name}
                                onChange={(e) =>
                                    setData("name", e.target.value)
                                }
                                errors={errors.name}
                            />
                            <Input
                                type="email"
                                label="Email"
                                value={data.email}
                                onChange={(e) =>
                                    setData("email", e.target.value)
                                }
                                errors={errors.email}
                                disabled
                                className="opacity-60"
                            />
                            <Input
                                type="password"
                                label="Kata Sandi Baru"
                                placeholder="Kosongkan jika tidak diubah"
                                value={data.password}
                                onChange={(e) =>
                                    setData("password", e.target.value)
                                }
                                errors={errors.password}
                            />
                            <Input
                                type="password"
                                label="Konfirmasi Kata Sandi"
                                placeholder="Ulangi kata sandi baru"
                                value={data.password_confirmation}
                                onChange={(e) =>
                                    setData(
                                        "password_confirmation",
                                        e.target.value
                                    )
                                }
                                errors={errors.password_confirmation}
                            />
                        </div>
                    </div>

                    {/* Roles */}
                    <div className={currentStep === 1 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                    <IconShield size={16} />
                                    Role Akses
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Fokus ke role yang aktif. Buka daftar lengkap hanya saat perlu mengubah.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRoleLibrary((value) => !value)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                {showRoleLibrary ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                {showRoleLibrary ? "Tutup daftar role" : "Ubah role"}
                            </button>
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <IconLayoutGrid size={16} className="text-primary-500" />
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Paket Cepat
                                    </p>
                                </div>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Jika ingin cepat mengganti peran user, pilih paket yang paling dekat dengan tugasnya.
                                </p>
                                <div className="mt-3 space-y-3">
                                    {templateGroups.map((group) => (
                                        <div key={group.label} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                                {group.label}
                                            </div>
                                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                                {group.items.map((template) => (
                                                    <div key={template.key} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                                                    {template.label}
                                                                </p>
                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                    {template.meta.badge}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {template.description}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                                {template.matchedRole
                                                                    ? `Role tersedia: ${roleLabel(template.matchedRole.name)}`
                                                                    : "Belum ada role yang cocok penuh"}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-start justify-start md:justify-end">
                                                            {template.matchedRole ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => applyRoleTemplate(template)}
                                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                >
                                                                    <IconBolt size={16} />
                                                                    Pakai
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={route("permissions.wizard", { template: template.key, step: "role" })}
                                                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                                                                >
                                                                    <IconBolt size={16} />
                                                                    Buat Role
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Role yang Aktif
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Pertahankan role sesederhana mungkin. Tambahkan role lain hanya jika user benar-benar butuh akses tambahan.
                            </p>
                            {selectedRoleObjects.length > 0 ? (
                                <div className="mt-3 overflow-hidden rounded-xl border border-primary-200 dark:border-primary-900/40">
                                    <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_88px] gap-3 border-b border-primary-200 bg-primary-100/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300 md:grid">
                                        <div>Role</div>
                                        <div>Keterangan</div>
                                        <div className="text-right">Aksi</div>
                                    </div>
                                    {selectedRoleObjects.map((role, index) => (
                                        <div
                                            key={role.id}
                                            className={`grid gap-2 bg-primary-50 px-4 py-3 dark:bg-primary-950/20 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_88px] md:items-start md:gap-3 ${
                                                index !== selectedRoleObjects.length - 1
                                                    ? "border-b border-primary-200 dark:border-primary-900/30"
                                                    : ""
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                                    {roleLabel(role.name)}
                                                </p>
                                            </div>
                                            <div>
                                                {roleDescription(role.name) ? (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {roleDescription(role.name)}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                                        {role.name}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="md:text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setData(
                                                            "selectedRoles",
                                                            data.selectedRoles.filter(
                                                                (name) => name !== role.name
                                                            )
                                                        )
                                                    }
                                                    className="rounded-lg border border-primary-200 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-white dark:border-primary-900/40 dark:text-primary-300"
                                                >
                                                    Lepas
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                                    Belum ada role aktif. Pilih minimal satu role.
                                </p>
                            )}
                        </div>

                        {showRoleLibrary ? (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Role Aktif
                                    </p>
                                    <div className="overflow-hidden rounded-xl border border-primary-200 dark:border-primary-900/40">
                                        <div className="hidden grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1.8fr)] gap-3 border-b border-primary-200 bg-primary-100/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300 md:grid">
                                            <div>Pilih</div>
                                            <div>Role</div>
                                            <div>Keterangan</div>
                                        </div>
                                        {selectedRoleObjects.map((role, index) => (
                                            <label
                                                key={role.id}
                                                className={`grid cursor-pointer gap-2 bg-primary-50 px-4 py-3 dark:bg-primary-950/20 md:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1.8fr)] md:items-start md:gap-3 ${
                                                    index !== selectedRoleObjects.length - 1
                                                        ? "border-b border-primary-200 dark:border-primary-900/30"
                                                        : ""
                                                }`}
                                            >
                                                <div className="pt-0.5">
                                                    <Checkbox
                                                        value={role.name}
                                                        onChange={setSelectedRoles}
                                                        checked={true}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {roleLabel(role.name)}
                                                    </p>
                                                </div>
                                                <div>
                                                    {roleDescription(role.name) ? (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {roleDescription(role.name)}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                                            {role.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {unselectedRoleObjects.length > 0 ? (
                                    <div>
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                Tambah Role
                                            </p>
                                            <div className="relative w-full max-w-xs">
                                                <input
                                                    type="text"
                                                    value={roleSearch}
                                                    onChange={(event) => setRoleSearch(event.target.value)}
                                                    placeholder="Cari role..."
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pl-9 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                />
                                                <IconSearch
                                                    size={16}
                                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                />
                                            </div>
                                        </div>
                                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                            Cari lalu tambahkan hanya role yang benar-benar dibutuhkan user ini.
                                        </p>
                                        <div className="space-y-4">
                                            {groupedFilteredUnselectedRoles.map((group) => (
                                                <div
                                                    key={group.key}
                                                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                                                >
                                                    <div className="mb-3 flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                            {group.label}
                                                        </p>
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {group.items.length} role
                                                        </span>
                                                    </div>
                                                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                                        <div className="hidden grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1.8fr)_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 md:grid">
                                                            <div>Pilih</div>
                                                            <div>Role</div>
                                                            <div>Keterangan</div>
                                                            <div className="text-right">Aksi</div>
                                                        </div>
                                                        {group.items.map((role, index) => (
                                                            <label
                                                                key={role.id}
                                                                className={`grid cursor-pointer gap-2 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 md:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1.8fr)_88px] md:items-start md:gap-3 ${
                                                                    index !== group.items.length - 1
                                                                        ? "border-b border-slate-200 dark:border-slate-700"
                                                                        : ""
                                                                }`}
                                                            >
                                                                <div className="pt-0.5">
                                                                    <Checkbox
                                                                        value={role.name}
                                                                        onChange={setSelectedRoles}
                                                                        checked={false}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                        {roleLabel(role.name)}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 md:hidden">
                                                                        {role.name}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    {roleDescription(role.name) ? (
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                            {roleDescription(role.name)}
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                                                            {role.name}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="md:text-right">
                                                                    <span className="inline-flex rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                                        Tambah
                                                                    </span>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredUnselectedRoleObjects.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                    Tidak ada role yang cocok dengan pencarian ini.
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {errors.selectedRoles && (
                            <p className="text-xs text-danger-500 mt-3">
                                {errors.selectedRoles}
                            </p>
                        )}
                        {isKitchenOperatorSelected ? (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                                Role dapur tenant sebaiknya dibatasi untuk operasional harian: lihat produk, penyesuaian stok, dan buka/tutup toko. Harga produk tetap memerlukan izin khusus admin.
                            </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <button
                                type="button"
                                onClick={() => setShowAccessGuide((value) => !value)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Ringkasan akses
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Buka bila perlu melihat penjelasan promo tenant dan harga owner.
                                    </p>
                                </div>
                                {showAccessGuide ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                            </button>
                            {showAccessGuide ? (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div className={`rounded-xl border px-4 py-3 text-sm ${hasTenantPricingAccess ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"}`}>
                                        <p className="font-semibold">Promo Tenant</p>
                                        <p className="mt-1">
                                            {hasTenantPricingAccess
                                                ? "Pengguna ini sudah membawa izin pricing rules dari role terpilih."
                                                : "Pengguna ini belum membawa izin pricing rules."}
                                        </p>
                                    </div>
                                    <div className={`rounded-xl border px-4 py-3 text-sm ${hasOwnerPricingAccess ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>
                                        <p className="font-semibold">Harga Owner Outlet</p>
                                        <p className="mt-1">
                                            {hasOwnerPricingAccess
                                                ? "User ini juga bisa mengubah harga beli dan harga jual owner outlet."
                                                : "User ini tidak bisa mengubah harga beli atau harga jual owner outlet."}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className={currentStep === 3 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <button
                            type="button"
                            onClick={() => setShowPermissionSummary((value) => !value)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Ringkasan Izin Efektif
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {effectivePermissions.length} izin gabungan dari role akses yang dipilih.
                                </p>
                            </div>
                            {showPermissionSummary ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                        </button>
                        {showPermissionSummary ? (
                            <div className="mt-4 space-y-4">
                                {permissionGroups.map((group) => (
                                    <div key={group.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {group.label}
                                            </p>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {group.items.length} izin
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {group.items.map((permission) => (
                                                <span
                                                    key={permission.name}
                                                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    title={permission.description || permission.name}
                                                >
                                                    {permission.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className={currentStep === 2 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <button
                            type="button"
                            onClick={() => setShowOutletDetail((value) => !value)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <IconBuildingStore size={16} />
                                    Akses Outlet
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {selectedOutletObjects.length} outlet dipilih. Buka untuk mengubah detail akses outlet.
                                </p>
                            </div>
                            {showOutletDetail ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                        </button>
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                            Jika user hanya bekerja di satu outlet atau satu tenant, centang satu saja. Jika user owner memang mengawasi banyak outlet, baru pilih lebih dari satu.
                        </div>
                        <div className="mb-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Total Outlet Dipilih
                                </p>
                                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                    {selectedOutletObjects.length}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                                <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                    Outlet Owner
                                </p>
                                <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-100">
                                    {selectedOwnerCount}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    Tenant
                                </p>
                                <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                    {selectedTenantCount}
                                </p>
                            </div>
                        </div>
                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => applyOutletPreset("all")}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Pilih Semua
                            </button>
                            <button
                                type="button"
                                onClick={() => applyOutletPreset("owner")}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Hanya Owner
                            </button>
                            <button
                                type="button"
                                onClick={() => applyOutletPreset("tenant")}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Hanya Tenant
                            </button>
                        </div>
                        {showOutletDetail ? (
                        <div className="space-y-4">
                            {[
                                {
                                    key: "owner",
                                    title: "Outlet Owner",
                                    tone: "blue",
                                    items: outletGroups.owner,
                                },
                                {
                                    key: "tenant",
                                    title: "Tenant",
                                    tone: "emerald",
                                    items: outletGroups.tenant,
                                },
                            ].map((group) => (
                                <div key={group.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {group.title}
                                        </p>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                            group.tone === "emerald"
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                : "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                                        }`}>
                                            {group.items.length} outlet
                                        </span>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {group.items.map((outlet) => (
                                            <label
                                                key={outlet.id}
                                                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                                                    data.selectedOutlets.includes(outlet.id)
                                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-950/50"
                                                        : "border-slate-200 dark:border-slate-700 hover:border-primary-300"
                                                }`}
                                            >
                                                <Checkbox
                                                    value={String(outlet.id)}
                                                    onChange={setSelectedOutlets}
                                                    checked={data.selectedOutlets.includes(outlet.id)}
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {outlet.code} - {outlet.name}
                                                    </p>
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        {outlet.outlet_type || "main"}
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        ) : null}
                        {errors.selectedOutlets && (
                            <p className="text-xs text-danger-500 mt-3">
                                {errors.selectedOutlets}
                            </p>
                        )}

                        <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Outlet Utama
                            </label>
                            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                                Outlet utama adalah konteks default saat user login. Jika user hanya punya satu outlet, pilih outlet itu juga di sini.
                            </p>
                            {isTenantScopedSelection && data.selectedOutlets.length > 1 ? (
                                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                    Role tenant aktif terpilih. Jika user ini hanya boleh masuk ke satu tenant, pilih outlet utama lalu klik <strong>Pakai outlet ini saja</strong>.
                                </div>
                            ) : null}
                            <div className="space-y-2">
                                {outlets
                                    .filter((outlet) => data.selectedOutlets.includes(outlet.id))
                                    .map((outlet) => (
                                        <label
                                            key={outlet.id}
                                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                                                Number(data.primary_outlet_id) === Number(outlet.id)
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-primary-300"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="primary_outlet_id"
                                                value={outlet.id}
                                                checked={Number(data.primary_outlet_id) === Number(outlet.id)}
                                                onChange={(e) => setData("primary_outlet_id", e.target.value)}
                                                className="mt-0.5 h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    [{outlet.outlet_type === "tenant" ? "Tenant" : "Owner"}] {outlet.code} - {outlet.name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {Number(data.primary_outlet_id) === Number(outlet.id)
                                                        ? "Sedang dipakai sebagai outlet utama."
                                                        : "Pilih jika ini harus jadi konteks default saat login."}
                                                </p>
                                                {isTenantScopedSelection && data.selectedOutlets.length > 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            focusSingleOutlet(outlet.id);
                                                        }}
                                                        className="mt-2 inline-flex items-center rounded-lg border border-primary-200 bg-white px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:border-primary-900/40 dark:bg-slate-900 dark:text-primary-300 dark:hover:bg-primary-950/20"
                                                    >
                                                        Pakai outlet ini saja
                                                    </button>
                                                ) : null}
                                            </div>
                                        </label>
                                    ))}
                                {!outlets.filter((outlet) => data.selectedOutlets.includes(outlet.id)).length ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                        Pilih minimal satu outlet akses dulu.
                                    </div>
                                ) : null}
                            </div>
                            {errors.primary_outlet_id && (
                                <p className="text-xs text-danger-500 mt-3">
                                    {errors.primary_outlet_id}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className={currentStep === 3 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <div className="mb-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Workspace
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    {data.preferred_workspace === "kitchen" ? "Layar Dapur" : "Dashboard Umum"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Scope Waiter
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    {isWaiterSelected
                                        ? data.waiter_service_scope === "tenant_only"
                                            ? "Dapur Tertentu"
                                            : "Semua Dapur"
                                        : "Tidak dipakai"}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Izin Efektif
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    {effectivePermissions.length} izin
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowWorkMode((value) => !value)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Mode Kerja
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {data.preferred_workspace === "kitchen" ? "Masuk ke layar dapur" : "Masuk ke dashboard umum"}.
                                </p>
                            </div>
                            {showWorkMode ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                        </button>
                        {showWorkMode ? (
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Mode Kerja Default
                                </label>
                                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                                    Pilih `Dashboard Umum` untuk admin, kasir, dan operator biasa. Pilih `Layar Dapur` hanya jika user memang bertugas di kitchen screen.
                                </p>
                                <select
                                    value={data.preferred_workspace}
                                    onChange={(e) =>
                                        setData(
                                            "preferred_workspace",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <option value="standard">Dashboard Umum</option>
                                    <option value="kitchen">Layar Dapur</option>
                                </select>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Pilih `Layar Dapur` bila pengguna ini harus langsung masuk ke antrean dapur setelah login.
                                </p>
                            </div>

                            {data.preferred_workspace === "kitchen" && (
                                <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Stasiun Dapur Default
                                        </label>
                                    <select
                                        value={data.preferred_kitchen_station_id}
                                        onChange={(e) =>
                                            setData(
                                                "preferred_kitchen_station_id",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        <option value="">Pilih stasiun default</option>
                                        {availableKitchenStations.map((station) => (
                                            <option key={station.id} value={station.id}>
                                                {station.outlet?.code || "OUT"} - {station.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Setelah login, pengguna dapur akan langsung masuk ke antrean stasiun ini.
                                    </p>
                                    {errors.preferred_kitchen_station_id && (
                                        <p className="mt-2 text-xs text-danger-500">
                                            {errors.preferred_kitchen_station_id}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        ) : null}
                    </div>

                    {isWaiterSelected && currentStep === 3 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <button
                                type="button"
                                onClick={() => setShowWaiterScope((value) => !value)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                            >
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Cakupan Petugas Antar
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {data.waiter_service_scope === "tenant_only" ? "Hanya dapur tertentu" : "Semua dapur di outlet"}.
                                    </p>
                                </div>
                                {showWaiterScope ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                            </button>
                            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                Atur apakah petugas antar boleh melayani semua dapur di outlet atau hanya tenant tertentu saja.
                            </p>
                            {showWaiterScope ? (
                            <div className="mt-4 space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    {[
                                        {
                                            value: "outlet_all",
                                            label: "Semua Dapur di Outlet",
                                            description:
                                                "Petugas antar bisa melayani semua tenant atau dapur di outlet ini.",
                                        },
                                        {
                                            value: "tenant_only",
                                            label: "Dapur Tertentu",
                                            description:
                                                "Petugas antar hanya bisa melayani tenant yang dipilih di bawah.",
                                        },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() =>
                                                setData(
                                                    "waiter_service_scope",
                                                    option.value
                                                )
                                            }
                                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                                                data.waiter_service_scope ===
                                                option.value
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                    : "border-slate-200 dark:border-slate-700"
                                            }`}
                                        >
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {option.label}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {option.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                {data.waiter_service_scope ===
                                    "tenant_only" && (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Tenant / Dapur yang Dilayani
                                        </label>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {accessibleTenantOutlets.map(
                                                (outlet) => (
                                                    <label
                                                        key={outlet.id}
                                                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                                                            data.waiter_tenant_outlet_ids.includes(
                                                                outlet.id
                                                            )
                                                                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/50"
                                                                : "border-slate-200 dark:border-slate-700"
                                                        }`}
                                                    >
                                                        <Checkbox
                                                            value={String(
                                                                outlet.id
                                                            )}
                                                            onChange={
                                                                setSelectedWaiterTenantOutlets
                                                            }
                                                            checked={data.waiter_tenant_outlet_ids.includes(
                                                                outlet.id
                                                            )}
                                                        />
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                {outlet.code} -{" "}
                                                                {outlet.name}
                                                            </p>
                                                        </div>
                                                    </label>
                                                )
                                            )}
                                        </div>
                                        {accessibleTenantOutlets.length ===
                                        0 ? (
                                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                                Pilih akses outlet tenant dulu agar petugas antar bisa dibatasi per dapur.
                                            </p>
                                        ) : null}
                                        {errors.waiter_tenant_outlet_ids && (
                                            <p className="mt-2 text-xs text-danger-500">
                                                {
                                                    errors.waiter_tenant_outlet_ids
                                                }
                                            </p>
                                            )}
                                        </div>
                                    )}
                            </div>
                            ) : null}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
                                disabled={isFirstStep}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <IconChevronLeft size={16} />
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep((value) => Math.min(wizardSteps.length - 1, value + 1))}
                                disabled={isLastStep}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Berikutnya
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Link
                                href={route("users.index")}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                <IconDeviceFloppy size={18} />
                                {processing ? "Menyimpan..." : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
