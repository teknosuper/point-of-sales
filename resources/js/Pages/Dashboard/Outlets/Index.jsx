import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import axios from "axios";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import OutletKitchenModal from "@/Components/Dashboard/OutletKitchenModal";
import {
    IconActivity,
    IconAdjustmentsHorizontal,
    IconBuildingStore,
    IconBuildingWarehouse,
    IconCheck,
    IconChecklist,
    IconChevronRight,
    IconDevices,
    IconEdit,
    IconExternalLink,
    IconInfoCircle,
    IconLayoutDashboard,
    IconMail,
    IconMapPin,
    IconPhone,
    IconPlus,
    IconReceipt,
    IconSearch,
    IconTrendingUp,
    IconUser,
    IconUsers,
    IconX,
} from "@/Utils/icons";
import toast from "react-hot-toast";
import { useAuthorization } from "@/Utils/authorization";

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
    parent_outlet_id: "",
    commission_rate_percent: 0,
    is_active: true,
    is_default: false,
    sort_order: 0,
    user_ids: [],
    primary_user_id: "",
};

const inputClass = (hasError = false) =>
    `w-full h-11 rounded-xl border bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
        hasError
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20 dark:border-rose-700"
            : "border-slate-200 focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-700"
    } dark:bg-slate-950 dark:text-slate-100`;

const selectClass = (hasError = false) =>
    `h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition focus:ring-2 ${
        hasError
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20 dark:border-rose-700"
            : "border-slate-200 focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-700"
    } dark:bg-slate-950 dark:text-slate-100`;

const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const outletTypeMeta = {
    main: {
        label: "Main Outlet",
        className:
            "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
        icon: IconBuildingStore,
    },
    tenant: {
        label: "Tenant Foodcourt",
        className:
            "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
        icon: IconBuildingWarehouse,
    },
    warehouse: {
        label: "Warehouse",
        className:
            "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
        icon: IconBuildingWarehouse,
    },
};

export default function Index({ outlets, filters = {}, summary = {}, setupStatus = {}, ui = {}, meta = {} }) {
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const [showFilters, setShowFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showSetupGuide, setShowSetupGuide] = useState(false);
    const [editing, setEditing] = useState(null);
    const [kitchenModalOutlet, setKitchenModalOutlet] = useState(null);
    const [kitchenData, setKitchenData] = useState(null);
    const [isKitchenLoading, setIsKitchenLoading] = useState(false);
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
    const parentMainOutlets = meta?.parent_main_outlets ?? [];
    const outletTypes = meta?.outlet_types ?? [];
    const form = useForm(defaultForm);
    const canCreateOutlets = can("outlets-create");
    const canUpdateOutlets = can("outlets-update");
    const canToggleOutlets = can("outlets-toggle");
    const canAccessDataRepair = can("business-settings-access");
    // Tenant-only: can update outlet but not create, and not an admin/owner role
    const isTenantOnlyUser = canUpdateOutlets && !canCreateOutlets;

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
        if (ui?.show_form && (canCreateOutlets || canUpdateOutlets)) {
            setShowForm(true);
        }

        if (ui?.preset_outlet_type) {
            form.setData("outlet_type", ui.preset_outlet_type);
        }
    }, [ui?.show_form, ui?.preset_outlet_type]);

    useEffect(() => {
        if (form.data.outlet_type !== "tenant" && form.data.parent_outlet_id !== "") {
            form.setData("parent_outlet_id", "");
        }
    }, [form.data.outlet_type]);

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
        if (!canUpdateOutlets) {
            return;
        }

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
            parent_outlet_id: String(outlet.parent_outlet_id || ""),
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
        if (!canCreateOutlets) {
            return;
        }

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

        const outletName = form.data.name || "outlet ini";

        if (editing) {
            Swal.fire({
                title: "Simpan perubahan?",
                text: `Perubahan data ${outletName} akan disimpan.`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Ya, Simpan",
                cancelButtonText: "Batal",
                confirmButtonColor: "#4f46e5",
                reverseButtons: true,
            }).then((result) => {
                if (!result.isConfirmed) return;
                form.put(route("outlets.update", editing), {
                    preserveScroll: true,
                    onSuccess: () => {
                        resetForm();
                        Swal.fire({
                            icon: "success",
                            title: "Tersimpan",
                            text: `${outletName} berhasil diperbarui.`,
                            timer: 1500,
                            showConfirmButton: false,
                        });
                    },
                });
            });
            return;
        }

        Swal.fire({
            title: "Tambah outlet baru?",
            text: `Outlet ${outletName} akan ditambahkan ke sistem.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, Tambahkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#4f46e5",
            reverseButtons: true,
        }).then((result) => {
            if (!result.isConfirmed) return;
            form.post(route("outlets.store"), {
                preserveScroll: true,
                onSuccess: () => {
                    resetForm();
                    Swal.fire({
                        icon: "success",
                        title: "Berhasil",
                        text: `${outletName} berhasil ditambahkan.`,
                        timer: 1500,
                        showConfirmButton: false,
                    });
                },
            });
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

    const outletTypeOf = (type) =>
        outletTypeMeta[type] || {
            label: type || "main",
            className:
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            icon: IconBuildingStore,
        };

    const toggleOutlet = (outlet) => {
        if (!canToggleOutlets) return;
        router.patch(route("outlets.toggle", outlet.id), {}, { preserveScroll: true });
    };

    const openDetail = (outlet) => {
        router.get(route("outlets.show", outlet.id));
    };

    const openKitchenModal = async (outlet) => {
        setKitchenModalOutlet(outlet);
        setKitchenData(null);
        setIsKitchenLoading(true);

        try {
            const response = await axios.get(
                route("settings.kitchen-devices.summary", outlet.id)
            );
            setKitchenData(response.data?.data || null);
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Gagal memuat data operasional dapur."
            );
            setKitchenData(null);
        } finally {
            setIsKitchenLoading(false);
        }
    };

    const closeKitchenModal = () => {
        setKitchenModalOutlet(null);
        setKitchenData(null);
    };

    const stats = [
        {
            label: "Total Outlet",
            value: summary.total ?? 0,
            icon: IconBuildingStore,
            className:
                "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300",
        },
        {
            label: "Outlet Aktif",
            value: summary.active ?? 0,
            icon: IconCheck,
            className:
                "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
        },
        {
            label: "Outlet Nonaktif",
            value: summary.inactive ?? 0,
            icon: IconX,
            className:
                "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
        },
        {
            label: "Outlet Default",
            value: summary.default ?? 0,
            icon: IconChecklist,
            className:
                "border-primary-200 bg-primary-50 text-primary-600 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300",
        },
    ];

    const setupGuide = [
        {
            label: "Main Outlet",
            value: summary.main ?? 0,
            done: setupStatus.has_main_outlet,
            icon: IconBuildingStore,
        },
        {
            label: "Tenant Foodcourt",
            value: summary.tenant ?? 0,
            done: setupStatus.has_tenant_outlet || (summary.tenant ?? 0) === 0,
            icon: IconBuildingWarehouse,
        },
        {
            label: "Warehouse",
            value: summary.warehouse ?? 0,
            done: true,
            icon: IconLayoutDashboard,
        },
        {
            label: "Produk ke Tenant",
            value: summary.tenant_products ?? 0,
            done: setupStatus.has_tenant_products,
            icon: IconTrendingUp,
        },
    ];

    const renderField = ({ key, label, type = "text", placeholder = "", required = false, help = null }) => {
        const error = form.errors[key];
        return (
            <div>
                <label className={labelClass}>
                    {label}
                    {required ? <span className="ml-1 text-rose-400">*</span> : null}
                </label>
                <input
                    type={type}
                    value={form.data[key]}
                    onChange={(event) => form.setData(key, event.target.value)}
                    placeholder={placeholder}
                    className={inputClass(Boolean(error))}
                />
                {help ? <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{help}</p> : null}
                {error ? <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p> : null}
            </div>
        );
    };

    const renderSelect = ({ key, label, options, placeholder = "Pilih...", help = null, value = null, onChange = null }) => {
        const error = form.errors[key];
        const currentValue = value ?? form.data[key];
        const handleChange = onChange ?? ((event) => form.setData(key, event.target.value));

        return (
            <div>
                <label className={labelClass}>{label}</label>
                <select value={currentValue} onChange={handleChange} className={selectClass(Boolean(error))}>
                    <option value="">{placeholder}</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {help ? <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{help}</p> : null}
                {error ? <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p> : null}
            </div>
        );
    };

    return (
        <>
            <Head title="Manage Outlet" />

            <div className="space-y-6">
                {/* ===== Header ===== */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Outlet & Tenant
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Atur outlet utama, tenant, dan user yang terhubung.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canAccessDataRepair ? (
                            <Link
                                href={route("settings.data-repair")}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                            >
                                <IconChecklist size={17} />
                                Data Repair
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setShowSetupGuide((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                        >
                            {showSetupGuide ? <IconX size={17} /> : <IconInfoCircle size={17} />}
                            {showSetupGuide ? "Tutup ringkasan" : "Ringkasan setup"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowFilters(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                        >
                            <IconAdjustmentsHorizontal size={17} />
                            Filter
                            {hasActiveFilters ? (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-100 px-1.5 text-[11px] font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                                    {[filterData.search, filterData.status, filterData.outlet_type, filterData.default_only].filter(Boolean).length}
                                </span>
                            ) : null}
                        </button>
                        {canCreateOutlets ? (
                            <button
                                type="button"
                                onClick={() => (showForm && !editing ? closeForm() : openCreateForm())}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                            >
                                {showForm && !editing ? <IconX size={17} /> : <IconPlus size={17} />}
                                {editing ? "Tambah outlet" : showForm ? "Tutup form" : "Tambah outlet"}
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* ===== Stats ===== */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    {stats.map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {item.label}
                                </p>
                                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${item.className}`}>
                                    <item.icon size={16} />
                                </span>
                            </div>
                            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                                {item.value.toLocaleString("id-ID")}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ===== Setup guide ===== */}
                {showSetupGuide ? (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                    Ringkasan Setup Bisnis
                                </h2>
                                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                    Cek kelengkapan struktur outlet sebelum operasional.
                                </p>
                            </div>
                            <Link
                                href={route("guides.outlet-kitchen")}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                            >
                                Buka panduan
                                <IconChevronRight size={14} />
                            </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {setupGuide.map((item) => (
                                <div
                                    key={item.label}
                                    className={`rounded-2xl border p-4 ${
                                        item.done
                                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                            : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <item.icon size={18} className={item.done ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"} />
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                item.done
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                            }`}
                                        >
                                            {item.done ? "Siap" : "Perlu tindakan"}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                                        {item.value.toLocaleString("id-ID")}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {!setupStatus.has_main_outlet || !setupStatus.has_default_outlet || !setupStatus.has_tenant_products ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                <p className="font-semibold">Masih ada setup yang perlu dilengkapi</p>
                                <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
                                    {!setupStatus.has_main_outlet ? <p>• Belum ada main outlet aktif.</p> : null}
                                    {!setupStatus.has_default_outlet ? <p>• Belum ada outlet default.</p> : null}
                                    {!setupStatus.has_tenant_products ? <p>• Produk tenant belum lengkap.</p> : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {/* ===== Filter modal ===== */}
                {showFilters ? (
                    <div className="fixed inset-0 z-[85] flex items-end justify-center p-0 sm:items-center sm:p-4">
                        <div
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                            onClick={() => setShowFilters(false)}
                        />
                        <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Filter Outlet
                                    </h3>
                                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                        Saring daftar outlet berdasarkan kriteria di bawah.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowFilters(false)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <form onSubmit={applyFilters} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Cari</label>
                                        <div className="relative">
                                            <input
                                                value={filterData.search}
                                                onChange={(event) =>
                                                    setFilterData((prev) => ({ ...prev, search: event.target.value }))
                                                }
                                                placeholder="Nama, kode, kota..."
                                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                            />
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                                <IconSearch size={18} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Status</label>
                                        <select
                                            value={filterData.status}
                                            onChange={(event) =>
                                                setFilterData((prev) => ({ ...prev, status: event.target.value }))
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        >
                                            <option value="">Semua</option>
                                            <option value="active">Aktif</option>
                                            <option value="inactive">Nonaktif</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Default</label>
                                        <select
                                            value={filterData.default_only}
                                            onChange={(event) =>
                                                setFilterData((prev) => ({ ...prev, default_only: event.target.value }))
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        >
                                            <option value="">Semua</option>
                                            <option value="yes">Hanya default</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tipe Outlet</label>
                                        <select
                                            value={filterData.outlet_type}
                                            onChange={(event) =>
                                                setFilterData((prev) => ({ ...prev, outlet_type: event.target.value }))
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                                        <label className={labelClass}>Baris / halaman</label>
                                        <select
                                            value={filterData.per_page}
                                            onChange={(event) =>
                                                setFilterData((prev) => ({ ...prev, per_page: event.target.value }))
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        >
                                            {perPageOptions.map((option) => (
                                                <option key={option} value={String(option)}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </form>

                            <div className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-[1fr_1fr_1.2fr]">
                                <button
                                    type="button"
                                    onClick={() => setShowFilters(false)}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    Batal
                                </button>
                                {hasActiveFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        <IconX size={15} />
                                        Reset
                                    </button>
                                ) : null}
                                <button
                                    type="submit"
                                    onClick={applyFilters}
                                    className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                                >
                                    Terapkan Filter
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* ===== Add/Edit outlet modal ===== */}
                {showForm && (canCreateOutlets || canUpdateOutlets) ? (
                    <div className="fixed inset-0 z-[86] flex items-end justify-center p-0 sm:items-center sm:p-4">
                        <div
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                            onClick={closeForm}
                        />
                        <form
                            ref={formRef}
                            onSubmit={submit}
                            className="relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
                        >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {editing ? "Edit Outlet" : "Tambah Outlet Baru"}
                                </h2>
                                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                    {editing
                                        ? "Perbarui informasi dan akses outlet ini."
                                        : "Lengkapi informasi outlet baru. Outlet otomatis dibuatkan station dapur + printer."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                        {isTenantOnlyUser ? (
                            // Tenant: only show profile fields
                            <div className="space-y-4">
                                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                                    Anda hanya dapat mengubah informasi profil outlet tenant ini. Struktur outlet dikelola oleh admin.
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {renderField({ key: "name", label: "Nama Outlet", required: true, placeholder: "Nama outlet / tenant" })}
                                    {renderField({ key: "legal_name", label: "Nama Legal", placeholder: "Nama legal / badan usaha" })}
                                    {renderField({ key: "city", label: "Kota", placeholder: "Kota" })}
                                    {renderField({ key: "phone", label: "Telepon", placeholder: "No. telepon" })}
                                    {renderField({ key: "email", label: "Email", placeholder: "email@domain.com" })}
                                    {renderField({ key: "website", label: "Website", placeholder: "https://..." })}
                                    <div className="sm:col-span-2 xl:col-span-3">
                                        <label className={labelClass}>Alamat</label>
                                        <textarea
                                            rows={3}
                                            value={form.data.address}
                                            onChange={(event) => form.setData("address", event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Admin/owner: full form
                            <div className="space-y-6">
                                {/* Section 1: Profil & identitas */}
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        <IconBuildingStore size={16} className="text-primary-500" />
                                        Profil & Identitas
                                    </h3>
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        {renderField({ key: "code", label: "Kode", required: true, placeholder: "GTC-01", help: "Kode unik outlet." })}
                                        {renderField({ key: "name", label: "Nama Outlet", required: true, placeholder: "Nama outlet / tenant" })}
                                        {renderField({ key: "legal_name", label: "Nama Legal", placeholder: "Nama legal / badan usaha" })}
                                        {renderSelect({
                                            key: "outlet_type",
                                            label: "Tipe Outlet",
                                            options: outletTypes,
                                            placeholder: "Pilih tipe",
                                        })}
                                        {form.data.outlet_type === "tenant" ? (
                                            <div className="sm:col-span-2 xl:col-span-2">
                                                <label className={labelClass}>Outlet Utama Induk</label>
                                                <select
                                                    value={form.data.parent_outlet_id}
                                                    onChange={(event) => form.setData("parent_outlet_id", event.target.value)}
                                                    className={selectClass(Boolean(form.errors.parent_outlet_id))}
                                                >
                                                    <option value="">Pilih outlet utama</option>
                                                    {parentMainOutlets.map((outlet) => (
                                                        <option key={outlet.id} value={String(outlet.id)}>
                                                            {outlet.code} - {outlet.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {form.errors.parent_outlet_id ? (
                                                    <p className="mt-1.5 text-xs font-medium text-rose-500">{form.errors.parent_outlet_id}</p>
                                                ) : null}
                                                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                                                    Tenant dipetakan ke outlet utama agar laporan dan approval owner membaca tenant anak dengan jelas.
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                </section>

                                {/* Section 2: Kontak & lokasi */}
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        <IconMapPin size={16} className="text-primary-500" />
                                        Kontak & Lokasi
                                    </h3>
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        {renderField({ key: "city", label: "Kota", placeholder: "Kota" })}
                                        {renderField({ key: "phone", label: "Telepon", placeholder: "No. telepon" })}
                                        {renderField({ key: "email", label: "Email", placeholder: "email@domain.com" })}
                                        {renderField({ key: "website", label: "Website", placeholder: "https://..." })}
                                        <div className="sm:col-span-2 xl:col-span-4">
                                            <label className={labelClass}>Alamat</label>
                                            <textarea
                                                rows={2}
                                                value={form.data.address}
                                                onChange={(event) => form.setData("address", event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Section 3: User & PIC */}
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        <IconUsers size={16} className="text-primary-500" />
                                        User Outlet & PIC
                                    </h3>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className={labelClass}>User Outlet</label>
                                            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/50">
                                                {users.length ? (
                                                    users.map((user) => {
                                                        const isChecked = form.data.user_ids.includes(user.id);
                                                        return (
                                                            <label
                                                                key={user.id}
                                                                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
                                                                    isChecked
                                                                        ? "bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200"
                                                                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                                                }`}
                                                            >
                                                                <span className="min-w-0">
                                                                    <span className="block truncate font-medium">{user.name}</span>
                                                                    <span className="block truncate text-xs text-slate-400">{user.email}</span>
                                                                </span>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(event) => {
                                                                        const next = event.target.checked
                                                                            ? [...form.data.user_ids, user.id]
                                                                            : form.data.user_ids.filter((id) => id !== user.id);
                                                                        form.setData("user_ids", next);
                                                                        if (!next.includes(Number(form.data.primary_user_id))) {
                                                                            form.setData("primary_user_id", "");
                                                                        }
                                                                    }}
                                                                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                                                />
                                                            </label>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="px-2 py-4 text-center text-xs text-slate-400">
                                                        Belum ada user terdaftar.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Primary User (PIC)</label>
                                            <select
                                                value={form.data.primary_user_id}
                                                onChange={(event) => form.setData("primary_user_id", event.target.value)}
                                                className={selectClass(Boolean(form.errors.primary_user_id))}
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
                                            {form.errors.primary_user_id ? (
                                                <p className="mt-1.5 text-xs font-medium text-rose-500">{form.errors.primary_user_id}</p>
                                            ) : null}
                                            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                                                User utama yang bertanggung jawab atas outlet ini.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* Section 4: Pengaturan bisnis */}
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        <IconAdjustmentsHorizontal size={16} className="text-primary-500" />
                                        Pengaturan Bisnis
                                    </h3>
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        {renderField({
                                            key: "commission_rate_percent",
                                            label: "Komisi Tenant %",
                                            type: "number",
                                            placeholder: "0",
                                            help: "Persentase komisi dari transaksi tenant.",
                                        })}
                                        {renderField({
                                            key: "sort_order",
                                            label: "Urutan",
                                            type: "number",
                                            placeholder: "0",
                                            help: "Prioritas tampil outlet.",
                                        })}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-4">
                                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(form.data.is_active)}
                                                onChange={(event) => form.setData("is_active", event.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                            />
                                            Aktif
                                        </label>
                                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(form.data.is_default)}
                                                onChange={(event) => form.setData("is_default", event.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                            />
                                            Jadikan default
                                        </label>
                                    </div>
                                </section>
                            </div>
                        )}

                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-end">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                            >
                                {form.processing
                                    ? "Menyimpan..."
                                    : editing
                                      ? "Simpan Perubahan"
                                      : "Simpan Outlet"}
                            </button>
                        </div>
                        </form>
                    </div>
                ) : null}

                {/* ===== List ===== */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <IconLayoutDashboard size={17} className="text-slate-400" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Menampilkan <span className="font-semibold text-slate-700 dark:text-slate-200">{rows.length}</span> dari{" "}
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> outlet
                            </p>
                        </div>
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-400"
                            >
                                <IconX size={14} />
                                Hapus filter
                            </button>
                        ) : null}
                    </div>

                    {rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                                <IconBuildingStore size={26} />
                            </span>
                            <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Belum ada outlet
                            </h3>
                            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                                Tambahkan outlet pertama untuk mulai mengelola struktur bisnis Anda.
                            </p>
                            {canCreateOutlets ? (
                                <button
                                    type="button"
                                    onClick={openCreateForm}
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                                >
                                    <IconPlus size={16} />
                                    Tambah outlet
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <>
                            {/* ===== Desktop & tablet table ===== */}
                            <div className="hidden overflow-x-auto lg:block">
                                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                                    <thead className="bg-slate-50 dark:bg-slate-800/40">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Outlet / Tenant
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Kontak
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Operasional
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Status
                                            </th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {rows.map((outlet) => {
                                            const typeMeta = outletTypeOf(outlet.outlet_type);
                                            const TypeIcon = typeMeta.icon;
                                            return (
                                                <tr
                                                    key={outlet.id}
                                                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-start gap-3">
                                                            <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${typeMeta.className}`}>
                                                                <TypeIcon size={17} />
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openDetail(outlet)}
                                                                        className="truncate text-sm font-semibold text-slate-900 hover:text-primary-600 dark:text-white"
                                                                        title="Lihat detail"
                                                                    >
                                                                        {outlet.name}
                                                                    </button>
                                                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                                        {outlet.code}
                                                                    </span>
                                                                    {outlet.is_default ? (
                                                                        <span className="rounded-md bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                                                                            Default
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeMeta.className}`}>
                                                                    {typeMeta.label}
                                                                </span>
                                                                {outlet.parent_outlet ? (
                                                                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                                                                        <IconChevronRight size={12} />
                                                                        Induk: {outlet.parent_outlet.name}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                            <p className="flex items-center gap-1.5">
                                                                <IconMapPin size={13} className="shrink-0 text-slate-400" />
                                                                {outlet.city || "Tanpa kota"}
                                                            </p>
                                                            {outlet.phone ? (
                                                                <p className="flex items-center gap-1.5">
                                                                    <IconPhone size={13} className="shrink-0 text-slate-400" />
                                                                    {outlet.phone}
                                                                </p>
                                                            ) : null}
                                                            {outlet.email ? (
                                                                <p className="flex items-center gap-1.5">
                                                                    <IconMail size={13} className="shrink-0 text-slate-400" />
                                                                    <span className="truncate max-w-[180px]">{outlet.email}</span>
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {!isTenantOnlyUser ? (
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                                <span className="flex items-center gap-1">
                                                                    <IconUsers size={13} className="text-slate-400" />
                                                                    {outlet.users_count} user
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <IconReceipt size={13} className="text-slate-400" />
                                                                    {outlet.transactions_count} transaksi
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <IconDevices size={13} className="text-slate-400" />
                                                                    {outlet.kitchen_stations_count} station
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <IconTrendingUp size={13} className="text-slate-400" />
                                                                    {outlet.commission_rate_percent}% komisi
                                                                </span>
                                                                {outlet.users?.length ? (
                                                                    <span className="flex items-center gap-1">
                                                                        <IconUser size={13} className="text-slate-400" />
                                                                        <span className="truncate max-w-[160px]">
                                                                            {outlet.users.map((user) => user.name).join(", ")}
                                                                        </span>
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {outlet.is_active ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                Aktif
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                                Nonaktif
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openDetail(outlet)}
                                                                title="Detail"
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400"
                                                            >
                                                                <IconExternalLink size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openKitchenModal(outlet)}
                                                                title="Operasional Dapur"
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400"
                                                            >
                                                                <IconDevices size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => router.get(route("reports.outlet-analytics.index", { outlet_id: outlet.id }))}
                                                                title="Statistik"
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400"
                                                            >
                                                                <IconActivity size={15} />
                                                            </button>
                                                            {canUpdateOutlets ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingOutlet(outlet)}
                                                                    title="Edit"
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:text-slate-400"
                                                                >
                                                                    <IconEdit size={15} />
                                                                </button>
                                                            ) : null}
                                                            {canToggleOutlets ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleOutlet(outlet)}
                                                                    title={outlet.is_active ? "Tutup toko" : "Buka toko"}
                                                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                                                        outlet.is_active
                                                                            ? "border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400"
                                                                            : "border-emerald-200 text-emerald-600 hover:border-emerald-300 dark:border-emerald-900/50 dark:text-emerald-400"
                                                                    }`}
                                                                >
                                                                    {outlet.is_active ? <IconX size={15} /> : <IconCheck size={15} />}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* ===== Mobile & tablet cards ===== */}
                            <div className="space-y-3 p-4 lg:hidden">
                                {rows.map((outlet) => {
                                    const typeMeta = outletTypeOf(outlet.outlet_type);
                                    const TypeIcon = typeMeta.icon;
                                    return (
                                        <div
                                            key={outlet.id}
                                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeMeta.className}`}>
                                                        <TypeIcon size={18} />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                {outlet.name}
                                                            </p>
                                                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                                {outlet.code}
                                                            </span>
                                                        </div>
                                                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeMeta.className}`}>
                                                            {typeMeta.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                {outlet.is_active ? (
                                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </div>

                                            {outlet.is_default ? (
                                                <span className="mt-2 inline-flex rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                                                    Outlet Default
                                                </span>
                                            ) : null}

                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <p className="flex items-center gap-1.5">
                                                    <IconMapPin size={13} className="shrink-0 text-slate-400" />
                                                    {outlet.city || "Tanpa kota"}
                                                </p>
                                                {outlet.phone ? (
                                                    <p className="flex items-center gap-1.5">
                                                        <IconPhone size={13} className="shrink-0 text-slate-400" />
                                                        {outlet.phone}
                                                    </p>
                                                ) : null}
                                                {outlet.email ? (
                                                    <p className="col-span-2 flex items-center gap-1.5">
                                                        <IconMail size={13} className="shrink-0 text-slate-400" />
                                                        <span className="truncate">{outlet.email}</span>
                                                    </p>
                                                ) : null}
                                                {!isTenantOnlyUser ? (
                                                    <>
                                                        <p className="flex items-center gap-1.5">
                                                            <IconUsers size={13} className="shrink-0 text-slate-400" />
                                                            {outlet.users_count} user
                                                        </p>
                                                        <p className="flex items-center gap-1.5">
                                                            <IconReceipt size={13} className="shrink-0 text-slate-400" />
                                                            {outlet.transactions_count} transaksi
                                                        </p>
                                                        <p className="flex items-center gap-1.5">
                                                            <IconDevices size={13} className="shrink-0 text-slate-400" />
                                                            {outlet.kitchen_stations_count} station
                                                        </p>
                                                        <p className="flex items-center gap-1.5">
                                                            <IconTrendingUp size={13} className="shrink-0 text-slate-400" />
                                                            {outlet.commission_rate_percent}% komisi
                                                        </p>
                                                    </>
                                                ) : null}
                                                {outlet.parent_outlet ? (
                                                    <p className="col-span-2 flex items-center gap-1.5">
                                                        <IconChevronRight size={13} className="shrink-0 text-slate-400" />
                                                        Induk: {outlet.parent_outlet.name}
                                                    </p>
                                                ) : null}
                                                {outlet.users?.length ? (
                                                    <p className="col-span-2 flex items-center gap-1.5">
                                                        <IconUser size={13} className="shrink-0 text-slate-400" />
                                                        PIC: {outlet.users.map((user) => user.name).join(", ")}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => openDetail(outlet)}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                                                >
                                                    <IconExternalLink size={14} />
                                                    Detail
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openKitchenModal(outlet)}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                                                >
                                                    <IconDevices size={14} />
                                                    Dapur
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => router.get(route("reports.outlet-analytics.index", { outlet_id: outlet.id }))}
                                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                                                >
                                                    <IconActivity size={14} />
                                                    Statistik
                                                </button>
                                                {canUpdateOutlets ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingOutlet(outlet)}
                                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:text-slate-300"
                                                    >
                                                        <IconEdit size={14} />
                                                        Edit
                                                    </button>
                                                ) : null}
                                                {canToggleOutlets ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleOutlet(outlet)}
                                                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                                                            outlet.is_active
                                                                ? "border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                                                                : "border-emerald-200 text-emerald-600 hover:border-emerald-300 dark:border-emerald-900/50 dark:text-emerald-400"
                                                        }`}
                                                    >
                                                        {outlet.is_active ? <IconX size={14} /> : <IconCheck size={14} />}
                                                        {outlet.is_active ? "Tutup toko" : "Buka toko"}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {outlets.last_page !== 1 ? (
                    <div className="flex justify-center pt-2">
                        <Pagination links={outlets.links} />
                    </div>
                ) : null}

                {/* ===== Operasional Dapur modal ===== */}
                {kitchenModalOutlet ? (
                    <OutletKitchenModal
                        outlet={kitchenModalOutlet}
                        onClose={closeKitchenModal}
                        onOpenFullPage={() =>
                            router.get(
                                route("settings.kitchen-devices.index", {
                                    outlet_id: kitchenModalOutlet.id,
                                })
                            )
                        }
                    />
                ) : null}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
