import React from "react";
import { Head, usePage, useForm, Link } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconUserPlus,
    IconDeviceFloppy,
    IconArrowLeft,
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconChevronUp,
    IconSearch,
    IconShield,
    IconBuildingStore,
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

function groupOutlets(outlets = []) {
    return {
        owner: outlets.filter((outlet) => (outlet.outlet_type || "main") !== "tenant"),
        tenant: outlets.filter((outlet) => outlet.outlet_type === "tenant"),
    };
}

function roleGroupMeta(roleName) {
    if (["cashier", "waiter", "kitchen-operator", "transactions-access"].includes(roleName)) {
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

export default function Create() {
    const {
        roles,
        outlets = [],
        tenantOutlets = [],
        kitchenStations = [],
        prefillRole = null,
    } = usePage().props;

    const { data, setData, post, errors, processing } = useForm({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        selectedRoles: prefillRole ? [prefillRole] : [],
        selectedOutlets: [],
        primary_outlet_id: "",
        preferred_workspace: "standard",
        preferred_kitchen_station_id: "",
        waiter_service_scope: "outlet_all",
        waiter_tenant_outlet_ids: [],
        avatar: null,
    });

    const [avatarPreview, setAvatarPreview] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [showRoleLibrary, setShowRoleLibrary] = useState(false);
    const [roleSearch, setRoleSearch] = useState("");
    const [showPermissionPreview, setShowPermissionPreview] = useState(false);

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

    const submit = (e) => {
        e.preventDefault();
        post(route("users.store"), {
            onSuccess: () => toast.success("Pengguna berhasil ditambahkan"),
            onError: () => toast.error("Gagal menyimpan pengguna"),
        });
    };

    const availableKitchenStations = kitchenStations.filter((station) =>
        data.selectedOutlets.includes(Number(station.outlet_id))
    );
    const isWaiterSelected = data.selectedRoles.includes("waiter");
    const isKitchenOperatorSelected = data.selectedRoles.includes("kitchen-operator");
    const accessibleTenantOutlets = tenantOutlets.filter((outlet) =>
        data.selectedOutlets.includes(outlet.id)
    );
    const selectedRoleObjects = roles.filter((role) =>
        data.selectedRoles.includes(role.name)
    );
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
        { key: "account", title: "Akun", description: "Nama, avatar, email, dan sandi." },
        { key: "roles", title: "Role", description: "Pilih role akses user." },
        { key: "outlets", title: "Outlet", description: "Atur outlet yang bisa dipakai." },
        { key: "advanced", title: "Lanjutan", description: "Mode kerja dan detail tambahan." },
    ];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === wizardSteps.length - 1;

    return (
        <>
            <Head title="Tambah Pengguna" />

            <div className="mb-6">
                <Link
                    href={route("users.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Pengguna
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconUserPlus size={28} className="text-primary-500" />
                    Wizard Tambah Pengguna
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Buat pengguna baru langkah demi langkah agar lebih mudah dipahami.
                </p>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-primary-900/40 dark:bg-primary-950/20">
                            <p className="text-xs uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                Sedang membuat pengguna
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
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
                    {prefillRole ? (
                        <div className="rounded-2xl border border-primary-200 bg-primary-50/60 px-4 py-3 text-sm text-slate-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-slate-200">
                            Wizard RBAC aktif. Role <span className="font-semibold">{roleLabel(prefillRole)}</span> sudah dipilih otomatis untuk user ini.
                        </div>
                    ) : null}
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
                                                {data.name
                                                    ? data.name
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
                                placeholder="Masukkan nama"
                                value={data.name}
                                onChange={(e) =>
                                    setData("name", e.target.value)
                                }
                                errors={errors.name}
                            />
                            <Input
                                type="email"
                                label="Email"
                                placeholder="email@example.com"
                                value={data.email}
                                onChange={(e) =>
                                    setData("email", e.target.value)
                                }
                                errors={errors.email}
                            />
                            <Input
                                type="password"
                                label="Kata Sandi"
                                placeholder="Minimal 8 karakter"
                                value={data.password}
                                onChange={(e) =>
                                    setData("password", e.target.value)
                                }
                                errors={errors.password}
                            />
                            <Input
                                type="password"
                                label="Konfirmasi Kata Sandi"
                                placeholder="Ulangi kata sandi"
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
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                            <IconShield size={16} />
                            Role Akses
                        </h3>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Fokus ke role yang aktif. Buka daftar lengkap hanya saat perlu.
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
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Role yang Aktif
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
                                                            data.selectedRoles.filter((name) => name !== role.name)
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
                                                <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            </div>
                                        </div>
                                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                            Cari lalu tambahkan hanya role yang benar-benar dibutuhkan user ini.
                                        </p>
                                        <div className="space-y-4">
                                            {groupedFilteredUnselectedRoles.map((group) => (
                                                <div key={group.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
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
                                                                    <Checkbox value={role.name} onChange={setSelectedRoles} checked={false} />
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
                                Rekomendasi user dapur tenant: beri akses outlet tenant yang sesuai. Role ini dirancang untuk operasional harian seperti melihat produk, menyesuaikan stok, dan buka/tutup toko. Harga produk tetap memerlukan izin khusus admin.
                            </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Cara kerja akses di halaman ini
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Pilih role akses untuk pengguna baru, lalu sistem otomatis memberi semua izin yang ada di role itu.
                            </p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className={`rounded-xl border px-4 py-3 text-sm ${hasTenantPricingAccess ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"}`}>
                                    <p className="font-semibold">Promo Tenant</p>
                                    <p className="mt-1">
                                        {hasTenantPricingAccess
                                            ? "Role terpilih sudah membawa izin pricing rules."
                                            : "Belum ada izin pricing rules. Tambahkan role promo tenant jika pengguna ini harus mengelola promo."}
                                    </p>
                                </div>
                                <div className={`rounded-xl border px-4 py-3 text-sm ${hasOwnerPricingAccess ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>
                                    <p className="font-semibold">Harga Owner Outlet</p>
                                    <p className="mt-1">
                                        {hasOwnerPricingAccess
                                            ? "Role terpilih juga memberi akses ubah harga owner outlet."
                                            : "Role terpilih tidak memberi akses ubah harga owner outlet."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={currentStep === 3 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Ringkasan Izin Efektif
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Buka jika ingin memeriksa izin hasil kombinasi role.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPermissionPreview((prev) => !prev)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                {showPermissionPreview ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                {showPermissionPreview ? "Sembunyikan" : "Buka"}
                            </button>
                        </div>
                        {showPermissionPreview && (
                            <div className="mt-4 space-y-4">
                                {permissionGroups.length > 0 ? (
                                    permissionGroups.map((group) => (
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
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                        Pilih minimal satu role untuk melihat preview permission efektif.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={currentStep === 2 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                            <IconBuildingStore size={16} />
                            Akses Outlet
                        </h3>
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            Pilih outlet yang boleh diakses user. Satu outlet dapat ditandai sebagai outlet utama.
                        </p>
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
                        {errors.selectedOutlets && (
                            <p className="text-xs text-danger-500 mt-3">
                                {errors.selectedOutlets}
                            </p>
                        )}

                        <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Outlet Utama
                            </label>
                            <select
                                value={data.primary_outlet_id}
                                onChange={(e) => setData("primary_outlet_id", e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                <option value="">Pilih outlet utama</option>
                                {outlets
                                    .filter((outlet) => data.selectedOutlets.includes(outlet.id))
                                    .map((outlet) => (
                                        <option key={outlet.id} value={outlet.id}>
                                            [{outlet.outlet_type === "tenant" ? "Tenant" : "Owner"}] {outlet.code} - {outlet.name}
                                        </option>
                                    ))}
                            </select>
                            {errors.primary_outlet_id && (
                                <p className="text-xs text-danger-500 mt-3">
                                    {errors.primary_outlet_id}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className={currentStep === 3 ? "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6" : "hidden"}>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                            Mode Kerja
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Mode Kerja Default
                                </label>
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
                                        Setelah login, pengguna dapur akan langsung diarahkan ke antrean dapur stasiun ini.
                                    </p>
                                    {errors.preferred_kitchen_station_id && (
                                        <p className="mt-2 text-xs text-danger-500">
                                            {errors.preferred_kitchen_station_id}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {isWaiterSelected && currentStep === 3 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                                Cakupan Petugas Antar
                            </h3>
                            <div className="space-y-4">
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
                                {processing ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
