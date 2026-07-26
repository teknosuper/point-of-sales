import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Checkbox from "@/Components/Dashboard/Checkbox";
import Modal from "@/Components/Dashboard/Modal";
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
    IconFolder,
} from "@/Utils/icons";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import {
    categoryPlaceholderDataUri,
    resolveCategoryImageSrc,
    setFallbackImage,
} from "@/Utils/imagePlaceholder";

function CategoryCard({ category, variant = 'default', canUpdate, canDelete, isSelected, canSelect, onToggle }) {
    const [imageSrc, setImageSrc] = useState(
        resolveCategoryImageSrc(category.image, category.name)
    );

    useEffect(() => {
        setImageSrc(resolveCategoryImageSrc(category.image, category.name));
    }, [category.image, category.name]);

    const isMain = !category.parent_id && !category.tenant_outlet_id;
    const isTenant = !!category.tenant_outlet_id;
    const isChild = variant === 'child';
    const isOther = variant === 'other';

    const borderClass = isSelected
        ? "border-primary-500 ring-2 ring-primary-500/20"
        : isChild
            ? "border-slate-200 dark:border-slate-800"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700";

    const headerAccent = isOther
        ? "border-amber-400 dark:border-amber-500"
        : isChild
            ? "border-slate-300 dark:border-slate-600"
            : "border-primary-500 dark:border-primary-400";

    return (
        <div
            className={`group overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:shadow-lg dark:bg-slate-900 ${borderClass}`}
        >
            <div className={`relative aspect-[3/2] overflow-hidden bg-slate-100 dark:bg-slate-800 border-b ${headerAccent}`}>
                {canSelect ? (
                    <div className="absolute left-2 top-2 z-10">
                        <Checkbox
                            checked={isSelected}
                            onChange={() => onToggle(category)}
                            className="h-5 w-5 cursor-pointer rounded border-2 border-white bg-white/80 text-primary-500 shadow-sm"
                        />
                    </div>
                ) : null}

                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt={category.name}
                        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${canSelect ? "pl-8" : ""}`}
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

                {(canUpdate || canDelete) && !canSelect && (
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
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            {category.name}
                        </h3>
                        {isMain && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                Kategori Utama
                            </span>
                        )}
                        {isChild && category.parent?.name && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                Sub dari {category.parent.name}
                            </span>
                        )}
                        {isOther && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                Tanpa Induk
                            </span>
                        )}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <IconPhoto size={12} />
                        {category.image ? "Ada gambar" : "Tanpa gambar"}
                    </span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {category.description || "-"}
                </p>
                <div className="mt-3 space-y-1.5">
                    <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                        {isTenant
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

export default function Index({ categories, allCategories = [], filters = {}, meta = {} }) {
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

    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
    const [bulkParentId, setBulkParentId] = useState("");

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            search: castFilterValue(filters?.search),
            tenant_outlet_id: castFilterValue(filters?.tenant_outlet_id),
            has_image: castFilterValue(filters?.has_image),
            sort: castFilterValue(filters?.sort, "latest"),
            per_page: castFilterValue(filters?.per_page, "10"),
        });
        setSelectedCategoryIds([]);
        setBulkParentId("");
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

    const toggleCategorySelection = (category) => {
        setSelectedCategoryIds((prev) => {
            const exists = prev.some((id) => id === category.id);
            return exists
                ? prev.filter((id) => id !== category.id)
                : [...prev, category.id];
        });
    };

    const isCategorySelected = (categoryId) =>
        selectedCategoryIds.some((id) => id === categoryId);

    const toggleSelectAllVisible = () => {
        const visibleCategories = viewMode === "list"
            ? rows
            : allCategories;
        const visibleIds = visibleCategories.map((category) => category.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) =>
            selectedCategoryIds.includes(id)
        );

        if (allSelected) {
            setSelectedCategoryIds((prev) =>
                prev.filter((id) => !visibleIds.includes(id))
            );
            return;
        }

        setSelectedCategoryIds((prev) => {
            const next = new Set([...prev, ...visibleIds]);
            return Array.from(next);
        });
    };

    const clearSelection = () => setSelectedCategoryIds([]);

    const canSelect = canEditCategories || canDeleteCategories;

    const handleBulkMove = () => {
        if (!bulkParentId) {
            return;
        }

        router.post(
            route("categories.bulk-move"),
            {
                category_ids: selectedCategoryIds,
                parent_id: bulkParentId ? Number(bulkParentId) : null,
            },
            {
                onSuccess: () => {
                    setShowBulkMoveModal(false);
                    setBulkParentId("");
                    clearSelection();
                },
                onError: () => {
                    setShowBulkMoveModal(false);
                },
            }
        );
    };

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

    const categoryTree = useMemo(() => {
        if (!Array.isArray(allCategories) || !allCategories.length) {
            return [];
        }

        const mainCategories = allCategories.filter(
            (category) => !category.parent_id && !category.tenant_outlet_id
        );
        const mainCategoryIds = new Set(mainCategories.map((category) => category.id));

        const roots = mainCategories.map((category) => ({
            ...category,
            children: [],
        }));
        const others = [];

        allCategories.forEach((category) => {
            if (category.parent_id && mainCategoryIds.has(category.parent_id)) {
                const parent = roots.find((item) => item.id === category.parent_id);
                if (parent) {
                    parent.children.push(category);
                }
            } else if (category.parent_id && !mainCategoryIds.has(category.parent_id)) {
                others.push(category);
            } else if (!category.parent_id && category.tenant_outlet_id) {
                others.push(category);
            }
        });

        if (others.length > 0) {
            roots.push({
                id: 'other',
                name: 'Lainnya',
                isOther: true,
                children: others,
            });
        }

        return roots;
    }, [allCategories]);

    const isMainCategory = (category) => !category.parent_id && !category.tenant_outlet_id;
    const isTenantCategory = (category) => !!category.tenant_outlet_id;

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
                    <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                        <span>
                            {viewMode === "grid"
                                ? categoryTree.length > 0
                                    ? `${categoryTree.length} grup kategori`
                                    : `${rows.length} kategori`
                                : `Halaman ${currentPage} • ${rows.length} row tampil • total ${total} data`}
                        </span>
                        {canSelect ? (
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={
                                        allCategories.length > 0 &&
                                        allCategories.every((category) =>
                                            selectedCategoryIds.includes(category.id)
                                        )
                                    }
                                    onChange={toggleSelectAllVisible}
                                    className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                />
                                <span>Pilih semua yang tampil</span>
                            </label>
                        ) : null}
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

                        {selectedCategoryIds.length > 0 && canEditCategories && (
                            <Button
                                type="bulk"
                                icon={<IconFolder size={18} />}
                                className="bg-warning-500 hover:bg-warning-600 text-white"
                                label={`Pindah (${selectedCategoryIds.length})`}
                                onClick={() => setShowBulkMoveModal(true)}
                            />
                        )}
                    </div>
                </div>

                {selectedCategoryIds.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-900/40 dark:bg-primary-950/20">
                        <p className="text-sm font-medium text-primary-900 dark:text-primary-100">
                            {selectedCategoryIds.length} kategori terpilih
                        </p>
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <IconX size={16} />
                            Kosongkan Pilihan
                        </button>
                    </div>
                ) : null}

                {viewMode === "grid" && categoryTree.length > 0 ? (
                    <div className="space-y-10">
                        {categoryTree.map((parent) => (
                            <div key={parent.id} className="space-y-4">
                                {parent.isOther ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                        <div className="flex items-center gap-2">
                                            <IconDatabaseOff size={18} className="text-amber-600 dark:text-amber-400" />
                                            <div>
                                                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                                    Kategori Tanpa Induk
                                                </p>
                                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                                    Pilih kategori di bawah ini lalu pindahkan ke Kategori Utama yang sesuai.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={toggleSelectAllVisible}
                                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
                                        >
                                            Pilih Semua
                                        </button>
                                    </div>
                                ) : (
                                    <div className="max-w-xs">
                                        <CategoryCard
                                            category={parent}
                                            variant="parent"
                                            canUpdate={canEditCategories}
                                            canDelete={canDeleteCategories}
                                            isSelected={isCategorySelected(parent.id)}
                                            canSelect={canSelect}
                                            onToggle={toggleCategorySelection}
                                        />
                                    </div>
                                )}
                                {parent.children?.length > 0 && (
                                    <div className="ml-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                        {parent.children.map((child) => (
                                            <CategoryCard
                                                key={child.id}
                                                category={child}
                                                variant={parent.isOther ? 'other' : 'child'}
                                                canUpdate={canEditCategories}
                                                canDelete={canDeleteCategories}
                                                isSelected={isCategorySelected(child.id)}
                                                canSelect={canSelect}
                                                onToggle={toggleCategorySelection}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : viewMode === "grid" && rows.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {rows.map((category) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                variant={isMainCategory(category) ? 'parent' : 'child'}
                                canUpdate={canEditCategories}
                                canDelete={canDeleteCategories}
                                isSelected={isCategorySelected(category.id)}
                                canSelect={canSelect}
                                onToggle={toggleCategorySelection}
                            />
                        ))}
                    </div>
                ) : rows.length > 0 ? (
                        <Table.Card title="Data Kategori">
                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th className="w-10">
                                            {canSelect ? (
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        rows.length > 0 &&
                                                        rows.every((category) =>
                                                            selectedCategoryIds.includes(category.id)
                                                        )
                                                    }
                                                    onChange={toggleSelectAllVisible}
                                                    className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                                />
                                            ) : null}
                                        </Table.Th>
                                        <Table.Th className="w-10">No</Table.Th>
                                        <Table.Th>Kategori</Table.Th>
                                        <Table.Th>Kategori Utama</Table.Th>
                                        <Table.Th>Tenant</Table.Th>
                                        <Table.Th>Deskripsi</Table.Th>
                                        <Table.Th className="w-40">Gambar</Table.Th>
                                        <Table.Th></Table.Th>
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {rows.map((category, i) => (
                                        <tr
                                            className={`transition-colors ${
                                                isCategorySelected(category.id)
                                                    ? "bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/30 dark:hover:bg-primary-900/20"
                                                    : isMainCategory(category)
                                                        ? "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50"
                                                        : "bg-slate-50/60 hover:bg-slate-100 dark:bg-slate-800/30 dark:hover:bg-slate-800/60"
                                            }`}
                                            key={category.id}
                                        >
                                            <Table.Td className="text-center">
                                                {canSelect ? (
                                                    <Checkbox
                                                        checked={isCategorySelected(category.id)}
                                                        onChange={() => toggleCategorySelection(category)}
                                                        className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                                    />
                                                ) : null}
                                            </Table.Td>
                                            <Table.Td className="text-center">
                                                {i + 1 + (currentPage - 1) * perPage}
                                            </Table.Td>
                                            <Table.Td>
                                                <div className={`flex items-center gap-2 ${category.parent_id ? 'ml-4 border-l-2 border-slate-300 pl-3 dark:border-slate-600' : ''}`}>
                                                    {category.parent_id && (
                                                        <span className="text-slate-400">└</span>
                                                    )}
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                                {category.name}
                                                            </p>
                                                            {isMainCategory(category) && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                                    Kategori Utama
                                                                </span>
                                                            )}
                                                        </div>
                                                        {category.parent?.name && (
                                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                                Induk: {category.parent.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                                    {category.parent?.name || "-"}
                                                </span>
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

                {viewMode === "list" && categories.last_page !== 1 && (
                    <Pagination links={categories.links} />
                )}

                <Modal
                    show={showBulkMoveModal}
                    title={`Pindah ${selectedCategoryIds.length} Kategori ke Induk Baru`}
                    maxWidth="lg"
                    onClose={() => {
                        setShowBulkMoveModal(false);
                        setBulkParentId("");
                    }}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Pilih kategori utama sebagai induk baru untuk {selectedCategoryIds.length} kategori yang dipilih. Jika dikosongkan, kategori akan dipindah ke grup "Tanpa Induk".
                        </p>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Kategori terpilih
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {selectedCategoryIds.map((id) => {
                                    const cat = allCategories.find((c) => c.id === id);
                                    if (!cat) return null;
                                    return (
                                        <span
                                            key={id}
                                            className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
                                        >
                                            {cat.name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Kategori Induk Baru
                            </label>
                            <select
                                value={bulkParentId}
                                onChange={(event) =>
                                    setBulkParentId(event.target.value)
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">Tanpa induk (Lainnya)</option>
                                {categoryTree
                                    .filter((root) => !root.isOther)
                                    .map((root) => (
                                        <option key={root.id} value={String(root.id)}>
                                            {root.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBulkMoveModal(false);
                                    setBulkParentId("");
                                }}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Batal
                            </button>
                            <Button
                                type="button"
                                icon={<IconFolder size={18} />}
                                className="bg-warning-500 hover:bg-warning-600 text-white"
                                label={`Pindah ${selectedCategoryIds.length} Kategori`}
                                onClick={handleBulkMove}
                            />
                        </div>
                    </div>
                </Modal>
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
