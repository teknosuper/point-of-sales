import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import {
    IconAdjustmentsHorizontal,
    IconBuildingStore,
    IconCheck,
    IconMapPin,
    IconPlus,
    IconSearch,
    IconX,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const defaultFilters = {
    search: "",
    status: "",
    outlet_type: "",
    default_only: "",
    per_page: "10",
};

const castValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

const defaultForm = {
    code: "",
    name: "",
    legal_name: "",
    city: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    outlet_type: "main",
    commission_rate_percent: 0,
    is_active: true,
    is_default: false,
    sort_order: 0,
    user_ids: [],
    primary_user_id: "",
};

export default function Index({ outlets, filters = {}, summary = {}, setupStatus = {}, ui = {}, meta = {} }) {
    const { flash } = usePage().props;
    const [showFilters, setShowFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const formRef = useRef(null);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castValue(filters?.search),
        status: castValue(filters?.status),
        outlet_type: castValue(filters?.outlet_type),
        default_only: castValue(filters?.default_only),
        per_page: castValue(filters?.per_page, "10"),
    });
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];
    const users = meta?.users ?? [];
    const outletTypes = meta?.outlet_types ?? [];
    const form = useForm(defaultForm);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castValue(filters?.search),
            status: castValue(filters?.status),
            outlet_type: castValue(filters?.outlet_type),
            default_only: castValue(filters?.default_only),
            per_page: castValue(filters?.per_page, "10"),
        });
    }, [filters]);

    useEffect(() => {
        if (ui?.show_form) {
            setShowForm(true);
        }

        if (ui?.preset_outlet_type) {
            form.setData("outlet_type", ui.preset_outlet_type);
        }
    }, [ui?.show_form, ui?.preset_outlet_type]);

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                filterData.search ||
                    filterData.status ||
                    filterData.outlet_type ||
                    filterData.default_only ||
                    filterData.per_page !== "10"
            ),
        [filterData]
    );

    const rows = outlets?.data ?? [];
    const total = Number(outlets?.total ?? rows.length ?? 0);
    const currentPage = Number(outlets?.current_page ?? 1);
    const perPage = Number(outlets?.per_page ?? 10);

    const setEditingOutlet = (outlet) => {
        setShowForm(true);
        setEditing(outlet.id);
        form.setData({
            code: outlet.code || "",
            name: outlet.name || "",
            legal_name: outlet.legal_name || "",
            city: outlet.city || "",
            phone: outlet.phone || "",
            email: outlet.email || "",
            website: outlet.website || "",
            address: outlet.address || "",
            outlet_type: outlet.outlet_type || "main",
            commission_rate_percent: Number(outlet.commission_rate_percent ?? 0),
            is_active: Boolean(outlet.is_active),
            is_default: Boolean(outlet.is_default),
            sort_order: Number(outlet.sort_order ?? 0),
            user_ids: (outlet.users || []).map((user) => user.id),
            primary_user_id: String(
                outlet.users?.find((user) => user.pivot?.is_primary)?.id || ""
            ),
        });
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const resetForm = () => {
        setEditing(null);
        form.reset();
        form.setData(defaultForm);
    };

    const openCreateForm = () => {
        resetForm();
        setShowForm(true);
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const closeForm = () => {
        resetForm();
        setShowForm(false);
    };

    const submit = (event) => {
        event.preventDefault();

        if (editing) {
            form.put(route("outlets.update", editing), {
                preserveScroll: true,
                onSuccess: () => resetForm(),
            });
            return;
        }

        form.post(route("outlets.store"), {
            preserveScroll: true,
            onSuccess: () => resetForm(),
        });
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("outlets.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("outlets.index"), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    return (
        <>
            <Head title="Manage Outlet" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <IconBuildingStore size={26} className="text-primary-500" />
                            Outlet & Tenant
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Kelola struktur bisnis: outlet utama, tenant foodcourt, warehouse, user outlet, dan komisi tenant.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconAdjustmentsHorizontal size={18} />
                            Filter
                        </button>
                        <button
                            type="button"
                            onClick={() => (showForm && !editing ? closeForm() : openCreateForm())}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                        >
                            {showForm && !editing ? <IconX size={18} /> : <IconPlus size={18} />}
                            {editing
                                ? "Tambah Outlet Baru"
                                : showForm
                                  ? "Tutup Form Outlet"
                                  : "Buka Form Outlet"}
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: "Total Outlet", value: summary.total ?? 0 },
                        { label: "Outlet Aktif", value: summary.active ?? 0 },
                        { label: "Outlet Nonaktif", value: summary.inactive ?? 0 },
                        { label: "Outlet Default", value: summary.default ?? 0 },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    {[
                        {
                            label: "Main Outlet",
                            value: summary.main ?? 0,
                            done: setupStatus.has_main_outlet,
                        },
                        {
                            label: "Tenant Foodcourt",
                            value: summary.tenant ?? 0,
                            done: setupStatus.has_tenant_outlet || (summary.tenant ?? 0) === 0,
                        },
                        {
                            label: "Warehouse",
                            value: summary.warehouse ?? 0,
                            done: true,
                        },
                        {
                            label: "Produk ke Tenant",
                            value: summary.tenant_products ?? 0,
                            done: setupStatus.has_tenant_products,
                        },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-2xl border p-4 ${
                                item.done
                                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                    : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                            }`}
                        >
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{item.value}</p>
                            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                {item.done ? "Siap" : "Perlu tindakan"}
                            </p>
                        </div>
                    ))}
                </div>

                {!setupStatus.has_main_outlet || !setupStatus.has_default_outlet || !setupStatus.has_tenant_products ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        <p className="font-semibold">Status setup outlet masih belum lengkap</p>
                        <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
                            {!setupStatus.has_main_outlet ? <p>• Belum ada main outlet aktif untuk operasional kasir.</p> : null}
                            {!setupStatus.has_default_outlet ? <p>• Belum ada outlet default yang dipilih sebagai konteks awal login.</p> : null}
                            {!setupStatus.has_tenant_products ? <p>• Tenant sudah ada, tetapi produk belum dipetakan ke tenant outlet.</p> : null}
                        </div>
                    </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                        <p className="font-semibold">Halaman ini untuk struktur bisnis</p>
                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                            Gunakan halaman ini untuk membuat outlet, tenant foodcourt, warehouse, assign user, dan mengatur outlet default.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        <p className="font-semibold">Bukan untuk printer atau dapur</p>
                        <p className="mt-1 text-amber-800 dark:text-amber-200">
                            Untuk station dapur, layar kitchen, printer thermal, dan routing device, gunakan menu <span className="font-semibold">Kitchen Ops & Printer</span>.
                        </p>
                    </div>
                </div>

                <div>
                    <Link
                        href={route("guides.outlet-kitchen")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        Buka Panduan Lengkap Outlet, Tenant & Kitchen
                    </Link>
                </div>

                {showFilters ? (
                    <form
                        onSubmit={applyFilters}
                        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Cari
                                </label>
                                <div className="relative">
                                    <input
                                        value={filterData.search}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({ ...prev, search: event.target.value }))
                                        }
                                        placeholder="Nama, kode, kota..."
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm dark:border-slate-700 dark:bg-slate-800"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                        <IconSearch size={18} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Status
                                </label>
                                <select
                                    value={filterData.status}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({ ...prev, status: event.target.value }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua</option>
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Nonaktif</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Default
                                </label>
                                <select
                                    value={filterData.default_only}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({ ...prev, default_only: event.target.value }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua</option>
                                    <option value="yes">Hanya default</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tipe Outlet
                                </label>
                                <select
                                    value={filterData.outlet_type}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({ ...prev, outlet_type: event.target.value }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Semua tipe</option>
                                    {outletTypes.map((type) => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Rows
                                </label>
                                <select
                                    value={filterData.per_page}
                                    onChange={(event) =>
                                        setFilterData((prev) => ({ ...prev, per_page: event.target.value }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    {perPageOptions.map((option) => (
                                        <option key={option} value={String(option)}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            {hasActiveFilters ? (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    <IconX size={16} />
                                    Reset
                                </button>
                            ) : null}
                            <button
                                type="submit"
                                className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                            >
                                Terapkan
                            </button>
                        </div>
                    </form>
                ) : null}

                {showForm ? (
                    <form
                        ref={formRef}
                        onSubmit={submit}
                        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                    >
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {editing ? "Edit Outlet" : "Tambah Outlet"}
                        </h2>
                        <button
                            type="button"
                            onClick={editing ? closeForm : closeForm}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
                        >
                            {editing ? "Batal edit" : "Tutup form"}
                        </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                            ["code", "Kode"],
                            ["name", "Nama Outlet"],
                            ["legal_name", "Nama Legal"],
                            ["city", "Kota"],
                            ["phone", "Telepon"],
                            ["email", "Email"],
                            ["website", "Website"],
                        ].map(([key, label]) => (
                            <div key={key}>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {label}
                                </label>
                                <input
                                    value={form.data[key]}
                                    onChange={(event) => form.setData(key, event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Tipe Outlet
                            </label>
                            <select
                                value={form.data.outlet_type}
                                onChange={(event) => form.setData("outlet_type", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                {outletTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Komisi Tenant %
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.data.commission_rate_percent}
                                onChange={(event) => form.setData("commission_rate_percent", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Urutan
                            </label>
                            <input
                                type="number"
                                value={form.data.sort_order}
                                onChange={(event) => form.setData("sort_order", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>
                        <div className="md:col-span-2 xl:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Alamat
                            </label>
                            <textarea
                                rows={3}
                                value={form.data.address}
                                onChange={(event) => form.setData("address", event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>
                        <div className="md:col-span-2 xl:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                User Outlet
                            </label>
                            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                {users.map((user) => (
                                    <label key={user.id} className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <span>
                                            {user.name}
                                            <span className="ml-2 text-xs text-slate-400">
                                                {user.email}
                                            </span>
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={form.data.user_ids.includes(user.id)}
                                            onChange={(event) => {
                                                const next = event.target.checked
                                                    ? [...form.data.user_ids, user.id]
                                                    : form.data.user_ids.filter((id) => id !== user.id);

                                                form.setData("user_ids", next);
                                                if (!next.includes(Number(form.data.primary_user_id))) {
                                                    form.setData("primary_user_id", "");
                                                }
                                            }}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Primary User
                            </label>
                            <select
                                value={form.data.primary_user_id}
                                onChange={(event) => form.setData("primary_user_id", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="">Tanpa primary</option>
                                {users
                                    .filter((user) => form.data.user_ids.includes(user.id))
                                    .map((user) => (
                                        <option key={user.id} value={String(user.id)}>
                                            {user.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={Boolean(form.data.is_active)}
                                onChange={(event) => form.setData("is_active", event.target.checked)}
                            />
                            Aktif
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={Boolean(form.data.is_default)}
                                onChange={(event) => form.setData("is_default", event.target.checked)}
                            />
                            Jadikan default
                        </label>
                    </div>
                    <div className="mt-4">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                        >
                            {editing ? "Update Outlet" : "Simpan Outlet"}
                        </button>
                    </div>
                    </form>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        Form outlet sedang disembunyikan. Klik <span className="font-semibold text-slate-700 dark:text-slate-200">Buka Form Outlet</span> untuk menambah outlet baru.
                    </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Halaman {currentPage} • {rows.length} row tampil • total {total} data
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((outlet) => (
                            <div
                                key={outlet.id}
                                className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                            >
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {outlet.name}
                                        </p>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            {outlet.code}
                                        </span>
                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                            {outlet.outlet_type || "main"}
                                        </span>
                                        {outlet.is_default ? (
                                            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                Default
                                            </span>
                                        ) : null}
                                        {outlet.is_active ? (
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                Aktif
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                Nonaktif
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1">
                                            <IconMapPin size={14} />
                                            {outlet.city || "Tanpa kota"}
                                        </span>
                                        <span>User: {outlet.users_count}</span>
                                        <span>Transaksi: {outlet.transactions_count}</span>
                                        <span>Station: {outlet.kitchen_stations_count}</span>
                                        <span>Komisi: {outlet.commission_rate_percent}%</span>
                                        <span>
                                            PIC:{" "}
                                            {outlet.users?.map((user) => user.name).join(", ") || "-"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => router.get(route("outlets.show", outlet.id))}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Detail
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.get(route("settings.kitchen-devices.index", { outlet_id: outlet.id }))
                                        }
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Kitchen Ops
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.get(route("reports.outlet-analytics.index", { outlet_id: outlet.id }))
                                        }
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Statistik
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingOutlet(outlet)}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.patch(route("outlets.toggle", outlet.id), {}, { preserveScroll: true })
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        {outlet.is_active ? <IconX size={14} /> : <IconCheck size={14} />}
                                        {outlet.is_active ? "Nonaktifkan" : "Aktifkan"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {outlets.last_page !== 1 ? <Pagination links={outlets.links} /> : null}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
