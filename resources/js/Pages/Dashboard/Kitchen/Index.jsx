import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import {
    IconCheck,
    IconChefHat,
    IconClockHour4,
    IconDeviceDesktop,
    IconDeviceIpad,
    IconInfoCircle,
    IconMaximize,
    IconMinimize,
    IconPrinter,
    IconReceipt2,
    IconRefresh,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const statusMeta = {
    active: { label: "Semua aktif" },
    pending: { label: "Menunggu" },
    acknowledged: { label: "Diproses" },
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
    completed: {
        label: "Selesai",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    },
};

const formatTime = (value) =>
    value
        ? new Date(value).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

export default function KitchenIndex({
    stations = [],
    activeStation = null,
    tickets = [],
    refreshMeta = null,
    filters = null,
    selectedDevice = null,
    kioskMode = false,
}) {
    const { flash, activeOutlet } = usePage().props;
    const [isFullscreenActive, setIsFullscreenActive] = useState(false);
    const [selectedPrinterId, setSelectedPrinterId] = useState(null);
    const [boardState, setBoardState] = useState({
        activeStation,
        tickets,
        refreshMeta,
        filters: filters || { status: "active" },
        selectedDevice,
    });

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
        setBoardState({
            activeStation,
            tickets,
            refreshMeta,
            filters: filters || { status: "active" },
            selectedDevice,
        });
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

        const intervalSeconds = Number(refreshMeta?.interval_seconds || 15);
        const timer = window.setInterval(() => {
            fetchBoardData(boardState.filters?.status || "active");
        }, intervalSeconds * 1000);

        return () => window.clearInterval(timer);
    }, [refreshMeta?.interval_seconds, boardState.activeStation?.slug, boardState.filters?.status]);

    const handleAcknowledge = (ticketId) => {
        router.post(route("kitchen.tickets.acknowledge", ticketId), {}, {
            preserveScroll: true,
        });
    };

    const handleComplete = (ticketId) => {
        router.post(route("kitchen.tickets.complete", ticketId), {}, {
            preserveScroll: true,
        });
    };

    const handleDispatch = (ticketId) => {
        if (!selectedPrinterId) {
            toast.error("Pilih printer tujuan terlebih dahulu.");
            return;
        }

        router.post(
            route("kitchen.tickets.dispatch", ticketId),
            {
                device_id: selectedPrinterId,
            },
            {
                preserveScroll: true,
            }
        );
    };

    const handleQueueDispatch = (ticketId) => {
        if (!selectedPrinterId) {
            toast.error("Pilih printer tujuan terlebih dahulu.");
            return;
        }

        router.post(
            route("kitchen.tickets.queue-dispatch", ticketId),
            {
                device_id: selectedPrinterId,
            },
            {
                preserveScroll: true,
            }
        );
    };

    const handleDispatchFailed = (ticketId) => {
        if (!selectedPrinterId) {
            toast.error("Pilih printer tujuan terlebih dahulu.");
            return;
        }

        const reason = window.prompt("Catatan kegagalan printer", "Printer belum merespons");

        router.post(
            route("kitchen.tickets.fail-dispatch", ticketId),
            {
                device_id: selectedPrinterId,
                reason: reason || "Printer belum merespons",
            },
            {
                preserveScroll: true,
            }
        );
    };

    const handleRefresh = () => {
        fetchBoardData(boardState.filters?.status || "active");
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

    const fetchBoardData = async (status) => {
        if (!boardState.activeStation?.slug) {
            return;
        }

        try {
            const response = await fetch(
                route("kitchen.feed", boardState.activeStation.slug) +
                    `?status=${encodeURIComponent(status)}&device_id=${encodeURIComponent(boardState.selectedDevice?.id || "")}`
            );

            if (!response.ok) {
                return;
            }

            const payload = await response.json();
            setBoardState((current) => ({
                ...current,
                ...payload,
            }));
        } catch (error) {
            console.error("Gagal menyegarkan papan antrean dapur", error);
        }
    };

    const applyStatusFilter = (status) => {
        const nextStatus = status || "active";

        if (!boardState.activeStation?.slug) {
            return;
        }

        router.get(
            route("kitchen.show", boardState.activeStation.slug),
            {
                status: nextStatus,
                device_id: boardState.selectedDevice?.id,
                kiosk: kioskMode ? 1 : undefined,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            }
        );
    };

    const selectedStatus = boardState.filters?.status || "active";
    const selectedStation = boardState.activeStation;
    const selectedTickets = boardState.tickets || [];
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

    return (
        <>
            <Head title="Layar Dapur" />

            <div className="space-y-6">
                <div className={`flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between ${kioskMode ? "rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" : ""}`}>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {kioskMode ? "Antrean Dapur" : "Layar Dapur"}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {kioskMode
                                ? "Mode tablet untuk antrian dapur aktif."
                                : "Antrean dapur per stasiun untuk outlet aktif."}
                        </p>
                        {activeOutlet?.name && (
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                                Outlet aktif: {activeOutlet.name}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
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
                                {isFullscreenActive
                                    ? "Keluar Layar Penuh"
                                    : "Masuk Layar Penuh"}
                            </button>
                        ) : null}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Penyegaran otomatis {refreshMeta?.interval_seconds || 15} detik
                        </p>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconRefresh size={16} />
                            Muat Ulang
                        </button>
                    </div>
                </div>

                {kioskMode ? (
                    <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-200">
                        <p className="font-semibold">Mode kiosk aktif</p>
                        <p className="mt-1 text-primary-700 dark:text-primary-300">
                            Gunakan tautan kiosk untuk tablet dapur. Aktifkan layar penuh agar tampilan tetap fokus ke antrean stasiun ini.
                        </p>
                    </div>
                ) : null}

                <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <IconInfoCircle size={18} />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Panduan alur dapur
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Buka untuk melihat arti status dan fungsi tombol.
                            </p>
                        </div>
                    </summary>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Alur dapur yang digunakan
                            </p>
                            <p className="mt-1">
                                `Menunggu` berarti tiket baru masuk. `Diproses` berarti dapur sudah mulai mengerjakan. `Selesai` berarti pesanan sudah selesai dari dapur dan siap diambil petugas antar atau langsung diambil pelanggan.
                            </p>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-medium text-slate-900 dark:text-white">Mulai Proses</p>
                                <p className="mt-1 text-xs">
                                    Tekan saat dapur mulai memasak atau menyiapkan pesanan ini. Status berpindah dari `Menunggu` ke `Diproses`.
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-medium text-slate-900 dark:text-white">Siap Diantar / Diambil</p>
                                <p className="mt-1 text-xs">
                                    Tekan saat item benar-benar siap keluar dari dapur. Setelah ini papan petugas antar akan menerima status `Siap Antar`, bukan berarti sudah sampai ke pelanggan.
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-medium text-slate-900 dark:text-white">Masuk Antrean Printer</p>
                                <p className="mt-1 text-xs">
                                    Kirim tiket ke antrean printer yang dipilih. Gunakan jika bagian dapur ini perlu slip cetak.
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                                <p className="font-medium text-slate-900 dark:text-white">Berhasil / Gagal</p>
                                <p className="mt-1 text-xs">
                                    Dipakai untuk mencatat hasil cetak printer. Ini tidak mengubah status masak, hanya status pengiriman ke printer.
                                </p>
                            </div>
                        </div>
                    </div>
                </details>

                <div className={`grid gap-3 ${kioskMode ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-4"}`}>
                    {stations.map((station) => {
                        const isActive = selectedStation?.id === station.id;

                        return (
                            <Link
                                key={station.id}
                                href={route("kitchen.show", {
                                    stationSlug: station.slug,
                                    status: selectedStatus,
                                    device_id: station.devices?.find((device) => device.is_primary)?.id,
                                    kiosk: kioskMode ? 1 : undefined,
                                })}
                                className={`rounded-2xl border p-4 transition ${
                                    isActive
                                        ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30"
                                        : "border-slate-200 bg-white hover:border-primary-300 dark:border-slate-800 dark:bg-slate-900"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                            {station.code}
                                        </p>
                                        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                            {station.name}
                                        </h2>
                                    </div>
                                    <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        <IconChefHat size={20} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-4 text-sm">
                                    <span className="text-amber-600 dark:text-amber-400">
                                        Menunggu: {station.pending_count}
                                    </span>
                                    <span className="text-sky-600 dark:text-sky-400">
                                        Diproses: {station.acknowledged_count}
                                    </span>
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                        Selesai: {station.completed_count ?? 0}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {selectedStation ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-primary-100 p-3 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                                    <IconReceipt2 size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {selectedStation.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {selectedTickets.length} tiket pada filter {statusMeta[selectedStatus]?.label?.toLowerCase() || "aktif"}.
                                    </p>
                                    {boardState.refreshMeta?.polled_at && (
                                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                            Sinkron terakhir {formatTime(boardState.refreshMeta.polled_at)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mb-5 flex flex-wrap gap-2">
                            {[
                                { value: "active", label: "Semua aktif" },
                                { value: "pending", label: "Menunggu" },
                                { value: "acknowledged", label: "Diproses" },
                                { value: "completed", label: "Selesai" },
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
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {(screenDevices.length > 0 || printerDevices.length > 0) && (
                            <div className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                                {screenDevices.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                            Layar terhubung
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {screenDevices.map((device) => (
                                                <span
                                                    key={device.id}
                                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                >
                                                    {deviceIcon(device.device_type)}
                                                    <span className="font-medium">{device.name}</span>
                                                    <span className="text-slate-400">{device.device_type}</span>
                                                    {device.is_primary && (
                                                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                                                            Utama
                                                        </span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {printerDevices.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                            Printer tujuan
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
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
                                                    {deviceIcon(device.device_type)}
                                                    <span className="font-medium">{device.name}</span>
                                                    {device.is_primary && (
                                                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                                                            Utama
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Tiket tetap tampil di layar ini. Pilihan printer hanya dipakai saat mengirim ke antrean cetak.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedTickets.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Belum ada tiket untuk filter ini.
                            </div>
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                {selectedTickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    {ticket.ticket_number}
                                                </p>
                                                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                                    {ticket.invoice || "Tanpa nomor nota"}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {ticket.customer_name || "Pelanggan umum"}
                                                </p>
                                            </div>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    ticketStatusMeta[ticket.status]?.badge || ticketStatusMeta.pending.badge
                                                }`}
                                            >
                                                {ticketStatusMeta[ticket.status]?.label || "Menunggu"}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <IconClockHour4 size={16} />
                                            <span>Masuk {formatTime(ticket.fired_at)}</span>
                                        </div>

                                        {ticket.acknowledged_at && ticket.status !== "pending" && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <IconChefHat size={16} />
                                                <span>Diproses {formatTime(ticket.acknowledged_at)}</span>
                                            </div>
                                        )}

                                        {ticket.completed_at && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <IconCheck size={16} />
                                                <span>Selesai {formatTime(ticket.completed_at)}</span>
                                            </div>
                                        )}

                                        {ticket.dispatch?.dispatched_at && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                {deviceIcon(ticket.dispatch.device_type || "printer")}
                                                <span>
                                                    {ticket.dispatch.status === "queued"
                                                        ? "Antrean"
                                                        : ticket.dispatch.status === "failed"
                                                          ? "Gagal"
                                                          : "Terkirim"}{" "}
                                                    {formatTime(ticket.dispatch.dispatched_at)}
                                                    {ticket.dispatch.device_name
                                                        ? ` • ${ticket.dispatch.device_name}`
                                                        : ""}
                                                </span>
                                            </div>
                                        )}
                                        {ticket.dispatch?.reason ? (
                                            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                                {ticket.dispatch.reason}
                                            </div>
                                        ) : null}

                                        <div className="mt-4 space-y-2 rounded-2xl bg-white p-3 dark:bg-slate-900">
                                            {ticket.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-start justify-between gap-3 text-sm"
                                                >
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-slate-100">
                                                            {item.product_title}
                                                        </p>
                                                        {item.notes && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                        x{item.qty}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {ticket.status !== "completed" && (
                                            <div className="mt-4 flex gap-2">
                                                {ticket.status === "pending" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAcknowledge(ticket.id)}
                                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"
                                                    >
                                                        <IconChefHat size={16} />
                                                        Mulai Proses
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => handleComplete(ticket.id)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                                                >
                                                    <IconCheck size={16} />
                                                    Siap Diantar / Diambil
                                                </button>
                                            </div>
                                        )}

                                        {printerDevices.length > 0 && ticket.status !== "completed" ? (
                                            <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>
                                                        Printer tujuan: {selectedPrinter?.name || "Belum dipilih"}
                                                    </span>
                                                    <span>
                                                        {selectedPrinter?.device_type || "printer"}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQueueDispatch(ticket.id)}
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
                                                >
                                                    <IconPrinter size={16} />
                                                    Masuk Antrean Printer
                                                </button>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDispatch(ticket.id)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                                                    >
                                                        <IconCheck size={16} />
                                                        Berhasil
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDispatchFailed(ticket.id)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700"
                                                    >
                                                        <IconRefresh size={16} />
                                                        Gagal
                                                    </button>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                                    Printer tidak mengubah tampilan papan antrean. Gunakan hanya saat ingin mengantrekan cetak atau menandai hasil cetak.
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Belum ada stasiun dapur aktif untuk outlet ini.
                    </div>
                )}
            </div>
        </>
    );
}

KitchenIndex.layout = (page) =>
    page.props?.auth?.user?.preferred_workspace === "kitchen" ? (
        <KitchenLayout children={page} />
    ) : (
        <DashboardLayout children={page} />
    );
