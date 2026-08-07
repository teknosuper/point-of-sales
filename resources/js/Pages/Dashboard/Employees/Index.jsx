import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, useForm } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Modal from "@/Components/Dashboard/Modal";
import Pagination from "@/Components/Dashboard/Pagination";
import Table from "@/Components/Dashboard/Table";
import Input from "@/Components/Dashboard/Input";
import FormLabel from "@/Components/Dashboard/FormLabel";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconAdjustmentsHorizontal,
    IconCalendar,
    IconChevronDown,
    IconChevronUp,
    IconCirclePlus,
    IconPencilCog,
    IconSearch,
    IconTrash,
    IconUsers,
    IconX,
} from "@/Utils/icons";

const defaultFilters = {
    search: "",
    job_type: "",
    is_active: "",
    per_page: "10",
};

const castFilterValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

export default function Index({ employees, filters = {}, jobTypes = [], meta = {} }) {
    const { can } = useAuthorization();
    const [showFilters, setShowFilters] = useState(
        Boolean(filters?.search || filters?.job_type || filters?.is_active)
    );
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castFilterValue(filters?.search),
        job_type: castFilterValue(filters?.job_type),
        is_active: castFilterValue(filters?.is_active),
        per_page: castFilterValue(filters?.per_page, "10"),
    });

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);

    const canCreate = can("employees-create");
    const canUpdate = can("employees-update");
    const canDelete = can("employees-delete");
    const canGenerate = can("employee-schedules-generate");

    const form = useForm({
        name: "",
        job_type: "",
        phone: "",
        notes: "",
        rotation_order: 0,
        is_active: true,
    });

    useEffect(() => {
        if (showModal) return;
        form.reset();
        form.clearErrors();
        setEditing(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal]);

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setShowModal(true);
    };

    const openEdit = (employee) => {
        setEditing(employee);
        form.setData({
            name: employee.name,
            job_type: employee.job_type,
            phone: employee.phone || "",
            notes: employee.notes || "",
            rotation_order: employee.rotation_order || 0,
            is_active: employee.is_active,
        });
        form.clearErrors();
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();
        if (editing) {
            form.patch(route("employees.update", editing.id), {
                preserveScroll: true,
                onSuccess: () => setShowModal(false),
            });
            return;
        }
        form.post(route("employees.store"), {
            preserveScroll: true,
            onSuccess: () => setShowModal(false),
        });
    };

    const handleChange = (key, value) =>
        setFilterData((prev) => ({ ...prev, [key]: value }));

    const applyFilters = (e) => {
        e.preventDefault();
        router.get(route("employees.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("employees.index"), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const applyPerPage = (value) => {
        const next = { ...filterData, per_page: value };
        setFilterData(next);
        router.get(route("employees.index"), next, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const rows = employees?.data ?? [];
    const perPage = Number(employees?.per_page ?? 10);
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];
    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                filterData.search ||
                    filterData.job_type ||
                    filterData.is_active
            ),
        [filterData]
    );

    return (
        <DashboardLayout>
            <Head title="Karyawan" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Karyawan
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Kelola daftar karyawan, jenis pekerjaan, dan urutan rotasi shift.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("employee-schedules.index")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconCalendar size={18} />
                            Jadwal Kerja
                        </Link>
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
                            {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        </button>
                        {canCreate && (
                            <Button
                                type="button"
                                icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                                className="bg-primary-500 text-white shadow-lg shadow-primary-500/30 hover:bg-primary-600"
                                label="Tambah Karyawan"
                                onClick={openCreate}
                            />
                        )}
                    </div>
                </div>

                {showFilters && (
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
                                            onChange={(e) => handleChange("search", e.target.value)}
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            placeholder="Nama, no. HP, atau catatan..."
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                            <IconSearch size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Jenis Pekerjaan
                                    </label>
                                    <select
                                        value={filterData.job_type}
                                        onChange={(e) => handleChange("job_type", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua jenis</option>
                                        {jobTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status
                                    </label>
                                    <select
                                        value={filterData.is_active}
                                        onChange={(e) => handleChange("is_active", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua</option>
                                        <option value="yes">Aktif</option>
                                        <option value="no">Nonaktif</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tampil per halaman
                                    </label>
                                    <select
                                        value={filterData.per_page}
                                        onChange={(e) => handleChange("per_page", e.target.value)}
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
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <IconX size={16} />
                                        Reset
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                                >
                                    Terapkan Filter
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        Total {Number(employees?.total ?? rows.length)} karyawan
                    </span>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 dark:text-slate-400">
                            Rows:
                        </label>
                        <select
                            value={String(perPage)}
                            onChange={(e) => applyPerPage(e.target.value)}
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

                <Table.Card title="Data Karyawan">
                    <Table>
                        <Table.Thead>
                            <tr>
                                <Table.Th>Nama</Table.Th>
                                <Table.Th>Jenis Pekerjaan</Table.Th>
                                <Table.Th>No. HP</Table.Th>
                                <Table.Th>Urutan Rotasi</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th className="w-24"></Table.Th>
                            </tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <Table.Td colSpan={6}>
                                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                            <IconUsers size={40} className="text-slate-300 dark:text-slate-600" />
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Belum ada karyawan.
                                            </p>
                                        </div>
                                    </Table.Td>
                                </tr>
                            ) : (
                                rows.map((employee) => (
                                    <tr key={employee.id}>
                                        <Table.Td>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                {employee.name}
                                            </p>
                                            {employee.notes ? (
                                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                                    {employee.notes}
                                                </p>
                                            ) : null}
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                {employee.job_type}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                {employee.phone || "-"}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                {employee.rotation_order ?? 0}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            {employee.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                    Nonaktif
                                                </span>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex gap-1.5">
                                                {canUpdate && (
                                                    <Button
                                                        type="modal"
                                                        icon={<IconPencilCog size={16} strokeWidth={1.5} />}
                                                        className="border border-warning-200 bg-warning-100 text-warning-600 hover:bg-warning-200 dark:border-warning-800 dark:bg-warning-900/50 dark:text-warning-400"
                                                        onClick={() => openEdit(employee)}
                                                        title="Edit"
                                                    />
                                                )}
                                                {canDelete && (
                                                    <Button
                                                        type="delete"
                                                        icon={<IconTrash size={16} strokeWidth={1.5} />}
                                                        className="border border-danger-200 bg-danger-100 text-danger-600 hover:bg-danger-200 dark:border-danger-800 dark:bg-danger-900/50 dark:text-danger-400"
                                                        url={route("employees.destroy", employee.id)}
                                                    />
                                                )}
                                            </div>
                                        </Table.Td>
                                    </tr>
                                ))
                            )}
                        </Table.Tbody>
                    </Table>
                </Table.Card>

                <Pagination links={employees?.links ?? []} />
            </div>

            <Modal
                show={showModal}
                onClose={() => setShowModal(false)}
                title={editing ? "Edit Karyawan" : "Tambah Karyawan"}
                maxWidth="lg"
            >
                <form onSubmit={submit} className="space-y-4">
                    <Input
                        label="Nama Karyawan"
                        type="text"
                        required
                        value={form.data.name}
                        onChange={(e) => form.setData("name", e.target.value)}
                        errors={form.errors.name}
                        placeholder="Contoh: Fariska"
                    />

                    <div className="flex flex-col gap-2">
                        <FormLabel label="Jenis Pekerjaan" required />
                        <input
                            list="job-type-options"
                            type="text"
                            value={form.data.job_type}
                            onChange={(e) => form.setData("job_type", e.target.value)}
                            className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                            placeholder="Contoh: KASIR, KEBERSIHAN, PARKIR"
                        />
                        <datalist id="job-type-options">
                            {jobTypes.map((type) => (
                                <option key={type} value={type} />
                            ))}
                        </datalist>
                        {form.errors.job_type && (
                            <small className="text-xs text-danger-500 dark:text-danger-400">
                                {form.errors.job_type}
                            </small>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="No. HP"
                            type="text"
                            value={form.data.phone}
                            onChange={(e) => form.setData("phone", e.target.value)}
                            errors={form.errors.phone}
                            placeholder="08xxxxxxxxxx"
                        />
                        <Input
                            label="Urutan Rotasi"
                            type="number"
                            min={0}
                            value={form.data.rotation_order}
                            onChange={(e) => form.setData("rotation_order", e.target.value)}
                            errors={form.errors.rotation_order}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <FormLabel label="Catatan" />
                        <textarea
                            value={form.data.notes}
                            onChange={(e) => form.setData("notes", e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                            placeholder="Catatan tambahan (opsional)"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={Boolean(form.data.is_active)}
                            onChange={(e) => form.setData("is_active", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                        />
                        Karyawan aktif (ikut dirotasi saat generate jadwal)
                    </label>

                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
                        >
                            {form.processing ? "Menyimpan..." : "Simpan"}
                        </button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
