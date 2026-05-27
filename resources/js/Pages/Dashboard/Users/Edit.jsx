import React from "react";
import { Head, usePage, useForm, Link } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconUserEdit,
    IconDeviceFloppy,
    IconArrowLeft,
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

export default function Edit() {
    const {
        roles,
        user,
        outlets = [],
        tenantOutlets = [],
        kitchenStations = [],
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
        post(route("users.update", user.id), {
            onSuccess: () => toast.success("Pengguna berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui pengguna"),
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
                    Edit Pengguna
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    {user.name} • {user.email}
                </p>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl space-y-6">
                    {/* Account Info */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                            <IconShield size={16} />
                            Akses Group
                        </h3>
                        <div className="flex flex-wrap gap-4">
                            {roles.map((role, i) => (
                                <label
                                    key={i}
                                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                                        data.selectedRoles.includes(role.name)
                                            ? "border-primary-500 bg-primary-50 dark:bg-primary-950/50"
                                            : "border-slate-200 dark:border-slate-700 hover:border-primary-300"
                                    }`}
                                >
                                    <Checkbox
                                        value={role.name}
                                        onChange={setSelectedRoles}
                                        checked={data.selectedRoles.includes(
                                            role.name
                                        )}
                                    />
                                    <span className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {roleLabel(role.name)}
                                        </span>
                                        {roleDescription(role.name) ? (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {roleDescription(role.name)}
                                            </span>
                                        ) : null}
                                    </span>
                                </label>
                            ))}
                        </div>
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
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Cara kerja akses di halaman ini
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                User tidak menerima permission satu per satu. Admin memilih role, lalu semua permission di dalam role itu otomatis ikut ke user.
                            </p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className={`rounded-xl border px-4 py-3 text-sm ${hasTenantPricingAccess ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"}`}>
                                    <p className="font-semibold">Promo Tenant</p>
                                    <p className="mt-1">
                                        {hasTenantPricingAccess
                                            ? "User ini sudah membawa permission pricing rules dari role terpilih."
                                            : "User ini belum membawa permission pricing rules. Tambahkan role yang berisi pricing-rules-access/create/update jika tenant harus mengelola promo sendiri."}
                                    </p>
                                </div>
                                <div className={`rounded-xl border px-4 py-3 text-sm ${hasOwnerPricingAccess ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100" : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>
                                    <p className="font-semibold">Harga Owner Outlet</p>
                                    <p className="mt-1">
                                        {hasOwnerPricingAccess
                                            ? "User ini juga bisa mengubah harga beli dan harga jual owner outlet karena membawa products-pricing-update."
                                            : "User ini tidak bisa mengubah harga beli atau harga jual owner outlet. Itu tetap aman di sisi admin pricing owner."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                            Ringkasan Permission Efektif
                        </h3>
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            Ini adalah permission gabungan dari semua role yang sedang dipilih untuk user ini.
                        </p>
                        <div className="space-y-4">
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
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                            <IconBuildingStore size={16} />
                            Akses Outlet
                        </h3>
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            Ubah outlet yang dapat diakses user dan pilih outlet utama untuk resolver default.
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

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
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
                    </div>

                    {isWaiterSelected && (
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
            </form>
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
