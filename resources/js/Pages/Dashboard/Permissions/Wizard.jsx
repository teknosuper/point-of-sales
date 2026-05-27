import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconArrowLeft,
    IconBuildingStore,
    IconChecklist,
    IconCircleCheck,
    IconCirclePlus,
    IconDeviceFloppy,
    IconShield,
    IconUserPlus,
} from "@/Utils/icons";
import { roleLabel } from "@/Utils/rolePresentation";
import { permissionLabel } from "@/Utils/permissionPresentation";
import { useAuthorization } from "@/Utils/authorization";
import Checkbox from "@/Components/Dashboard/Checkbox";
import Input from "@/Components/Dashboard/Input";
import toast from "react-hot-toast";

function hasAllPermissions(role, requiredPermissions = []) {
    const names = new Set(role.permission_names || []);
    return requiredPermissions.every((permission) => names.has(permission));
}

function workspaceLabel(value) {
    return value === "kitchen" ? "Layar Dapur" : "Dashboard Umum";
}

export default function PermissionWizard() {
    const {
        templates = [],
        selectedTemplate = null,
        initialStep = "template",
        roles = [],
        permissions = [],
        outlets = [],
        tenantOutlets = [],
        kitchenStations = [],
    } = usePage().props;
    const { can } = useAuthorization();
    const templateSectionRef = useRef(null);
    const roleSectionRef = useRef(null);
    const userSectionRef = useRef(null);
    const [selectedKey, setSelectedKey] = useState(
        selectedTemplate?.key || templates[0]?.key || ""
    );
    const [selectedRoleName, setSelectedRoleName] = useState("");

    const activeTemplate = useMemo(
        () =>
            templates.find((template) => template.key === selectedKey) ||
            selectedTemplate ||
            null,
        [selectedKey, selectedTemplate, templates]
    );
    const matchingRoles = useMemo(() => {
        if (!activeTemplate) return [];
        return roles.filter((role) =>
            hasAllPermissions(role, activeTemplate.permissions)
        );
    }, [activeTemplate, roles]);

    const roleForm = useForm({
        name: activeTemplate?.suggested_role_name || "",
        selectedPermission: [],
    });
    const userForm = useForm({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        selectedRoles: [],
        selectedOutlets: [],
        primary_outlet_id: "",
        preferred_workspace:
            activeTemplate?.key === "kitchen-operator-basic"
                ? "kitchen"
                : "standard",
        preferred_kitchen_station_id: "",
        waiter_service_scope: "outlet_all",
        waiter_tenant_outlet_ids: [],
    });

    const isWaiterTemplate = activeTemplate?.key === "waiter-basic";
    const selectedRole =
        roles.find((role) => role.name === selectedRoleName) || null;
    const availableKitchenStations = kitchenStations.filter((station) =>
        userForm.data.selectedOutlets.includes(Number(station.outlet_id))
    );
    const accessibleTenantOutlets = tenantOutlets.filter((outlet) =>
        userForm.data.selectedOutlets.includes(outlet.id)
    );
    const ownerOutlets = outlets.filter(
        (outlet) => (outlet.outlet_type || "main") !== "tenant"
    );

    useEffect(() => {
        const fallbackRole = matchingRoles[0]?.name || "";
        const nextRoleName =
            matchingRoles.some((role) => role.name === selectedRoleName)
                ? selectedRoleName
                : fallbackRole;

        setSelectedRoleName(nextRoleName);
        roleForm.setData("name", activeTemplate?.suggested_role_name || "");
        roleForm.setData(
            "selectedPermission",
            permissions
                .filter((permission) =>
                    activeTemplate?.permissions?.includes(permission.name)
                )
                .map((permission) => permission.id)
        );
        userForm.setData((current) => ({
            ...current,
            selectedRoles: nextRoleName ? [nextRoleName] : [],
            preferred_workspace:
                activeTemplate?.key === "kitchen-operator-basic"
                    ? "kitchen"
                    : "standard",
            preferred_kitchen_station_id: "",
            waiter_service_scope: isWaiterTemplate
                ? "outlet_all"
                : current.waiter_service_scope,
            waiter_tenant_outlet_ids: [],
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTemplate?.key, permissions.length, matchingRoles.length]);

    useEffect(() => {
        const target =
            initialStep === "role"
                ? roleSectionRef.current
                : initialStep === "user"
                  ? userSectionRef.current
                  : templateSectionRef.current;

        if (target) {
            window.requestAnimationFrame(() => {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }, [initialStep, selectedKey]);

    const openTemplate = (templateKey) => {
        setSelectedKey(templateKey);
        router.get(
            route("permissions.wizard", { template: templateKey }),
            {},
            { preserveState: true, replace: true, preserveScroll: true }
        );
    };

    const applyOutletPreset = (mode) => {
        const nextOutlets =
            mode === "owner"
                ? ownerOutlets.map((outlet) => outlet.id)
                : mode === "tenant"
                  ? tenantOutlets.map((outlet) => outlet.id)
                  : outlets.map((outlet) => outlet.id);

        userForm.setData((current) => ({
            ...current,
            selectedOutlets: nextOutlets,
            primary_outlet_id: nextOutlets.includes(
                Number(current.primary_outlet_id)
            )
                ? current.primary_outlet_id
                : nextOutlets[0]
                  ? String(nextOutlets[0])
                  : "",
            preferred_kitchen_station_id: "",
            waiter_tenant_outlet_ids: current.waiter_tenant_outlet_ids.filter(
                (id) => nextOutlets.includes(id)
            ),
        }));
    };

    const submitRole = (event) => {
        event.preventDefault();
        const intendedRoleName = roleForm.data.name;

        roleForm.post(route("roles.store"), {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedRoleName(intendedRoleName);
                userForm.setData("selectedRoles", [intendedRoleName]);
                toast.success("Role akses berhasil dibuat");
            },
            onError: () => {
                toast.error("Gagal membuat role akses");
            },
        });
    };

    const submitUser = (event) => {
        event.preventDefault();

        userForm
            .transform((data) => ({
                ...data,
                selectedRoles: selectedRoleName ? [selectedRoleName] : [],
            }))
            .post(route("users.store"), {
                preserveScroll: true,
                onSuccess: () => toast.success("Pengguna berhasil dibuat"),
                onError: () => toast.error("Gagal membuat pengguna"),
            });
    };

    const setSelectedOutlets = (event) => {
        const value = Number(event.target.value);
        let items = [...userForm.data.selectedOutlets];

        if (items.includes(value)) {
            items = items.filter((id) => id !== value);
        } else {
            items.push(value);
        }

        userForm.setData((current) => ({
            ...current,
            selectedOutlets: items,
            primary_outlet_id:
                current.primary_outlet_id &&
                items.includes(Number(current.primary_outlet_id))
                    ? current.primary_outlet_id
                    : "",
            preferred_kitchen_station_id: "",
            waiter_tenant_outlet_ids: current.waiter_tenant_outlet_ids.filter(
                (id) => items.includes(id)
            ),
        }));
    };

    const setSelectedWaiterTenantOutlets = (event) => {
        const value = Number(event.target.value);
        let items = [...userForm.data.waiter_tenant_outlet_ids];

        if (items.includes(value)) {
            items = items.filter((id) => id !== value);
        } else {
            items.push(value);
        }

        userForm.setData("waiter_tenant_outlet_ids", items);
    };

    return (
        <>
            <Head title="Wizard RBAC" />

            <div className="space-y-6">
                <div>
                    <Link
                        href={route("permissions.index")}
                        className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600"
                    >
                        <IconArrowLeft size={16} />
                        Kembali ke Izin Sistem
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Wizard RBAC
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Pilih kebutuhan akses, simpan role bila perlu, lalu buat
                        pengguna dari halaman ini.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Template
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {activeTemplate?.label || "Pilih template"}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Role akses
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {selectedRoleName
                                ? roleLabel(selectedRoleName)
                                : "Belum dipilih"}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Outlet
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {userForm.data.selectedOutlets.length} dipilih
                        </p>
                    </div>
                </div>

                <div
                    ref={templateSectionRef}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        1. Pilih Template Akses
                    </p>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {templates.map((template) => (
                            <button
                                key={template.key}
                                type="button"
                                onClick={() => openTemplate(template.key)}
                                className={`rounded-2xl border p-4 text-left transition ${
                                    activeTemplate?.key === template.key
                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-950/20"
                                        : "border-slate-200 bg-white hover:border-primary-300 dark:border-slate-800 dark:bg-slate-900"
                                }`}
                            >
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {template.label}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {template.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {activeTemplate ? (
                    <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                        <div
                            ref={roleSectionRef}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center gap-2">
                                <IconChecklist
                                    size={18}
                                    className="text-primary-500"
                                />
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    2. Role Akses untuk Template Ini
                                </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Wizard akan memakai izin berikut untuk template{" "}
                                {activeTemplate.label}.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {activeTemplate.permissions.map((permission) => (
                                    <span
                                        key={permission}
                                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {permissionLabel(permission)}
                                    </span>
                                ))}
                            </div>

                            {matchingRoles.length > 0 ? (
                                <div className="mt-6 space-y-3">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Gunakan Role yang Sudah Ada
                                    </p>
                                    {matchingRoles.map((role) => (
                                        <label
                                            key={role.id}
                                            className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border px-4 py-4 ${
                                                selectedRoleName === role.name
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/20"
                                                    : "border-slate-200 dark:border-slate-800"
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {roleLabel(role.name)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {role.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="selected_role_name"
                                                    value={role.name}
                                                    checked={
                                                        selectedRoleName ===
                                                        role.name
                                                    }
                                                    onChange={() => {
                                                        setSelectedRoleName(
                                                            role.name
                                                        );
                                                        userForm.setData(
                                                            "selectedRoles",
                                                            [role.name]
                                                        );
                                                    }}
                                                />
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                    <IconCircleCheck
                                                        size={14}
                                                    />
                                                    Pakai
                                                </span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    Belum ada role yang cocok penuh. Buat role
                                    baru dari template ini.
                                </div>
                            )}

                            {can("roles-create") ? (
                                <form
                                    onSubmit={submitRole}
                                    className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                                >
                                    <div className="flex items-center gap-2">
                                        <IconCirclePlus
                                            size={18}
                                            className="text-primary-500"
                                        />
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            Buat Role Baru dari Template Ini
                                        </p>
                                    </div>
                                    <div className="mt-4">
                                        <Input
                                            label="Nama role"
                                            type="text"
                                            placeholder="Masukkan nama role"
                                            value={roleForm.data.name}
                                            onChange={(event) =>
                                                roleForm.setData(
                                                    "name",
                                                    event.target.value
                                                )
                                            }
                                            errors={roleForm.errors.name}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={roleForm.processing}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                                    >
                                        <IconChecklist size={16} />
                                        {roleForm.processing
                                            ? "Menyimpan..."
                                            : "Simpan Role"}
                                    </button>
                                </form>
                            ) : null}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Ringkasan Pilihan
                            </p>
                            <div className="mt-4 space-y-4 text-sm">
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Template
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                        {activeTemplate.label}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Role terpilih
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                        {selectedRole
                                            ? roleLabel(selectedRole.name)
                                            : "Belum ada role"}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Mode kerja default
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                        {workspaceLabel(
                                            userForm.data.preferred_workspace
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {activeTemplate && can("users-create") ? (
                    <form
                        ref={userSectionRef}
                        onSubmit={submitUser}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="flex items-center gap-2">
                            <IconUserPlus
                                size={18}
                                className="text-primary-500"
                            />
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                3. Buat Pengguna dari Wizard
                            </p>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Isi akun, pilih outlet, lalu simpan. Role akses
                            mengikuti pilihan di atas.
                        </p>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Input
                                label="Nama Lengkap"
                                type="text"
                                placeholder="Masukkan nama"
                                value={userForm.data.name}
                                onChange={(event) =>
                                    userForm.setData("name", event.target.value)
                                }
                                errors={userForm.errors.name}
                            />
                            <Input
                                label="Email"
                                type="email"
                                placeholder="email@example.com"
                                value={userForm.data.email}
                                onChange={(event) =>
                                    userForm.setData(
                                        "email",
                                        event.target.value
                                    )
                                }
                                errors={userForm.errors.email}
                            />
                            <Input
                                label="Kata Sandi"
                                type="password"
                                placeholder="Minimal 8 karakter"
                                value={userForm.data.password}
                                onChange={(event) =>
                                    userForm.setData(
                                        "password",
                                        event.target.value
                                    )
                                }
                                errors={userForm.errors.password}
                            />
                            <Input
                                label="Konfirmasi Kata Sandi"
                                type="password"
                                placeholder="Ulangi kata sandi"
                                value={userForm.data.password_confirmation}
                                onChange={(event) =>
                                    userForm.setData(
                                        "password_confirmation",
                                        event.target.value
                                    )
                                }
                                errors={userForm.errors.password_confirmation}
                            />
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <IconShield size={16} />
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Role Akses Terpilih
                                </p>
                            </div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {selectedRoleName
                                    ? roleLabel(selectedRoleName)
                                    : "Pilih atau buat role akses lebih dulu."}
                            </p>
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <IconBuildingStore size={16} />
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Outlet yang Bisa Dipakai
                                </p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
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
                                    Hanya Outlet Owner
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyOutletPreset("tenant")}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Hanya Tenant
                                </button>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {outlets.map((outlet) => (
                                    <label
                                        key={outlet.id}
                                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                                            userForm.data.selectedOutlets.includes(
                                                outlet.id
                                            )
                                                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                : "border-slate-200 dark:border-slate-700"
                                        }`}
                                    >
                                        <Checkbox
                                            value={String(outlet.id)}
                                            onChange={setSelectedOutlets}
                                            checked={userForm.data.selectedOutlets.includes(
                                                outlet.id
                                            )}
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                {outlet.code} - {outlet.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {outlet.outlet_type === "tenant"
                                                    ? "Tenant"
                                                    : "Outlet Owner"}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {userForm.errors.selectedOutlets ? (
                                <p className="mt-2 text-xs text-danger-500">
                                    {userForm.errors.selectedOutlets}
                                </p>
                            ) : null}

                            <div className="mt-4">
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Outlet Utama
                                </label>
                                <select
                                    value={userForm.data.primary_outlet_id}
                                    onChange={(event) =>
                                        userForm.setData(
                                            "primary_outlet_id",
                                            event.target.value
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <option value="">
                                        Pilih outlet utama
                                    </option>
                                    {outlets
                                        .filter((outlet) =>
                                            userForm.data.selectedOutlets.includes(
                                                outlet.id
                                            )
                                        )
                                        .map((outlet) => (
                                            <option
                                                key={outlet.id}
                                                value={outlet.id}
                                            >
                                                [{outlet.outlet_type ===
                                                "tenant"
                                                    ? "Tenant"
                                                    : "Owner"}] {outlet.code} -{" "}
                                                {outlet.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Mode Kerja
                            </p>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Mode Kerja Default
                                    </label>
                                    <select
                                        value={userForm.data.preferred_workspace}
                                        onChange={(event) =>
                                            userForm.setData(
                                                "preferred_workspace",
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        <option value="standard">
                                            Dashboard Umum
                                        </option>
                                        <option value="kitchen">
                                            Layar Dapur
                                        </option>
                                    </select>
                                </div>
                                {userForm.data.preferred_workspace ===
                                "kitchen" ? (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Stasiun Dapur Default
                                        </label>
                                        <select
                                            value={
                                                userForm.data
                                                    .preferred_kitchen_station_id
                                            }
                                            onChange={(event) =>
                                                userForm.setData(
                                                    "preferred_kitchen_station_id",
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <option value="">
                                                Pilih stasiun default
                                            </option>
                                            {availableKitchenStations.map(
                                                (station) => (
                                                    <option
                                                        key={station.id}
                                                        value={station.id}
                                                    >
                                                        {station.outlet?.code ||
                                                            "OUT"}{" "}
                                                        - {station.name}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                        {userForm.errors
                                            .preferred_kitchen_station_id ? (
                                            <p className="mt-2 text-xs text-danger-500">
                                                {
                                                    userForm.errors
                                                        .preferred_kitchen_station_id
                                                }
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                                {isWaiterTemplate ? (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Cakupan Petugas Antar
                                        </label>
                                        <select
                                            value={
                                                userForm.data
                                                    .waiter_service_scope
                                            }
                                            onChange={(event) =>
                                                userForm.setData(
                                                    "waiter_service_scope",
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <option value="outlet_all">
                                                Semua Dapur di Outlet
                                            </option>
                                            <option value="tenant_only">
                                                Dapur Tertentu
                                            </option>
                                        </select>
                                        {userForm.data
                                            .waiter_service_scope ===
                                        "tenant_only" ? (
                                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                {accessibleTenantOutlets.map(
                                                    (outlet) => (
                                                        <label
                                                            key={outlet.id}
                                                            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                                                                userForm.data.waiter_tenant_outlet_ids.includes(
                                                                    outlet.id
                                                                )
                                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
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
                                                                checked={userForm.data.waiter_tenant_outlet_ids.includes(
                                                                    outlet.id
                                                                )}
                                                            />
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                    {
                                                                        outlet.code
                                                                    }{" "}
                                                                    -{" "}
                                                                    {
                                                                        outlet.name
                                                                    }
                                                                </p>
                                                            </div>
                                                        </label>
                                                    )
                                                )}
                                            </div>
                                        ) : null}
                                        {userForm.errors
                                            .waiter_tenant_outlet_ids ? (
                                            <p className="mt-2 text-xs text-danger-500">
                                                {
                                                    userForm.errors
                                                        .waiter_tenant_outlet_ids
                                                }
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Link
                                href={route(
                                    "users.create",
                                    selectedRoleName
                                        ? { role: selectedRoleName }
                                        : {}
                                )}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Form Lengkap
                            </Link>
                            <button
                                type="submit"
                                disabled={
                                    !selectedRoleName || userForm.processing
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                            >
                                <IconDeviceFloppy size={16} />
                                {userForm.processing
                                    ? "Menyimpan..."
                                    : "Simpan Pengguna"}
                            </button>
                        </div>
                    </form>
                ) : null}
            </div>
        </>
    );
}

PermissionWizard.layout = (page) => <DashboardLayout children={page} />;
