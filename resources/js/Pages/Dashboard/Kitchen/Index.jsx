import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import {
    IconCheck,
    IconChefHat,
    IconClockHour4,
    IconDeviceDesktop,
    IconDeviceIpad,
    IconFilter,
    IconInfoCircle,
    IconMaximize,
    IconMinimize,
    IconPrinter,
    IconReceipt2,
    IconRefresh,
    IconSearch,
    IconX,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const statusMeta = {
    active: { label: "Semua aktif" },
    pending: { label: "Menunggu" },
    acknowledged: { label: "Diproses" },
    ready: { label: "Siap Antar / Ambil" },
    completed: { label: "Selesai" },
};

const ticketStatusMeta = {
    pending: {
        label: "Menunggu",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    },
    acknowledged: {
        label: "Diproses",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    },
    ready: {
        label: "Siap Antar / Ambil",
        badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    },
    completed: {
        label: "Sudah Diserahkan",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    },
};

const emptyTicketPayload = {
    data: [],
    meta: {
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 0,
        from: null,
        to: null,
    },
};

const formatTime = (value) =>
    value
        ? new Date(value).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

const buildBoardFilters = (filters = {}, selectedDevice = null) => ({
    status: filters?.status || "active",
    q: filters?.q || "",
    page: Number(filters?.page || 1),
    per_page: Number(filters?.per_page || 15),
    sort: filters?.sort || "oldest",
    device_id: selectedDevice?.id || filters?.device_id || null,
});

const buildBoardState = ({
    activeStation,
    tickets,
    refreshMeta,
    filters,
    selectedDevice,
}) => ({
    activeStation,
    tickets: tickets || emptyTicketPayload,
    refreshMeta,
    filters: buildBoardFilters(filters, selectedDevice),
    selectedDevice,
});

export default function KitchenIndex({
    stations = [],
    activeStation = null,
    tickets = emptyTicketPayload,
    refreshMeta = null,
    filters = null,
    selectedDevice = null,
    kioskMode = false,
}) {
    const { flash, activeOutlet } = usePage().props;
    const [isFullscreenActive, setIsFullscreenActive] = useState(false);
    const [selectedPrinterId, setSelectedPrinterId] = useState(null);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [boardState, setBoardState] = useState(
        buildBoardState({ activeStation, tickets, refreshMeta, filters, selectedDevice })
    );
    const [draftFilters, setDraftFilters] = useState(() =>
        buildBoardFilters(filters, selectedDevice)
    );
    const audioContextRef = useRef(null);
    const audioUnlockedRef = useRef(false);
    const seenTicketIdsRef = useRef(new Set((tickets?.data || []).map((ticket) => ticket.id)));

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    useEffect(() => {
        const syncFullscreenState = () => {
            setIsFullscreenActive(Boolean(document.fullscreenElement));
        };

        syncFullscreenState();
        document.addEventListener("fullscreenchange", syncFullscreenState);

        return () => {
            document.removeEventListener("fullscreenchange", syncFullscreenState);
        };
    }, []);

    useEffect(() => {
        const nextBoardState = buildBoardState({
            activeStation,
            tickets,
            refreshMeta,
            filters,
            selectedDevice,
        });

        setBoardState(nextBoardState);
        setDraftFilters(nextBoardState.filters);
        seenTicketIdsRef.current = new Set(
            (nextBoardState.tickets?.data || []).map((ticket) => ticket.id)
        );
    }, [activeStation, tickets, refreshMeta, filters, selectedDevice]);

    useEffect(() => {
        const devices = activeStation?.devices || [];
        const printers = devices.filter((device) => device.device_type === "printer");

        if (printers.length === 0) {
            setSelectedPrinterId(null);
            return;
        }

        const matchedPrinter =
            printers.find((device) => device.id === selectedDevice?.id) ||
            printers.find((device) => device.is_primary) ||
            printers[0];

        setSelectedPrinterId(matchedPrinter?.id || null);
    }, [activeStation, selectedDevice]);

    useEffect(() => {
        if (!boardState.activeStation?.slug) {
            return undefined;
        }

        const intervalSeconds = Number(boardState.refreshMeta?.interval_seconds || 15);
        const timer = window.setInterval(() => {
            fetchBoardData(boardState.filters);
        }, intervalSeconds * 1000);

        return () => window.clearInterval(timer);
    }, [boardState.activeStation?.slug, boardState.filters, boardState.refreshMeta?.interval_seconds]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const unlockAudio = async () => {
            try {
                if (!audioContextRef.current) {
                    const AudioContextClass =
                        window.AudioContext || window.webkitAudioContext;
                    if (!AudioContextClass) return;
                    audioContextRef.current = new AudioContextClass();
                }

                if (audioContextRef.current.state === "suspended") {
                    await audioContextRef.current.resume();
                }

                audioUnlockedRef.current = true;
            } catch (error) {
                audioUnlockedRef.current = false;
            }
        };

        window.addEventListener("pointerdown", unlockAudio, { once: true });

        return () => {
            window.removeEventListener("pointerdown", unlockAudio);
        };
    }, []);

    const playNotificationSound = () => {
        if (!audioUnlockedRef.current || !audioContextRef.current) {
            return;
        }

        try {
            const context = audioContextRef.current;
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, now);
            oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.18);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.24);
        } catch (error) {
            console.error("Gagal memutar suara notifikasi dapur", error);
        }
    };

    const handleAcknowledge = (ticketId) => {
        if ((boardState.activeStation?.processing_mode || "auto") === "manual") {
            const confirmed = window.confirm(
                "Mulai proses ticket ini sekarang?"
            );

            if (!confirmed) {
                return;
            }
        }

        router.post(route("kitchen.tickets.acknowledge", ticketId), {}, {
            preserveScroll: true,
        });
    };

    const handleComplete = (ticketId) => {
        router.post(route("kitchen.tickets.complete", ticketId), {}, {
            preserveScroll: true,
        });
    };

    const handleDeliver = (ticketId) => {
        router.post(route("kitchen.tickets.deliver", ticketId), {}, {
            preserveScroll: true,
        });
    };

    const handleToggleProcessingMode = () => {
        if (!boardState.activeStation?.id) {
            return;
        }

        const nextMode =
            (boardState.activeStation?.processing_mode || "auto") === "manual"
                ? "auto"
                : "manual";
        const confirmed = window.confirm(
            nextMode === "auto"
                ? "Ubah station ini ke mode proses otomatis?"
                : "Ubah station ini ke mode proses manual?"
        );

        if (!confirmed) {
            return;
        }

        router.patch(
            route(
                "settings.kitchen-stations.processing-mode.update",
                boardState.activeStation.id
            ),
            {
                processing_mode: nextMode,
            },
            {
                preserveScroll: true,
            }
        );
    };

    const handleDispatch = (ticketId) => {
        if (!selectedPrinterId) {
            toast.error("Pilih printer tujuan terlebih dahulu.");
            return;
        }

        router.post(
            route("kitchen.tickets.dispatch", ticketId),
            { device_id: selectedPrinterId },
            { preserveScroll: true }
        );
    };

    const handleQueueDispatch = (ticketId) => {
        if (!selectedPrinterId) {
            toast.error("Pilih printer tujuan terlebih dahulu.");
            return;
        }

        router.post(
            route("kitchen.tickets.queue-dispatch", ticketId),
            { device_id: selectedPrinterId },
            { preserveScroll: true }
        );
    };

    const handleDispatchFailed = (ticketId) => {
        if (!selectedPrinterId) {
            toast.error("Pilih printer tujuan terlebih dahulu.");
            return;
        }

        const reason = window.prompt(
            "Catatan kegagalan printer",
            "Printer belum merespons"
        );

        router.post(
            route("kitchen.tickets.fail-dispatch", ticketId),
            {
                device_id: selectedPrinterId,
                reason: reason || "Printer belum merespons",
            },
            { preserveScroll: true }
        );
    };

    const handleRefresh = async () => {
        const success = await fetchBoardData(boardState.filters, {
            showToast: true,
            manual: true,
        });

        if (!success) {
            toast.error("Gagal memuat ulang antrean dapur.");
        }
    };

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }

            await document.documentElement.requestFullscreen();
        } catch (error) {
            toast.error("Browser tidak mengizinkan fullscreen otomatis.");
        }
    };

    const deviceIcon = (deviceType) => {
        if (deviceType === "printer") {
            return <IconPrinter size={16} />;
        }

        if (deviceType === "tablet") {
            return <IconDeviceIpad size={16} />;
        }

        return <IconDeviceDesktop size={16} />;
    };

    const fetchBoardData = async (
        nextFilters = boardState.filters,
        options = {}
    ) => {
        if (!boardState.activeStation?.slug) {
            return false;
        }

        const { showToast = false, manual = false } = options;

        const requestFilters = {
            ...boardState.filters,
            ...nextFilters,
            device_id: boardState.selectedDevice?.id || nextFilters?.device_id || "",
        };

        const searchParams = new URLSearchParams();
        searchParams.set("status", requestFilters.status || "active");
        searchParams.set("page", String(requestFilters.page || 1));
        searchParams.set("per_page", String(requestFilters.per_page || 15));
        searchParams.set("sort", requestFilters.sort || "oldest");
        searchParams.set("_ts", String(Date.now()));
        if (requestFilters.q) {
            searchParams.set("q", requestFilters.q);
        }
        if (requestFilters.device_id) {
            searchParams.set("device_id", String(requestFilters.device_id));
        }

        try {
            if (manual) {
                setIsRefreshing(true);
            }

            const response = await fetch(
                `${route("kitchen.feed", boardState.activeStation.slug)}?${searchParams.toString()}`
            );

            if (!response.ok) {
                return false;
            }

            const payload = await response.json();
            const nextIds = new Set((payload.tickets?.data || []).map((ticket) => ticket.id));
            const previousIds = seenTicketIdsRef.current;
            const newTickets = (payload.tickets?.data || []).filter(
                (ticket) =>
                    !previousIds.has(ticket.id) &&
                    (ticket.status === "pending" || ticket.status === "acknowledged")
            );

            if (newTickets.length > 0) {
                playNotificationSound();
                toast.success(`${newTickets.length} tiket dapur baru masuk.`);
            }

            seenTicketIdsRef.current = nextIds;

            setBoardState((current) => ({
                ...current,
                ...payload,
                filters: buildBoardFilters(payload.filters, payload.selectedDevice),
            }));
            setDraftFilters((current) => ({
                ...current,
                status: payload.filters?.status || current.status,
                page: payload.filters?.page || current.page,
                per_page: payload.filters?.per_page || current.per_page,
                sort: payload.filters?.sort || current.sort,
            }));

            if (showToast) {
                toast.success("Antrean dapur berhasil dimuat ulang.");
            }

            return true;
        } catch (error) {
            console.error("Gagal menyegarkan papan antrean dapur", error);
            return false;
        } finally {
            if (manual) {
                setIsRefreshing(false);
            }
        }
    };

    const navigateWithFilters = (nextFilters = {}) => {
        if (!boardState.activeStation?.slug) {
            return;
        }

        const mergedFilters = {
            ...boardState.filters,
            ...nextFilters,
            device_id: boardState.selectedDevice?.id,
        };

        router.get(
            route("kitchen.show", boardState.activeStation.slug),
            {
                status: mergedFilters.status || "active",
                q: mergedFilters.q || undefined,
                page: mergedFilters.page || 1,
                per_page: mergedFilters.per_page || 15,
                sort: mergedFilters.sort || "oldest",
                device_id: mergedFilters.device_id,
                kiosk: kioskMode ? 1 : undefined,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            }
        );
    };

    const applyStatusFilter = (status) => {
        const nextFilters = {
            ...draftFilters,
            status: status || "active",
            page: 1,
        };

        setDraftFilters(nextFilters);
        navigateWithFilters(nextFilters);
    };

    const applyAdvancedFilters = () => {
        navigateWithFilters({
            ...draftFilters,
            page: 1,
        });
    };

    const resetFilters = () => {
        const nextFilters = {
            status: "active",
            q: "",
            page: 1,
            per_page: 15,
            sort: "oldest",
            device_id: boardState.selectedDevice?.id || null,
        };

        setDraftFilters(nextFilters);
        navigateWithFilters(nextFilters);
    };

    const goToPage = (page) => {
        navigateWithFilters({
            ...boardState.filters,
            page,
        });
    };

    const selectedStatus = boardState.filters?.status || "active";
    const selectedStation = boardState.activeStation;
    const ticketCollection = boardState.tickets || emptyTicketPayload;
    const selectedTickets = ticketCollection.data || [];
    const ticketMeta = ticketCollection.meta || emptyTicketPayload.meta;
    const screenDevices = (selectedStation?.devices || []).filter(
        (device) => device.device_type !== "printer"
    );
    const printerDevices = (selectedStation?.devices || []).filter(
        (device) => device.device_type === "printer"
    );
    const selectedPrinter =
        printerDevices.find((device) => device.id === selectedPrinterId) || null;
    const isFullscreenSupported =
        typeof document !== "undefined" &&
        (document.fullscreenEnabled || document.webkitFullscreenEnabled);
    const selectedStationStats = {
        pending: Number(selectedStation?.pending_count || 0),
        acknowledged: Number(selectedStation?.acknowledged_count || 0),
        ready: Number(selectedStation?.ready_count || 0),
        completed: Number(selectedStation?.completed_count || 0),
    };

    return (
        <>
            <Head title="Layar Dapur" />

            <div className="space-y-4">
                <div
                    className={`flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between ${
                        kioskMode
                            ? "rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            : ""
                    }`}
                >
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            {kioskMode ? "Antrean Dapur" : "Layar Dapur"}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Tampilan antrean dapur yang lebih ringkas untuk proses cepat.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {kioskMode && isFullscreenSupported ? (
                            <button
                                type="button"
                                onClick={toggleFullscreen}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                {isFullscreenActive ? (
                                    <IconMinimize size={16} />
                                ) : (
                                    <IconMaximize size={16} />
                                )}
                                {isFullscreenActive ? "Keluar Fullscreen" : "Fullscreen"}
                            </button>
                        ) : null}
                        <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Auto refresh {boardState.refreshMeta?.interval_seconds || 15} dtk
                        </div>
                        {!kioskMode && selectedStation ? (
                            <button
                                type="button"
                                onClick={handleToggleProcessingMode}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                                    (selectedStation.processing_mode || "auto") === "manual"
                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                                }`}
                            >
                                {(selectedStation.processing_mode || "auto") === "manual"
                                    ? "Ubah ke Auto"
                                    : "Ubah ke Manual"}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setShowGuideModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconInfoCircle size={15} />
                            Panduan
                        </button>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconRefresh size={15} />
                            {isRefreshing ? "Memuat..." : "Muat Ulang"}
                        </button>
                    </div>
                </div>

                {selectedStation ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-primary-100 p-3 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                                    <IconReceipt2 size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {selectedStation.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {ticketMeta.total || 0} tiket pada filter{" "}
                                        {statusMeta[selectedStatus]?.label?.toLowerCase() || "aktif"}.
                                    </p>
                                    {boardState.refreshMeta?.polled_at && (
                                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                            Sinkron terakhir {formatTime(boardState.refreshMeta.polled_at)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                        (selectedStation.processing_mode || "auto") === "manual"
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    }`}
                                >
                                    {(selectedStation.processing_mode || "auto") === "manual"
                                        ? "Mode proses manual"
                                        : "Mode proses otomatis"}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {(selectedStation.processing_mode || "auto") === "manual"
                                        ? "Ticket menunggu perlu diklik dan dikonfirmasi sebelum masuk proses."
                                        : "Ticket menunggu akan otomatis masuk ke status diproses saat board aktif."}
                                </span>
                            </div>

                            {(selectedStation.processing_mode || "auto") === "manual" ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                                    Station ini sedang memakai mode manual. Ticket baru tidak akan otomatis diproses sampai tombol
                                    <span className="mx-1 font-semibold">Mulai Proses</span>
                                    ditekan.
                                </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                                {[
                                    {
                                        value: "active",
                                        label: "Semua aktif",
                                        count:
                                            selectedStationStats.pending +
                                            selectedStationStats.acknowledged +
                                            selectedStationStats.ready,
                                    },
                                    {
                                        value: "pending",
                                        label: "Menunggu",
                                        count: selectedStationStats.pending,
                                    },
                                    {
                                        value: "acknowledged",
                                        label: "Diproses",
                                        count: selectedStationStats.acknowledged,
                                    },
                                    {
                                        value: "ready",
                                        label: "Siap Antar / Ambil",
                                        count: selectedStationStats.ready,
                                    },
                                    {
                                        value: "completed",
                                        label: "Selesai",
                                        count: selectedStationStats.completed,
                                    },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => applyStatusFilter(option.value)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                            selectedStatus === option.value
                                                ? "bg-primary-600 text-white"
                                                : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        }`}
                                    >
                                        {option.label} ({option.count})
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedFilter((current) => !current)}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    <IconFilter size={14} />
                                    {showAdvancedFilter ? "Tutup filter" : "Filter lanjutan"}
                                </button>
                                <div className="ml-auto flex flex-wrap gap-2">
                                    {[
                                        { value: "oldest", label: "Terlama" },
                                        { value: "newest", label: "Terbaru" },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                const nextFilters = {
                                                    ...draftFilters,
                                                    sort: option.value,
                                                    page: 1,
                                                };
                                                setDraftFilters(nextFilters);
                                                navigateWithFilters(nextFilters);
                                            }}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                (boardState.filters?.sort || "oldest") === option.value
                                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                                    : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {showAdvancedFilter ? (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_220px]">
                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                            Cari tiket / nota / item
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
                                                placeholder="KT, invoice, pelanggan, item..."
                                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                            Urutan tiket
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
                                            <option value="oldest">Pesanan terlama dulu</option>
                                            <option value="newest">Pesanan terbaru dulu</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                            Baris per halaman
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
                                            {[10, 15, 25, 50].map((size) => (
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
                                            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
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
                            </div>
                        ) : null}

                        {(screenDevices.length > 0 || printerDevices.length > 0) && (
                            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                                {screenDevices.length > 0 ? (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                                        <span className="text-slate-400">
                                            <IconDeviceDesktop size={14} />
                                        </span>
                                        <span className="font-medium">
                                            {screenDevices.find((device) => device.is_primary)?.name ||
                                                screenDevices[0]?.name}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                            Layar
                                        </span>
                                    </div>
                                ) : null}

                                {printerDevices.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                            Printer
                                        </span>
                                        {printerDevices.map((device) => (
                                            <button
                                                type="button"
                                                key={device.id}
                                                onClick={() => setSelectedPrinterId(device.id)}
                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                                                    selectedPrinterId === device.id
                                                        ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-300"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                }`}
                                            >
                                                <span className="text-slate-400">
                                                    <IconPrinter size={14} />
                                                </span>
                                                <span className="font-medium">{device.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {selectedTickets.length === 0 ? (
                            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Belum ada tiket untuk filter ini.
                            </div>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                                            <thead className="bg-slate-50 dark:bg-slate-950/40">
                                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                                    <th className="px-4 py-3">Tiket</th>
                                                    <th className="px-4 py-3">Waktu</th>
                                                    <th className="px-4 py-3">Pesanan</th>
                                                    <th className="px-4 py-3">Printer</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3 text-right">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                                {selectedTickets.map((ticket) => (
                                                    <tr key={ticket.id} className="align-top">
                                                        <td className="px-4 py-4">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                                                {ticket.ticket_number}
                                                            </p>
                                                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                                                {ticket.invoice || "Tanpa nomor nota"}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {ticket.customer_name || "Pelanggan umum"}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <IconClockHour4 size={14} />
                                                                        <span>Masuk {formatDateTime(ticket.fired_at)}</span>
                                                                    </div>
                                                                {ticket.acknowledged_at ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <IconChefHat size={14} />
                                                                        <span>
                                                                            Proses {formatDateTime(ticket.acknowledged_at)}
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                                {ticket.ready_at ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <IconCheck size={14} />
                                                                        <span>
                                                                            Siap {formatDateTime(ticket.ready_at)}
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                                {ticket.completed_at ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <IconCheck size={14} />
                                                                        <span>
                                                                            Diserahkan {formatDateTime(ticket.completed_at)}
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="min-w-[260px] space-y-2">
                                                                {ticket.items.map((item) => (
                                                                    <div
                                                                        key={item.id}
                                                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <p className="font-medium text-slate-900 dark:text-white">
                                                                                    {item.product_title}
                                                                                </p>
                                                                                {item.notes ? (
                                                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                                        {item.notes}
                                                                                    </p>
                                                                                ) : null}
                                                                            </div>
                                                                            <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                                                x{item.qty}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                                                            {ticket.dispatch?.dispatched_at ? (
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {deviceIcon(ticket.dispatch.device_type || "printer")}
                                                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                            {ticket.dispatch.device_name || "Printer"}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        {ticket.dispatch.status === "queued"
                                                                            ? "Antrean"
                                                                            : ticket.dispatch.status === "failed"
                                                                              ? "Gagal"
                                                                              : "Berhasil"}{" "}
                                                                        {formatDateTime(ticket.dispatch.dispatched_at)}
                                                                    </div>
                                                                    {ticket.dispatch.reason ? (
                                                                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                                                            {ticket.dispatch.reason}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ) : (
                                                                <span>-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span
                                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                                    ticketStatusMeta[ticket.status]?.badge ||
                                                                    ticketStatusMeta.pending.badge
                                                                }`}
                                                            >
                                                                {ticketStatusMeta[ticket.status]?.label || "Menunggu"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex min-w-[260px] flex-col gap-2">
                                                                {ticket.status === "pending" &&
                                                                (boardState.activeStation?.processing_mode || "auto") === "manual" ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAcknowledge(ticket.id)}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"
                                                                    >
                                                                        <IconChefHat size={16} />
                                                                        Mulai Proses
                                                                    </button>
                                                                ) : null}

                                                                {ticket.status === "acknowledged" ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleComplete(ticket.id)}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                                                                    >
                                                                        <IconCheck size={16} />
                                                                        Siap Diantar / Diambil
                                                                    </button>
                                                                ) : null}

                                                                {ticket.status === "ready" ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeliver(ticket.id)}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
                                                                    >
                                                                        <IconCheck size={16} />
                                                                        Sudah Diambil / Diserahkan
                                                                    </button>
                                                                ) : null}

                                                                {printerDevices.length > 0 &&
                                                                ticket.status !== "completed" ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQueueDispatch(ticket.id)}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
                                                                    >
                                                                        <IconPrinter size={16} />
                                                                        Kirim ke Printer
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        Menampilkan {ticketMeta.from || 0} - {ticketMeta.to || 0} dari{" "}
                                        {ticketMeta.total || 0} tiket
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => goToPage(Math.max(1, ticketMeta.current_page - 1))}
                                            disabled={ticketMeta.current_page <= 1}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            Sebelumnya
                                        </button>
                                        <div className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                            Hal. {ticketMeta.current_page} / {ticketMeta.last_page}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                goToPage(
                                                    Math.min(ticketMeta.last_page, ticketMeta.current_page + 1)
                                                )
                                            }
                                            disabled={ticketMeta.current_page >= ticketMeta.last_page}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            Berikutnya
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Belum ada stasiun dapur aktif untuk outlet ini.
                    </div>
                )}
            </div>

            {showGuideModal ? (
                <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
                    <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Panduan tombol dapur
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Ringkasan fungsi tombol agar operasional dapur lebih konsisten.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGuideModal(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    Mulai Proses
                                </p>
                                <p className="mt-1">
                                    Mode manual: ambil tiket dari status menunggu ke diproses saat dapur mulai mengerjakan.
                                </p>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Jika station memakai mode otomatis, langkah ini tidak perlu ditekan karena sistem akan memproses ticket masuk secara otomatis.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    Siap Diantar / Diambil
                                </p>
                                <p className="mt-1">
                                    Tutup proses dapur saat item sudah siap keluar dari station.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    Kirim ke Printer
                                </p>
                                <p className="mt-1">
                                    Kirim slip dapur ke printer bila station ini memang memakai cetak.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    Status Printer
                                </p>
                                <p className="mt-1">
                                    Kolom printer hanya menampilkan status antre/cetak terakhir. Tidak perlu aksi manual tambahan.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

KitchenIndex.layout = (page) =>
    page.props?.auth?.user?.preferred_workspace === "kitchen" ? (
        <KitchenLayout children={page} />
    ) : (
        <DashboardLayout children={page} />
    );
