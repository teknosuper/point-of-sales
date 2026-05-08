import React, { useEffect, useMemo, useState } from "react";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconAdjustmentsHorizontal,
    IconBuildingStore,
    IconPencil,
    IconPlus,
    IconSearch,
    IconTrash,
    IconX,
} from "@tabler/icons-react";
import Pagination from "@/Components/Dashboard/Pagination";
import toast from "react-hot-toast";
import { useAuthorization } from "@/Utils/authorization";

const defaultFilters = {
    search: "",
    has_contact: "",
    sort: "name_asc",
    per_page: "10",
};

const castFilterValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

export default function SuppliersIndex({
    suppliers,
    filters = {},
    meta = {},
}) {
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const [editing, setEditing] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castFilterValue(filters?.search),
        has_contact: castFilterValue(filters?.has_contact),
        sort: castFilterValue(filters?.sort, "name_asc"),
        per_page: castFilterValue(filters?.per_page, "10"),
    });
    const canManageSuppliers = can("suppliers-access");
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];
    const { data, setData, post, put, delete: destroy, processing, reset } =
        useForm({
            name: "",
            phone: "",
            email: "",
            address: "",
        });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castFilterValue(filters?.search),
            has_contact: castFilterValue(filters?.has_contact),
            sort: castFilterValue(filters?.sort, "name_asc"),
            per_page: castFilterValue(filters?.per_page, "10"),
        });
    }, [filters]);

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                filterData.search ||
                    filterData.has_contact ||
                    filterData.sort !== "name_asc" ||
                    filterData.per_page !== "10"
            ),
        [filterData]
    );

    const startEdit = (supplier) => {
        setEditing(supplier.id);
        setData({
            name: supplier.name || "",
            phone: supplier.phone || "",
            email: supplier.email || "",
            address: supplier.address || "",
        });
    };

    const cancel = () => {
        setEditing(null);
        reset();
    };

    const submit = (event) => {
        event.preventDefault();
        if (editing) {
            put(route("suppliers.update", editing), {
                onSuccess: () => cancel(),
            });
        } else {
            post(route("suppliers.store"), {
                onSuccess: () => reset(),
            });
        }
    };

    const remove = (id) => {
        if (!confirm("Hapus supplier ini?")) return;
        destroy(route("suppliers.destroy", id));
    };

    const handleChange = (key, value) => {
        setFilterData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("suppliers.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("suppliers.index"), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const applyPerPage = (value) => {
        const nextFilters = {
            ...filterData,
            per_page: value,
        };

        setFilterData(nextFilters);
        router.get(route("suppliers.index"), nextFilters, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const rows = suppliers?.data ?? [];
    const total = Number(suppliers?.total ?? rows.length ?? 0);
    const from = Number(suppliers?.from ?? 0);
    const to = Number(suppliers?.to ?? 0);
    const currentPage = Number(suppliers?.current_page ?? 1);
    const perPage = Number(suppliers?.per_page ?? 10);

    return (
        <>
            <Head title="Supplier" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <IconBuildingStore
                                size={26}
                                className="text-primary-500"
                            />
                            Supplier
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Menampilkan {from || 0}-{to || 0} dari {total} supplier.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                                showFilters || hasActiveFilters
                                    ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            }`}
                        >
                            <IconAdjustmentsHorizontal size={18} />
                            Filter
                        </button>

                        {canManageSuppliers ? (
                            <button
                                onClick={cancel}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-sm font-semibold text-white"
                                type="button"
                            >
                                <IconPlus size={16} />
                                {editing ? "Batal Edit" : "Tambah Supplier"}
                            </button>
                        ) : null}
                    </div>
                </div>

                {showFilters ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Cari
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={filterData.search}
                                            onChange={(event) =>
                                                handleChange("search", event.target.value)
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            placeholder="Nama, telepon, email..."
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                            <IconSearch size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Kontak
                                    </label>
                                    <select
                                        value={filterData.has_contact}
                                        onChange={(event) =>
                                            handleChange("has_contact", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua</option>
                                        <option value="yes">Ada kontak</option>
                                        <option value="no">Tanpa kontak</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Urutkan
                                    </label>
                                    <select
                                        value={filterData.sort}
                                        onChange={(event) =>
                                            handleChange("sort", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="name_asc">Nama A-Z</option>
                                        <option value="name_desc">Nama Z-A</option>
                                        <option value="latest">Terbaru</option>
                                        <option value="oldest">Terlama</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tampil per halaman
                                    </label>
                                    <select
                                        value={filterData.per_page}
                                        onChange={(event) =>
                                            handleChange("per_page", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {perPageOptions.map((option) => (
                                            <option key={option} value={String(option)}>
                                                {option} row
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                                {hasActiveFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <IconX size={16} />
                                        Reset
                                    </button>
                                ) : null}
                                <button
                                    type="submit"
                                    className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                                >
                                    Terapkan Filter
                                </button>
                            </div>
                        </form>
                    </div>
                ) : null}

                {canManageSuppliers ? (
                    <form
                        onSubmit={submit}
                        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4"
                    >
                        <div className="md:col-span-1">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Nama
                            </label>
                            <input
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                value={data.name}
                                onChange={(event) => setData("name", event.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Telepon
                            </label>
                            <input
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                value={data.phone}
                                onChange={(event) => setData("phone", event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Email
                            </label>
                            <input
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                value={data.email}
                                onChange={(event) => setData("email", event.target.value)}
                                type="email"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Alamat
                            </label>
                            <textarea
                                rows={1}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                                value={data.address}
                                onChange={(event) => setData("address", event.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 md:col-span-4">
                            <button
                                type="submit"
                                disabled={processing}
                                className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white"
                            >
                                {editing ? "Update" : "Simpan"}
                            </button>
                            {editing ? (
                                <button
                                    type="button"
                                    onClick={cancel}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                                >
                                    Batal
                                </button>
                            ) : null}
                        </div>
                    </form>
                ) : null}

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Halaman {currentPage} • {rows.length} row tampil • total {total} data
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 dark:text-slate-400">
                            Rows:
                        </label>
                        <select
                            value={String(perPage)}
                            onChange={(event) => applyPerPage(event.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            {perPageOptions.map((option) => (
                                <option key={option} value={String(option)}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {rows.length ? (
                        rows.map((sup, index) => (
                            <div
                                key={sup.id}
                                className="flex items-center justify-between p-4"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                        {index + 1 + (currentPage - 1) * perPage}. {sup.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {sup.phone || "-"} • {sup.email || "-"}
                                    </p>
                                    {sup.address ? (
                                        <p className="text-xs text-slate-500">
                                            {sup.address}
                                        </p>
                                    ) : null}
                                </div>
                                {canManageSuppliers ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => startEdit(sup)}
                                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            type="button"
                                        >
                                            <IconPencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => remove(sup.id)}
                                            className="rounded-lg p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                                            type="button"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ))
                    ) : (
                        <div className="p-6 text-center text-slate-500">
                            Belum ada supplier.
                        </div>
                    )}
                </div>

                {suppliers.last_page !== 1 ? <Pagination links={suppliers.links} /> : null}
            </div>
        </>
    );
}

SuppliersIndex.layout = (page) => <DashboardLayout children={page} />;
