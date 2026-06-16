import Input from "@/Components/Dashboard/Input";
import Pagination from "@/Components/Dashboard/Pagination";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useAuthorization } from "@/Utils/authorization";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import {
    IconAdjustmentsHorizontal,
    IconCheck,
    IconEdit,
    IconHash,
    IconInfoCircle,
    IconMapPin,
    IconPlus,
    IconPrinter,
    IconSearch,
    IconTable,
    IconTrash,
    IconUsers,
    IconX,
} from "@/Utils/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

const defaultFilters = {
    search: "",
    status: "",
    per_page: "10",
};

const defaultForm = {
    name: "",
    code: "",
    capacity: 4,
    status: "active",
    sort_order: 0,
    notes: "",
};

const castValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

export default function Index({
    diningTables,
    filters = {},
    summary = {},
    meta = {},
}) {
    const { flash, activeOutlet } = usePage().props;
    const { can } = useAuthorization();
    const canCreate = can("dining-tables-create");
    const canUpdate = can("dining-tables-update");
    const canDelete = can("dining-tables-delete");
    const [showFilters, setShowFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const formRef = useRef(null);
    const form = useForm(defaultForm);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castValue(filters?.search),
        status: castValue(filters?.status),
        per_page: castValue(filters?.per_page, "10"),
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castValue(filters?.search),
            status: castValue(filters?.status),
            per_page: castValue(filters?.per_page, "10"),
        });
    }, [filters]);

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                filterData.search ||
                    filterData.status ||
                    filterData.per_page !== "10"
            ),
        [filterData]
    );

    const openCreate = () => {
        if (!canCreate) return;

        setEditingId(null);
        form.setData(defaultForm);
        form.clearErrors();
        setShowForm(true);
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const openEdit = (table) => {
        if (!canUpdate) return;

        setEditingId(table.id);
        form.setData({
            name: table.name || "",
            code: table.code || "",
            capacity: Number(table.capacity ?? 4),
            status: table.status || "active",
            sort_order: Number(table.sort_order ?? 0),
            notes: table.notes || "",
        });
        form.clearErrors();
        setShowForm(true);
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const closeForm = () => {
        setEditingId(null);
        form.reset();
        form.setData(defaultForm);
        setShowForm(false);
    };

    const submit = (event) => {
        event.preventDefault();

        if (editingId) {
            form.put(route("dining-tables.update", editingId), {
                preserveScroll: true,
                onSuccess: () => closeForm(),
            });
            return;
        }

        form.post(route("dining-tables.store"), {
            preserveScroll: true,
            onSuccess: () => closeForm(),
        });
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("dining-tables.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("dining-tables.index"), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const destroyTable = (table) => {
        if (!canDelete) return;

        if (!window.confirm(`Hapus meja "${table.name}"?`)) {
            return;
        }

        router.delete(route("dining-tables.destroy", table.id), {
            preserveScroll: true,
        });
    };

    const copyOrderUrl = async (table) => {
        try {
            await navigator.clipboard.writeText(table.order_url);
            toast.success(`Link order ${table.name} disalin.`);
        } catch {
            toast.error("Gagal menyalin link order.");
        }
    };

    const rows = diningTables?.data ?? [];
    const statuses = meta?.statuses ?? [];
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];
    const groupedRows = useMemo(() => {
        return rows.reduce((groups, table) => {
            const area = table.area?.trim() || "Tanpa Area";
            const existingGroup = groups.find((group) => group.area === area);

            if (existingGroup) {
                existingGroup.tables.push(table);
                return groups;
            }

            groups.push({
                area,
                tables: [table],
            });

            return groups;
        }, []);
    }, [rows]);

    return (
        <>
            <Head title="Manajemen Meja" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Meja Dine In
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Kelola meja dine in untuk outlet aktif
                            {activeOutlet?.name ? `: ${activeOutlet.name}` : ""}.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setShowFilters((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconAdjustmentsHorizontal size={18} />
                            {showFilters ? "Sembunyikan filter" : "Buka filter"}
                        </button>
                        {canCreate ? (
                            <button
                                type="button"
                                onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                            >
                                {showForm && !editingId ? <IconX size={18} /> : <IconPlus size={18} />}
                                {showForm && !editingId ? "Tutup form" : "Tambah meja"}
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: "Total Meja", value: summary.total ?? 0 },
                        { label: "Meja Aktif", value: summary.active ?? 0 },
                        { label: "Meja Nonaktif", value: summary.inactive ?? 0 },
                        { label: "Sudah Pernah Dipakai", value: summary.used ?? 0 },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {item.label}
                            </p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>

                {showFilters ? (
                    <form
                        onSubmit={applyFilters}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="grid gap-4 md:grid-cols-4">
                            <Input
                                label="Cari Meja"
                                value={filterData.search}
                                onChange={(event) =>
                                    setFilterData((current) => ({
                                        ...current,
                                        search: event.target.value,
                                    }))
                                }
                                placeholder="Nama, kode, catatan"
                                icon={<IconSearch size={16} />}
                            />
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Status
                                </label>
                                <select
                                    value={filterData.status}
                                    onChange={(event) =>
                                        setFilterData((current) => ({
                                            ...current,
                                            status: event.target.value,
                                        }))
                                    }
                                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Semua status</option>
                                    {statuses.map((status) => (
                                        <option key={status.value} value={status.value}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Baris
                                </label>
                                <select
                                    value={filterData.per_page}
                                    onChange={(event) =>
                                        setFilterData((current) => ({
                                            ...current,
                                            per_page: event.target.value,
                                        }))
                                    }
                                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    {perPageOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option} baris
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    type="submit"
                                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 px-4 text-sm font-medium text-white"
                                >
                                    Terapkan
                                </button>
                                {hasActiveFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Reset
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </form>
                ) : null}

                {showForm ? (
                    <form
                        ref={formRef}
                        onSubmit={submit}
                        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="mb-5 flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {editingId ? "Edit Meja" : "Tambah Meja"}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Meja aktif akan muncul di POS untuk transaksi dine in.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                <IconX size={16} />
                                Tutup
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Nama Meja"
                                value={form.data.name}
                                onChange={(event) => form.setData("name", event.target.value)}
                                errors={form.errors.name}
                                placeholder="Meja 01"
                                icon={<IconTable size={16} />}
                            />
                            <Input
                                label="Kode Meja"
                                value={form.data.code}
                                onChange={(event) => form.setData("code", event.target.value)}
                                errors={form.errors.code}
                                placeholder="A1"
                                icon={<IconHash size={16} />}
                            />
                            <Input
                                label="Kapasitas"
                                type="number"
                                value={form.data.capacity}
                                onChange={(event) => form.setData("capacity", event.target.value)}
                                errors={form.errors.capacity}
                                min="1"
                                max="100"
                                icon={<IconUsers size={16} />}
                            />
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Status
                                </label>
                                <select
                                    value={form.data.status}
                                    onChange={(event) => form.setData("status", event.target.value)}
                                    className={`h-11 rounded-xl border bg-slate-50 px-4 text-sm dark:bg-slate-800 ${
                                        form.errors.status
                                            ? "border-danger-500 text-danger-600"
                                            : "border-slate-200 text-slate-800 dark:border-slate-700 dark:text-slate-200"
                                    }`}
                                >
                                    {statuses.map((status) => (
                                        <option key={status.value} value={status.value}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                                {form.errors.status ? (
                                    <small className="text-xs text-danger-500">
                                        {form.errors.status}
                                    </small>
                                ) : null}
                            </div>
                            <Input
                                label="Urutan Tampil"
                                type="number"
                                value={form.data.sort_order}
                                onChange={(event) => form.setData("sort_order", event.target.value)}
                                errors={form.errors.sort_order}
                                min="0"
                                icon={<IconMapPin size={16} />}
                            />
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Catatan
                                </label>
                                <textarea
                                    value={form.data.notes}
                                    onChange={(event) => form.setData("notes", event.target.value)}
                                    rows={3}
                                    className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800 ${
                                        form.errors.notes
                                            ? "border-danger-500 text-danger-600"
                                            : "border-slate-200 text-slate-800 dark:border-slate-700 dark:text-slate-200"
                                    }`}
                                    placeholder="Contoh: dekat jendela, area non-smoking"
                                />
                                {form.errors.notes ? (
                                    <small className="text-xs text-danger-500">
                                        {form.errors.notes}
                                    </small>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {editingId ? <IconCheck size={16} /> : <IconPlus size={16} />}
                                {form.processing
                                    ? "Menyimpan..."
                                    : editingId
                                      ? "Simpan Perubahan"
                                      : "Tambah Meja"}
                            </button>
                        </div>
                    </form>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Daftar Meja
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                Belum ada meja untuk outlet aktif ini.
                            </div>
                        ) : (
                            groupedRows.map((group) => (
                                <div key={group.area}>
                                    <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {group.area}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {group.tables.length} meja
                                        </p>
                                    </div>

                                    {group.tables.map((table) => (
                                        <div
                                            key={table.id}
                                            className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                                        {table.name}
                                                    </h3>
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                                            table.status === "active"
                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                                                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                                        }`}
                                                    >
                                                        {table.status === "active" ? "Aktif" : "Nonaktif"}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                                                    <span className="inline-flex items-center gap-2">
                                                        <IconHash size={15} />
                                                        {table.code || "-"}
                                                    </span>
                                                    <span className="inline-flex items-center gap-2">
                                                        <IconUsers size={15} />
                                                        {table.capacity} kursi
                                                    </span>
                                                    <span className="inline-flex items-center gap-2">
                                                        <IconInfoCircle size={15} />
                                                        Dipakai {table.transactions_count} transaksi
                                                    </span>
                                                </div>

                                                {table.notes ? (
                                                    <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                                                        {table.notes}
                                                    </p>
                                                ) : null}

                                                {table.self_order_enabled ? (
                                                    <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 sm:flex-row sm:items-center">
                                                        <img
                                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(
                                                                table.order_url
                                                            )}`}
                                                            alt={`QR ${table.name}`}
                                                            className="h-24 w-24 rounded-xl border border-slate-200 bg-white p-2"
                                                        />
                                                        <div>
                                                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                                Self-order meja aktif
                                                            </p>
                                                            <p className="mt-1 break-all">
                                                                {table.order_url}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {table.self_order_enabled ? (
                                                    <>
                                                        <a
                                                            href={table.order_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                        >
                                                            Buka Link Order
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyOrderUrl(table)}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                        >
                                                            Copy Link
                                                        </button>
                                                        <a
                                                            href={route("dining-tables.print", table.id)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                        >
                                                            <IconPrinter size={15} />
                                                            Print QR
                                                        </a>
                                                        <a
                                                            href={route("dining-tables.print-v2", table.id)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                                                        >
                                                            <IconPrinter size={15} />
                                                            Print QR V2
                                                        </a>
                                                        <a
                                                            href={route("dining-tables.print-image", table.id)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                        >
                                                            <IconPrinter size={15} />
                                                            Versi Gambar
                                                        </a>
                                                        <a
                                                            href={route("dining-tables.print-pdf", table.id)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                                                        >
                                                            <IconPrinter size={15} />
                                                            Versi PDF
                                                        </a>
                                                    </>
                                                ) : null}
                                                {canUpdate ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(table)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                                    >
                                                        <IconEdit size={15} />
                                                        Edit
                                                    </button>
                                                ) : null}
                                                {canDelete ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => destroyTable(table)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-600 dark:border-rose-900/60 dark:text-rose-300"
                                                    >
                                                        <IconTrash size={15} />
                                                        Hapus
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {diningTables?.last_page > 1 ? <Pagination links={diningTables.links} /> : null}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
