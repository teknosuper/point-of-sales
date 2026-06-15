import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconAdjustmentsHorizontal,
    IconCategory,
    IconChevronDown,
    IconChevronUp,
    IconCirclePlus,
    IconDatabaseOff,
    IconLayoutGrid,
    IconList,
    IconPencilCog,
    IconPhoto,
    IconSearch,
    IconTrash,
    IconX,
} from "@/Utils/icons";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import {
    categoryPlaceholderDataUri,
    resolveCategoryImageSrc,
    setFallbackImage,
} from "@/Utils/imagePlaceholder";

function CategoryCard({ category, canUpdate, canDelete }) {
    const [imageSrc, setImageSrc] = useState(
        resolveCategoryImageSrc(category.image, category.name)
    );

    useEffect(() => {
        setImageSrc(resolveCategoryImageSrc(category.image, category.name));
    }, [category.image, category.name]);

    return (
        <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
            <div className="relative aspect-[3/2] overflow-hidden bg-slate-100 dark:bg-slate-800">
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt={category.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={() =>
                            setImageSrc(categoryPlaceholderDataUri(category.name))
                        }
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <IconCategory
                            size={48}
                            className="text-slate-300 dark:text-slate-600"
                            strokeWidth={1}
                        />
                    </div>
                )}

                {(canUpdate || canDelete) && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/0 opacity-0 transition-all group-hover:bg-slate-900/40 group-hover:opacity-100">
                        {canUpdate && (
                            <Link
                                href={route("categories.edit", category.id)}
                                className="rounded-xl bg-white p-2.5 text-warning-600 shadow-lg transition-colors hover:bg-warning-50"
                            >
                                <IconPencilCog size={18} />
                            </Link>
                        )}
                        {canDelete && (
                            <Button
                                type="delete"
                                icon={<IconTrash size={18} />}
                                className="rounded-xl bg-white p-2.5 text-danger-600 shadow-lg hover:bg-danger-50"
                                url={route("categories.destroy", category.id)}
                            />
                        )}
                    </div>
                )}
            </div>

            <div className="p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                        {category.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <IconPhoto size={12} />
                        {category.image ? "Ada gambar" : "Tanpa gambar"}
                    </span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {category.description || "-"}
                </p>
                <div className="mt-3">
                    <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                        {category.tenant_outlet
                            ? `Tenant: ${category.tenant_outlet.name}`
                            : "Global / Owner"}
                    </span>
                </div>
            </div>
        </div>
    );
}

const defaultFilters = {
    search: "",
    tenant_outlet_id: "",
    has_image: "",
    sort: "latest",
    per_page: "10",
};

const castFilterValue = (value, fallback = "") =>
    value === null || value === undefined ? fallback : String(value);

export default function Index({ categories, filters = {}, meta = {} }) {
    const { can } = useAuthorization();
    const [viewMode, setViewMode] = useState("grid");
    const [showFilters, setShowFilters] = useState(
        Boolean(
            filters?.search ||
                filters?.tenant_outlet_id ||
                filters?.has_image ||
                filters?.sort ||
                filters?.per_page
        )
    );
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        search: castFilterValue(filters?.search),
        tenant_outlet_id: castFilterValue(filters?.tenant_outlet_id),
        has_image: castFilterValue(filters?.has_image),
        sort: castFilterValue(filters?.sort, "latest"),
        per_page: castFilterValue(filters?.per_page, "10"),
    });

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castFilterValue(filters?.search),
            tenant_outlet_id: castFilterValue(filters?.tenant_outlet_id),
            has_image: castFilterValue(filters?.has_image),
            sort: castFilterValue(filters?.sort, "latest"),
            per_page: castFilterValue(filters?.per_page, "10"),
        });
    }, [filters]);

    const canCreateCategories = can("categories-create");
    const canEditCategories = can("categories-edit");
    const canDeleteCategories = can("categories-delete");

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                filterData.search ||
                    filterData.tenant_outlet_id ||
                    filterData.has_image ||
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
        router.get(route("categories.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("categories.index"), defaultFilters, {
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
        router.get(route("categories.index"), nextFilters, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const rows = categories?.data ?? [];
    const total = Number(categories?.total ?? rows.length ?? 0);
    const from = Number(categories?.from ?? 0);
    const to = Number(categories?.to ?? 0);
    const currentPage = Number(categories?.current_page ?? 1);
    const perPage = Number(categories?.per_page ?? 10);
    const perPageOptions = meta?.per_page_options ?? [10, 25, 50, 100];
    const tenantOutlets = meta?.tenantOutlets ?? [];

    return (
        <>
            <Head title="Kategori" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Kategori
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Lihat dan kelola daftar kategori produk.
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
                            {showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            {showFilters ? "Sembunyikan filter" : "Buka filter"}
                        </button>

                        {canCreateCategories && (
                            <Button
                                type="link"
                                icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                                className="bg-primary-500 text-white shadow-lg shadow-primary-500/30 hover:bg-primary-600"
                                label="Tambah Kategori"
                                href={route("categories.create")}
                            />
                        )}
                    </div>
                </div>

                {showFilters && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                                            placeholder="Nama atau deskripsi kategori..."
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                                            <IconSearch size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tenant Outlet
                                    </label>
                                    <select
                                        value={filterData.tenant_outlet_id}
                                        onChange={(event) =>
                                            handleChange("tenant_outlet_id", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua kategori</option>
                                        <option value="global">Global / Owner</option>
                                        {tenantOutlets.map((outlet) => (
                                            <option key={outlet.id} value={String(outlet.id)}>
                                                {outlet.code} - {outlet.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Gambar
                                    </label>
                                    <select
                                        value={filterData.has_image}
                                        onChange={(event) =>
                                            handleChange("has_image", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua</option>
                                        <option value="yes">Ada gambar</option>
                                        <option value="no">Tanpa gambar</option>
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
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Halaman {currentPage} • {rows.length} row tampil • total {total} data
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

                        <div className="flex items-center gap-2">
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
                </div>

                {rows.length > 0 ? (
                    viewMode === "grid" ? (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {rows.map((category) => (
                                <CategoryCard
                                    key={category.id}
                                    category={category}
                                    canUpdate={canEditCategories}
                                    canDelete={canDeleteCategories}
                                />
                            ))}
                        </div>
                    ) : (
                        <Table.Card title="Data Kategori">
                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th className="w-10">No</Table.Th>
                                        <Table.Th>Kategori</Table.Th>
                                        <Table.Th>Tenant</Table.Th>
                                        <Table.Th>Deskripsi</Table.Th>
                                        <Table.Th className="w-40">Gambar</Table.Th>
                                        <Table.Th></Table.Th>
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {rows.map((category, i) => (
                                        <tr
                                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            key={category.id}
                                        >
                                            <Table.Td className="text-center">
                                                {i + 1 + (currentPage - 1) * perPage}
                                            </Table.Td>
                                            <Table.Td>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                    {category.name}
                                                </p>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                    {category.tenant_outlet?.name || "Global / Owner"}
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                                                    {category.description || "-"}
                                                </p>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                                                        {category.image ? (
                                                            <img
                                                                src={category.image}
                                                                alt={category.name}
                                                                className="h-full w-full object-cover"
                                                                onError={(event) =>
                                                                    setFallbackImage(
                                                                        event,
                                                                        categoryPlaceholderDataUri(
                                                                            category.name
                                                                        )
                                                                    )
                                                                }
                                                            />
                                                        ) : (
                                                            <IconCategory
                                                                size={20}
                                                                className="text-slate-400"
                                                            />
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                                        {category.image
                                                            ? "Ada gambar"
                                                            : "Tanpa gambar"}
                                                    </span>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex gap-2">
                                                    {canEditCategories && (
                                                        <Button
                                                            type="edit"
                                                            icon={
                                                                <IconPencilCog
                                                                    size={16}
                                                                    strokeWidth={1.5}
                                                                />
                                                            }
                                                            className="border border-warning-200 bg-warning-100 text-warning-600 hover:bg-warning-200 dark:border-warning-800 dark:bg-warning-900/50 dark:text-warning-400"
                                                            href={route(
                                                                "categories.edit",
                                                                category.id
                                                            )}
                                                        />
                                                    )}
                                                    {canDeleteCategories && (
                                                        <Button
                                                            type="delete"
                                                            icon={
                                                                <IconTrash
                                                                    size={16}
                                                                    strokeWidth={1.5}
                                                                />
                                                            }
                                                            className="border border-danger-200 bg-danger-100 text-danger-600 hover:bg-danger-200 dark:border-danger-800 dark:bg-danger-900/50 dark:text-danger-400"
                                                            url={route(
                                                                "categories.destroy",
                                                                category.id
                                                            )}
                                                        />
                                                    )}
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
                            <IconDatabaseOff
                                size={32}
                                className="text-slate-400"
                                strokeWidth={1.5}
                            />
                        </div>
                        <h3 className="mb-1 text-lg font-medium text-slate-800 dark:text-slate-200">
                            Belum Ada Kategori
                        </h3>
                        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            Tambahkan kategori pertama Anda.
                        </p>
                        {canCreateCategories && (
                            <Button
                                type="link"
                                icon={<IconCirclePlus size={18} />}
                                className="bg-primary-500 text-white hover:bg-primary-600"
                                label="Tambah Kategori"
                                href={route("categories.create")}
                            />
                        )}
                    </div>
                )}

                {categories.last_page !== 1 && <Pagination links={categories.links} />}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
