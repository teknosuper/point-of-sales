import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconAdjustmentsHorizontal,
    IconCirclePlus,
    IconDatabaseOff,
    IconLayoutGrid,
    IconList,
    IconMapPin,
    IconPencilCog,
    IconPhone,
    IconSearch,
    IconTrash,
    IconUser,
    IconX,
} from "@tabler/icons-react";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";

const defaultFilters = {
    search: "",
    member_status: "",
    loyalty_tier: "",
    sort: "latest",
    per_page: "10",
};

const castFilterValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

function CustomerCard({ customer, canUpdate, canDelete }) {
    return (
        <div className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
            <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-lg font-semibold text-white">
                        {customer.name?.charAt(0)?.toUpperCase() || "C"}
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            <Link
                                href={route("customers.show", customer.id)}
                                className="hover:text-primary-600"
                            >
                                {customer.name}
                            </Link>
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                            <span className="inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                {customer.is_loyalty_member ? customer.loyalty_tier : "non-member"}
                            </span>
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {customer.loyalty_points || 0} poin
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4 space-y-2">
                {customer.no_telp ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <IconPhone size={16} />
                        <span>{customer.no_telp}</span>
                    </div>
                ) : null}
                {customer.address ? (
                    <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <IconMapPin size={16} className="mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{customer.address}</span>
                    </div>
                ) : null}
            </div>

            {(canUpdate || canDelete) ? (
                <div className="flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {canUpdate ? (
                        <Link
                            href={route("customers.edit", customer.id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-warning-100 py-2 text-sm font-medium text-warning-600 transition-colors hover:bg-warning-200 dark:bg-warning-900/50 dark:text-warning-400"
                        >
                            <IconPencilCog size={16} />
                            <span>Edit</span>
                        </Link>
                    ) : null}
                    {canDelete ? (
                        <Button
                            type="delete"
                            icon={<IconTrash size={16} />}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger-100 py-2 text-sm font-medium text-danger-600 hover:bg-danger-200 dark:bg-danger-900/50 dark:text-danger-400"
                            url={route("customers.destroy", customer.id)}
                            label="Hapus"
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default function Index({ customers, filters = {}, meta = {} }) {
    const { can } = useAuthorization();
    const [viewMode, setViewMode] = useState("grid");
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castFilterValue(filters?.search),
        member_status: castFilterValue(filters?.member_status),
        loyalty_tier: castFilterValue(filters?.loyalty_tier),
        sort: castFilterValue(filters?.sort, "latest"),
        per_page: castFilterValue(filters?.per_page, "10"),
    });

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castFilterValue(filters?.search),
            member_status: castFilterValue(filters?.member_status),
            loyalty_tier: castFilterValue(filters?.loyalty_tier),
            sort: castFilterValue(filters?.sort, "latest"),
            per_page: castFilterValue(filters?.per_page, "10"),
        });
    }, [filters]);

    const canCreateCustomers = can("customers-create");
    const canEditCustomers = can("customers-edit");
    const canDeleteCustomers = can("customers-delete");
    const tierOptions = meta?.tier_options ?? {};
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                filterData.search ||
                    filterData.member_status ||
                    filterData.loyalty_tier ||
                    filterData.sort !== "latest" ||
                    filterData.per_page !== "10"
            ),
        [filterData]
    );

    const handleChange = (key, value) => {
        setFilterData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("customers.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("customers.index"), defaultFilters, {
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
        router.get(route("customers.index"), nextFilters, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const rows = customers?.data ?? [];
    const total = Number(customers?.total ?? rows.length ?? 0);
    const from = Number(customers?.from ?? 0);
    const to = Number(customers?.to ?? 0);
    const currentPage = Number(customers?.current_page ?? 1);
    const perPage = Number(customers?.per_page ?? 10);

    return (
        <>
            <Head title="Pelanggan" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Pelanggan
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Cek dan kelola data pelanggan yang sudah masuk.
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
                            {showFilters ? "Sembunyikan filter" : "Buka filter"}
                        </button>
                        {canCreateCustomers ? (
                            <Button
                                type="link"
                                icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                                className="bg-primary-500 text-white shadow-lg shadow-primary-500/30 hover:bg-primary-600"
                                label="Tambah Pelanggan"
                                href={route("customers.create")}
                            />
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
                                            placeholder="Nama, kode member, telepon..."
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                            <IconSearch size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status Member
                                    </label>
                                    <select
                                        value={filterData.member_status}
                                        onChange={(event) =>
                                            handleChange("member_status", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua</option>
                                        <option value="member">Member</option>
                                        <option value="non_member">Non-member</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Loyalty Tier
                                    </label>
                                    <select
                                        value={filterData.loyalty_tier}
                                        onChange={(event) =>
                                            handleChange("loyalty_tier", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua tier</option>
                                        {Object.entries(tierOptions).map(([key, label]) => (
                                            <option key={key} value={key}>
                                                {label}
                                            </option>
                                        ))}
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
                                        <option value="latest">Terbaru</option>
                                        <option value="oldest">Terlama</option>
                                        <option value="name_asc">Nama A-Z</option>
                                        <option value="name_desc">Nama Z-A</option>
                                        <option value="points_high">Poin tertinggi</option>
                                        <option value="points_low">Poin terendah</option>
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

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Halaman {currentPage} • {rows.length} tampil • total {total}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
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

                        <button
                            onClick={() => setViewMode("grid")}
                            className={`rounded-lg p-2.5 transition-colors ${
                                viewMode === "grid"
                                    ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            title="Grid View"
                            type="button"
                        >
                            <IconLayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`rounded-lg p-2.5 transition-colors ${
                                viewMode === "list"
                                    ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            title="List View"
                            type="button"
                        >
                            <IconList size={20} />
                        </button>
                    </div>
                </div>

                {rows.length > 0 ? (
                    viewMode === "grid" ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {rows.map((customer) => (
                                <CustomerCard
                                    key={customer.id}
                                    customer={customer}
                                    canUpdate={canEditCustomers}
                                    canDelete={canDeleteCustomers}
                                />
                            ))}
                        </div>
                    ) : (
                        <Table.Card title="Data Pelanggan">
                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th className="w-10">No</Table.Th>
                                        <Table.Th>Pelanggan</Table.Th>
                                        <Table.Th>Loyalty</Table.Th>
                                        <Table.Th>No. Telepon</Table.Th>
                                        <Table.Th>Alamat</Table.Th>
                                        <Table.Th></Table.Th>
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {rows.map((customer, i) => (
                                        <tr
                                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            key={customer.id}
                                        >
                                            <Table.Td className="text-center">
                                                {i + 1 + (currentPage - 1) * perPage}
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-semibold text-white">
                                                        {customer.name?.charAt(0)?.toUpperCase() || "C"}
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        <Link
                                                            href={route("customers.show", customer.id)}
                                                            className="hover:text-primary-600"
                                                        >
                                                            {customer.name}
                                                        </Link>
                                                    </p>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                                                        {customer.is_loyalty_member
                                                            ? customer.loyalty_tier
                                                            : "non-member"}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {customer.loyalty_points || 0} poin
                                                    </span>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                                    {customer.no_telp || "-"}
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {customer.address || "-"}
                                                </p>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex gap-2">
                                                    {canEditCustomers ? (
                                                        <Button
                                                            type="edit"
                                                            icon={<IconPencilCog size={16} strokeWidth={1.5} />}
                                                            className="border border-warning-200 bg-warning-100 text-warning-600 hover:bg-warning-200 dark:border-warning-800 dark:bg-warning-900/50 dark:text-warning-400"
                                                            href={route("customers.edit", customer.id)}
                                                        />
                                                    ) : null}
                                                    {canDeleteCustomers ? (
                                                        <Button
                                                            type="delete"
                                                            icon={<IconTrash size={16} strokeWidth={1.5} />}
                                                            className="border border-danger-200 bg-danger-100 text-danger-600 hover:bg-danger-200 dark:border-danger-800 dark:bg-danger-900/50 dark:text-danger-400"
                                                            url={route("customers.destroy", customer.id)}
                                                        />
                                                    ) : null}
                                                </div>
                                            </Table.Td>
                                        </tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.Card>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <IconDatabaseOff size={32} className="text-slate-400" strokeWidth={1.5} />
                        </div>
                        <h3 className="mb-1 text-lg font-medium text-slate-800 dark:text-slate-200">
                            Belum Ada Pelanggan
                        </h3>
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            Tambahkan pelanggan pertama Anda.
                        </p>
                        {canCreateCustomers ? (
                            <Button
                                type="link"
                                icon={<IconCirclePlus size={18} />}
                                className="bg-primary-500 text-white hover:bg-primary-600"
                                label="Buat pelanggan"
                                href={route("customers.create")}
                            />
                        ) : null}
                    </div>
                )}

                {customers.last_page !== 1 ? <Pagination links={customers.links} /> : null}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
