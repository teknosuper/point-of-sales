// Modal Antrian Print POS (daftar print job + cetak ulang).
// Menampilkan status antrean printer agar kasir tahu kenapa struk tidak tercetak.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
    IconX,
    IconSearch,
    IconRefresh,
    IconPrinter,
    IconLoader2,
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconChevronUp,
    IconClock,
    IconCheck,
    IconAlertTriangle,
    IconList,
} from "@/Utils/icons";
import toast from "react-hot-toast";

const STATUS_META = {
    queued: {
        label: "Menunggu",
        className:
            "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    },
    processing: {
        label: "Diproses",
        className:
            "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    },
    success: {
        label: "Tercetak",
        className:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    failed: {
        label: "Gagal",
        className:
            "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    },
    cancelled: {
        label: "Dibatalkan",
        className:
            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
};

const JOB_TYPE_OPTIONS = [
    ["", "Semua jenis"],
    ["receipt", "Struk Kasir"],
    ["kitchen_ticket", "Tiket Dapur"],
    ["parking_ticket", "Karcis Parkir"],
];

const STATUS_OPTIONS = [
    ["", "Semua status"],
    ["queued", "Menunggu"],
    ["processing", "Diproses"],
    ["success", "Tercetak"],
    ["failed", "Gagal"],
    ["cancelled", "Dibatalkan"],
];

const formatTime = (iso) => {
    if (!iso) {
        return "-";
    }

    const date = new Date(iso);

    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function PrintJobsModal({
    open,
    onClose,
    outletId,
    onRequeue,
    requeueingId,
}) {
    const [filters, setFilters] = useState({
        q: "",
        job_type: "",
        status: "",
        start_date: "",
        end_date: "",
        per_page: 15,
        page: 1,
    });
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [data, setData] = useState({ data: [], meta: null, summary: null });
    const [isLoading, setIsLoading] = useState(false);

    const updateFilter = useCallback((key, value) => {
        setFilters((current) => ({
            ...current,
            [key]: value,
            ...(key !== "page" && key !== "per_page" ? { page: 1 } : {}),
        }));
    }, []);

    const loadJobs = useCallback(async (nextFilters) => {
        if (!open) {
            return;
        }

        setIsLoading(true);

        try {
            const params = new URLSearchParams();
            const active = {
                ...nextFilters,
                outlet_id: outletId || undefined,
            };

            Object.entries(active).forEach(([key, value]) => {
                if (value !== "" && value !== null && value !== undefined) {
                    params.set(key, String(value));
                }
            });

            const response = await axios.get(
                `${route("transactions.print-jobs")}?${params.toString()}`
            );

            setData({
                data: response.data?.data || [],
                meta: response.data?.meta || null,
                summary: response.data?.summary || null,
            });
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Gagal memuat antrean print."
            );
        } finally {
            setIsLoading(false);
        }
    }, [open, outletId]);

    useEffect(() => {
        if (open) {
            loadJobs(filters);
        }
    }, [open, filters, loadJobs]);

    const resetFilters = () => {
        setFilters({
            q: "",
            job_type: "",
            status: "",
            start_date: "",
            end_date: "",
            per_page: 15,
            page: 1,
        });
    };

    const hasActiveFilters =
        filters.q !== "" ||
        filters.job_type !== "" ||
        filters.status !== "" ||
        filters.start_date !== "" ||
        filters.end_date !== "";

    if (!open) {
        return null;
    }

    const meta = data.meta || {};
    const summary = data.summary || {};
    const summaryCards = [
        {
            label: "Menunggu",
            value: summary.queued ?? 0,
            className: "text-amber-600 dark:text-amber-300",
        },
        {
            label: "Diproses",
            value: summary.processing ?? 0,
            className: "text-blue-600 dark:text-blue-300",
        },
        {
            label: "Gagal",
            value: summary.failed ?? 0,
            className: "text-rose-600 dark:text-rose-300",
        },
        {
            label: "Tercetak",
            value: summary.success ?? 0,
            className: "text-emerald-600 dark:text-emerald-300",
        },
    ];

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
                            Utilitas Kasir
                        </p>
                        <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                            <IconPrinter size={18} />
                            Antrian Print
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                            Pantau status cetak struk, tiket dapur, dan karcis parkir.
                            Cek apakah job masuk antrean atau gagal dicetak.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-4 sm:px-5">
                    {summaryCards.map((card) => (
                        <div
                            key={card.label}
                            className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {card.label}
                            </p>
                            <p
                                className={`mt-1 text-xl font-bold ${card.className}`}
                            >
                                {card.value}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                            <IconSearch
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                value={filters.q}
                                onChange={(event) =>
                                    updateFilter("q", event.target.value)
                                }
                                placeholder="Cari invoice, tiket, atau ID job..."
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            />
                        </div>
                        <select
                            value={filters.job_type}
                            onChange={(event) =>
                                updateFilter("job_type", event.target.value)
                            }
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            {JOB_TYPE_OPTIONS.map(([value, label]) => (
                                <option key={value || "all"} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filters.status}
                            onChange={(event) =>
                                updateFilter("status", event.target.value)
                            }
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            {STATUS_OPTIONS.map(([value, label]) => (
                                <option key={value || "all"} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() =>
                                setIsFilterExpanded((current) => !current)
                            }
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            Filter
                            {isFilterExpanded ? (
                                <IconChevronUp size={14} />
                            ) : (
                                <IconChevronDown size={14} />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={resetFilters}
                            disabled={!hasActiveFilters}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconRefresh size={14} />
                            Reset
                        </button>
                    </div>

                    {isFilterExpanded && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <input
                                type="date"
                                value={filters.start_date}
                                onChange={(event) =>
                                    updateFilter(
                                        "start_date",
                                        event.target.value
                                    )
                                }
                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            />
                            <input
                                type="date"
                                value={filters.end_date}
                                onChange={(event) =>
                                    updateFilter(
                                        "end_date",
                                        event.target.value
                                    )
                                }
                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            />
                            <select
                                value={filters.per_page}
                                onChange={(event) =>
                                    updateFilter(
                                        "per_page",
                                        Number(event.target.value)
                                    )
                                }
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                {[10, 15, 20, 30, 50].map((option) => (
                                    <option key={option} value={option}>
                                        {option}/hal
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{meta.total || 0} job</span>
                        {isLoading ? (
                            <span className="inline-flex items-center gap-1">
                                <IconLoader2
                                    size={12}
                                    className="animate-spin"
                                />
                                Memuat...
                            </span>
                        ) : meta.from ? (
                            <span>
                                {meta.from}-{meta.to}
                            </span>
                        ) : (
                            <span>0 hasil</span>
                        )}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                    {data.data.length > 0 ? (
                        <div className="space-y-2">
                            {data.data.map((job) => {
                                const statusMeta =
                                    STATUS_META[job.status] ||
                                    STATUS_META.queued;
                                const title =
                                    job.invoice ||
                                    (job.ticket_number
                                        ? `#${job.ticket_number}`
                                        : `Job #${job.id}`);

                                return (
                                    <div
                                        key={job.id}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {title}
                                                    </p>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusMeta.className}`}
                                                    >
                                                        {statusMeta.label}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        {job.job_type_label}
                                                    </span>
                                                    {job.copies > 1 ? (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {job.copies}x
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="inline-flex items-center gap-1">
                                                        <IconPrinter size={12} />
                                                        {job.device_name ||
                                                            "Tanpa device"}
                                                    </span>
                                                    {job.paper_width ? (
                                                        <span>
                                                            {job.paper_width}
                                                        </span>
                                                    ) : null}
                                                    {job.station_name ? (
                                                        <span>
                                                            {job.station_name}
                                                        </span>
                                                    ) : null}
                                                    {job.created_by_name ? (
                                                        <span>
                                                            Oleh{" "}
                                                            {
                                                                job.created_by_name
                                                            }
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="inline-flex items-center gap-1">
                                                        <IconClock size={12} />
                                                        Masuk{" "}
                                                        {formatTime(
                                                            job.queued_at
                                                        )}
                                                    </span>
                                                    {job.processing_at ? (
                                                        <span>
                                                            Proses{" "}
                                                            {formatTime(
                                                                job.processing_at
                                                            )}
                                                        </span>
                                                    ) : null}
                                                    {job.processed_at ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                                                        >
                                                            <IconCheck
                                                                size={12}
                                                            />
                                                            Cetak{" "}
                                                            {formatTime(
                                                                job.processed_at
                                                            )}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {job.failure_reason ? (
                                                    <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                                        <IconAlertTriangle
                                                            size={13}
                                                            className="mt-0.5 shrink-0"
                                                        />
                                                        <span>
                                                            {job.failure_reason}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                {job.can_requeue ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onRequeue(
                                                                job
                                                            )
                                                        }
                                                        disabled={
                                                            requeueingId ===
                                                            job.id
                                                        }
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:border-primary-300 disabled:opacity-60 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                                                    >
                                                        {requeueingId ===
                                                        job.id ? (
                                                            <IconLoader2
                                                                size={13}
                                                                className="animate-spin"
                                                            />
                                                        ) : (
                                                            <IconRefresh
                                                                size={13}
                                                            />
                                                        )}
                                                        Print Ulang
                                                    </button>
                                                ) : null}
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    #{job.id}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-950/40">
                            <IconList size={28} className="text-slate-300 dark:text-slate-600" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isLoading
                                    ? "Memuat antrean print..."
                                    : "Tidak ada job print yang cocok dengan filter ini."}
                            </p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
                    <button
                        type="button"
                        onClick={() =>
                            updateFilter(
                                "page",
                                Math.max(1, Number(meta.current_page || 1) - 1)
                            )
                        }
                        disabled={isLoading || Number(meta.current_page || 1) <= 1}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                        <IconChevronLeft size={14} />
                        Sebelumnya
                    </button>
                    <span className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        {meta.current_page || 1} / {meta.last_page || 1}
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            updateFilter(
                                "page",
                                Math.min(
                                    Number(meta.last_page || 1),
                                    Number(meta.current_page || 1) + 1
                                )
                            )
                        }
                        disabled={
                            isLoading ||
                            Number(meta.current_page || 1) >=
                                Number(meta.last_page || 1)
                        }
                        className="inline-flex items-center gap-1 justify-self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                        Berikutnya
                        <IconChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
