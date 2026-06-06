import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import { Head, router } from "@inertiajs/react";
import {
    IconBike,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconClipboardList,
    IconFilter,
    IconInfoCircle,
    IconLayoutGrid,
    IconList,
    IconSearch,
    IconUser,
    IconX,
} from "@/Utils/icons";
import { useMemo, useState } from "react";

const waiterStatusMeta = {
    ready: {
        label: "Siap Antar",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        description: "Pesanan sudah selesai dari dapur dan menunggu petugas antar atau pelanggan.",
    },
    assigned: {
        label: "Sudah Ditugaskan",
        badge: "bg-primary-100 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300",
        description: "Petugas antar sudah dipilih, tetapi pesanan belum diambil dari dapur.",
    },
    picked_up: {
        label: "Sedang Diantar",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
        description: "Pesanan sudah diambil dari dapur dan sedang menuju pelanggan.",
    },
    delivered: {
        label: "Sudah Diserahkan",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        description: "Pesanan sudah diterima petugas antar atau pelanggan. Ini status akhir layanan.",
    },
};

const defaultFilters = {
    q: "",
    status: "all",
    sort: "ready_oldest",
    per_page: 15,
    view: "list",
};

const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

function compactFilters(filters = {}) {
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined)
    );
}

export default function WaiterIndex({
    allocations = {},
    waiters = [],
    deliveredAllocations = [],
    viewer = {},
    filters = defaultFilters,
    summary = {},
    perPageOptions = [10, 15, 25, 50],
}) {
    const [showGuide, setShowGuide] = useState(false);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(
        Boolean(filters?.q || (filters?.status && filters.status !== "all") || (filters?.sort && filters.sort !== "ready_oldest") || (filters?.per_page && Number(filters.per_page) !== 15))
    );
    const [draftFilters, setDraftFilters] = useState({
        q: filters?.q || "",
        status: filters?.status || "all",
        sort: filters?.sort || "ready_oldest",
        per_page: Number(filters?.per_page || 15),
        view: filters?.view || "list",
    });

    const canManualAssign = viewer?.can_manual_assign === true;
    const isDeliveryUser = viewer?.is_delivery_user === true;
    const viewMode = filters?.view || "list";
    const allocationItems = allocations?.data || [];
    const paginationLinks = allocations?.links || [];
    const allocationMetaText = useMemo(() => {
        if (!allocations?.total) {
            return "Belum ada pesanan aktif pada filter ini.";
        }

        return `Menampilkan ${allocations.from || 0}-${allocations.to || 0} dari ${allocations.total} pesanan aktif.`;
    }, [allocations]);

    const navigateWithFilters = (nextFilters = {}) => {
        router.get(route("waiter-board.index"), compactFilters(nextFilters), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const assignWaiter = (allocationId, waiterId) => {
        router.post(
            route("waiter-board.assign", allocationId),
            { waiter_id: Number(waiterId) },
            { preserveScroll: true }
        );
    };

    const markPickedUp = (allocationId) => {
        router.post(route("waiter-board.pick-up", allocationId), {}, { preserveScroll: true });
    };

    const markDelivered = (allocationId) => {
        router.post(route("waiter-board.deliver", allocationId), {}, { preserveScroll: true });
    };

    const applyAdvancedFilters = () => {
        navigateWithFilters({
            ...draftFilters,
            page: 1,
        });
    };

    const resetFilters = () => {
        const nextFilters = {
            ...defaultFilters,
            view: draftFilters.view || "list",
            page: 1,
        };

        setDraftFilters(nextFilters);
        navigateWithFilters(nextFilters);
    };

    const setViewMode = (view) => {
        const nextFilters = {
            ...filters,
            ...draftFilters,
            view,
            page: 1,
        };

        setDraftFilters((current) => ({ ...current, view }));
        navigateWithFilters(nextFilters);
    };

    const quickSetFilter = (partial) => {
        const nextFilters = {
            ...filters,
            ...partial,
            view: draftFilters.view || filters?.view || "list",
            page: 1,
        };

        setDraftFilters((current) => ({
            ...current,
            ...partial,
            view: partial.view || current.view,
        }));
        navigateWithFilters(nextFilters);
    };

    return (
        <>
            <Head title="Papan Petugas Antar" />
            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Papan Petugas Antar
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Pantau pesanan yang siap diantar sampai benar-benar diterima pelanggan.
                        </p>
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                            {allocationMetaText}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                                viewMode === "list"
                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                        >
                            <IconList size={16} />
                            List
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                                viewMode === "grid"
                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                        >
                            <IconLayoutGrid size={16} />
                            Grid
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => setShowGuide((value) => !value)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <IconInfoCircle size={18} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    Panduan alur penyerahan pesanan
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Buka untuk melihat arti status dan tahapan dari dapur ke pelanggan.
                                </p>
                            </div>
                        </div>
                        {showGuide ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                    </button>
                    {showGuide ? (
                        <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    Alur penyerahan dari dapur ke pelanggan
                                </p>
                                <p className="mt-1">
                                    Setelah dapur menekan `Siap Diantar / Diambil`, pesanan masuk ke papan petugas antar dengan status `Siap Antar`. Status finalnya bukan `Selesai` dapur, tetapi `Sudah Diserahkan` setelah benar-benar sampai ke pelanggan.
                                </p>
                            </div>
                            <div className="grid gap-2 lg:grid-cols-4">
                                {["ready", "assigned", "picked_up", "delivered"].map((statusKey) => (
                                    <div
                                        key={statusKey}
                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40"
                                    >
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {waiterStatusMeta[statusKey].label}
                                        </p>
                                        <p className="mt-1 text-xs">
                                            {waiterStatusMeta[statusKey].description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        ["Siap Antar", Number(summary?.ready || 0)],
                        ["Sudah Ditugaskan", Number(summary?.assigned || 0)],
                        ["Sedang Diantar", Number(summary?.picked_up || 0)],
                    ].map(([label, total]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {label}
                            </p>
                            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                                {total}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: "all", label: "Semua aktif" },
                                { value: "ready", label: "Siap Antar" },
                                { value: "assigned", label: "Ditugaskan" },
                                { value: "picked_up", label: "Sedang Diantar" },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => quickSetFilter({ status: option.value })}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                        (filters?.status || "all") === option.value
                                            ? "bg-primary-600 text-white"
                                            : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAdvancedFilter((current) => !current)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                            <IconFilter size={16} />
                            {showAdvancedFilter ? "Sembunyikan filter" : "Advanced Search"}
                            {showAdvancedFilter ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        </button>
                    </div>

                    {showAdvancedFilter ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_180px_180px_180px_auto]">
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Cari invoice / pelanggan / tenant / item
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <IconSearch size={16} />
                                    </span>
                                    <input
                                        type="text"
                                        value={draftFilters.q}
                                        onChange={(event) =>
                                            setDraftFilters((current) => ({
                                                ...current,
                                                q: event.target.value,
                                            }))
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                applyAdvancedFilters();
                                            }
                                        }}
                                        placeholder="ALOC, INV, pelanggan, tenant, item..."
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Status
                                </label>
                                <select
                                    value={draftFilters.status}
                                    onChange={(event) =>
                                        setDraftFilters((current) => ({
                                            ...current,
                                            status: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="all">Semua aktif</option>
                                    <option value="ready">Siap Antar</option>
                                    <option value="assigned">Sudah Ditugaskan</option>
                                    <option value="picked_up">Sedang Diantar</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Urutan
                                </label>
                                <select
                                    value={draftFilters.sort}
                                    onChange={(event) =>
                                        setDraftFilters((current) => ({
                                            ...current,
                                            sort: event.target.value,
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="ready_oldest">Siap antar terlama</option>
                                    <option value="ready_newest">Siap antar terbaru</option>
                                    <option value="tenant_asc">Tenant A-Z</option>
                                    <option value="customer_asc">Pelanggan A-Z</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Per halaman
                                </label>
                                <select
                                    value={draftFilters.per_page}
                                    onChange={(event) =>
                                        setDraftFilters((current) => ({
                                            ...current,
                                            per_page: Number(event.target.value),
                                        }))
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    {perPageOptions.map((size) => (
                                        <option key={size} value={size}>
                                            {size} baris
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    type="button"
                                    onClick={applyAdvancedFilters}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
                                >
                                    <IconSearch size={16} />
                                    Terapkan
                                </button>
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    <IconX size={16} />
                                    Reset
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className={viewMode === "grid" ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}>
                    {allocationItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            Belum ada pesanan yang cocok dengan filter saat ini.
                        </div>
                    ) : (
                        allocationItems.map((allocation) => (
                            <div
                                key={allocation.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className={`flex gap-4 ${viewMode === "grid" ? "flex-col" : "flex-col xl:flex-row xl:items-start xl:justify-between"}`}>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                                                {allocation.tenant_name}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                {allocation.order_type === "dine_in" ? "Makan di Tempat" : "Bawa Pulang"}
                                            </span>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    waiterStatusMeta[allocation.waiter_status]?.badge || waiterStatusMeta.ready.badge
                                                }`}
                                            >
                                                {waiterStatusMeta[allocation.waiter_status]?.label || allocation.waiter_status}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                {allocation.invoice}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Pelanggan: {allocation.customer_name}
                                            </p>
                                            {allocation.table_name ? (
                                                <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                                                    Meja: {allocation.table_code ? `${allocation.table_code} - ${allocation.table_name}` : allocation.table_name}
                                                </p>
                                            ) : null}
                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                Siap antar: {formatDateTime(allocation.ready_at)}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {waiterStatusMeta[allocation.waiter_status]?.description}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                <IconClipboardList size={14} />
                                                Item Pesanan
                                            </div>
                                            <div className="space-y-2">
                                                {allocation.items.map((item) => (
                                                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-slate-200">
                                                                {item.product_title}
                                                            </p>
                                                            {item.notes ? (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {item.notes}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                            x{item.qty}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`space-y-3 ${viewMode === "grid" ? "" : "w-full xl:max-w-sm"}`}>
                                        {canManualAssign ? (
                                            <div>
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                    Petugas antar
                                                </label>
                                                <select
                                                    value={allocation.waiter?.id || ""}
                                                    onChange={(event) =>
                                                        event.target.value
                                                            ? assignWaiter(allocation.id, event.target.value)
                                                            : null
                                                    }
                                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                >
                                                    <option value="">Pilih petugas antar</option>
                                                    {(allocation.eligible_waiters || waiters).map((waiter) => (
                                                        <option key={waiter.id} value={waiter.id}>
                                                            {waiter.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {(allocation.eligible_waiters || waiters).length === 0 ? (
                                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                                        Tidak ada petugas antar yang melayani dapur ini.
                                                    </p>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-3 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300">
                                                {isDeliveryUser
                                                    ? "Pesanan akan otomatis menjadi tugas Anda saat menekan `Ambil dari Dapur`."
                                                    : "Penugasan petugas antar diatur otomatis dari alur operasional."}
                                            </div>
                                        )}

                                        <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                                            <p className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                                                <IconUser size={16} />
                                                {allocation.waiter?.name ||
                                                    (isDeliveryUser ? "Otomatis ke petugas yang mengambil" : "Belum ditugaskan")}
                                            </p>
                                            {allocation.picked_up_at ? (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Diambil: {formatDateTime(allocation.picked_up_at)}
                                                </p>
                                            ) : null}
                                            {allocation.delivered_at ? (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Diserahkan: {formatDateTime(allocation.delivered_at)}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => markPickedUp(allocation.id)}
                                                disabled={allocation.waiter_status === "picked_up" || allocation.waiter_status === "delivered"}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                                            >
                                                <IconBike size={16} />
                                                Ambil dari Dapur
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => markDelivered(allocation.id)}
                                                disabled={allocation.waiter_status === "delivered"}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                                            >
                                                <IconCheck size={16} />
                                                Sudah Diserahkan
                                            </button>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                            `Ambil dari Dapur` dipakai saat petugas antar sudah membawa pesanan keluar dari dapur. `Sudah Diserahkan` dipakai saat pesanan benar-benar sampai ke pelanggan atau sudah diambil langsung oleh pelanggan.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {allocations?.last_page > 1 ? <Pagination links={paginationLinks} /> : null}

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Riwayat Sudah Diserahkan
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Daftar pesanan yang sudah selesai sampai ke pelanggan.
                            </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                            {deliveredAllocations.length} data terbaru
                        </div>
                    </div>

                    {deliveredAllocations.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            Belum ada pesanan yang sudah diserahkan.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {deliveredAllocations.map((allocation) => (
                                <div
                                    key={allocation.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/30 dark:text-primary-300">
                                                    {allocation.tenant_name}
                                                </span>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${waiterStatusMeta.delivered.badge}`}>
                                                    {waiterStatusMeta.delivered.label}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                                                {allocation.invoice}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Pelanggan: {allocation.customer_name}
                                            </p>
                                            {allocation.table_name ? (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Meja: {allocation.table_code ? `${allocation.table_code} - ${allocation.table_name}` : allocation.table_name}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                            <p>Petugas antar: {allocation.waiter?.name || "-"}</p>
                                            <p>Siap antar: {formatDateTime(allocation.ready_at)}</p>
                                            <p>Diambil: {formatDateTime(allocation.picked_up_at)}</p>
                                            <p>Diserahkan: {formatDateTime(allocation.delivered_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

WaiterIndex.layout = (page) => <DashboardLayout children={page} />;
