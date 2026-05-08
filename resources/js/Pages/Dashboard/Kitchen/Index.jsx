import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import {
    IconCheck,
    IconChefHat,
    IconClockHour4,
    IconDeviceDesktop,
    IconDeviceIpad,
    IconPrinter,
    IconReceipt2,
    IconRefresh,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

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
    boardMode = null,
}) {
    const { flash, activeOutlet } = usePage().props;
    const [boardState, setBoardState] = useState({
        activeStation,
        tickets,
        refreshMeta,
        filters: filters || { status: "active" },
        selectedDevice,
        boardMode: boardMode || {
            device_type: "screen",
            interactive: true,
        },
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    useEffect(() => {
        setBoardState({
            activeStation,
            tickets,
            refreshMeta,
            filters: filters || { status: "active" },
            selectedDevice,
            boardMode: boardMode || {
                device_type: "screen",
                interactive: true,
            },
        });
    }, [activeStation, tickets, refreshMeta, filters, selectedDevice, boardMode]);

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
        if (!boardState.selectedDevice?.id) {
            toast.error("Pilih device dapur aktif terlebih dahulu.");
            return;
        }

        router.post(
            route("kitchen.tickets.dispatch", ticketId),
            {
                device_id: boardState.selectedDevice.id,
            },
            {
                preserveScroll: true,
            }
        );
    };

    const handleRefresh = () => {
        fetchBoardData(boardState.filters?.status || "active");
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
            console.error("Failed to refresh kitchen board", error);
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
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            }
        );
    };

    const applyDevice = (deviceId) => {
        if (!boardState.activeStation?.slug) {
            return;
        }

        router.get(
            route("kitchen.show", boardState.activeStation.slug),
            {
                status: selectedStatus,
                device_id: deviceId,
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
    const currentDevice = boardState.selectedDevice;
    const boardModeState = boardState.boardMode || {
        device_type: "screen",
        interactive: true,
    };

    return (
        <>
            <Head title="Kitchen Display" />

            <div className="space-y-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Kitchen Display
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Antrian dapur per station untuk outlet aktif.
                        </p>
                        {activeOutlet?.name && (
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                                Outlet aktif: {activeOutlet.name}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Auto refresh {refreshMeta?.interval_seconds || 15} detik
                        </p>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconRefresh size={16} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {stations.map((station) => {
                        const isActive = selectedStation?.id === station.id;

                        return (
                            <Link
                                key={station.id}
                                href={route("kitchen.show", {
                                    stationSlug: station.slug,
                                    status: selectedStatus,
                                    device_id: station.devices?.find((device) => device.is_primary)?.id,
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
                                        Pending: {station.pending_count}
                                    </span>
                                    <span className="text-sky-600 dark:text-sky-400">
                                        Diproses: {station.acknowledged_count}
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
                                        {selectedTickets.length} ticket aktif untuk station ini.
                                    </p>
                                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                                        Mode {boardModeState.device_type}
                                        {currentDevice?.name ? ` • ${currentDevice.name}` : ""}
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
                                { value: "pending", label: "Pending" },
                                { value: "acknowledged", label: "Diproses" },
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

                        {Array.isArray(selectedStation.devices) && selectedStation.devices.length > 0 && (
                            <div className="mb-5 flex flex-wrap gap-2">
                                {selectedStation.devices.map((device) => (
                                    <button
                                        type="button"
                                        key={device.id}
                                        onClick={() => applyDevice(device.id)}
                                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                                            currentDevice?.id === device.id
                                                ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-300"
                                                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300"
                                        }`}
                                    >
                                        {deviceIcon(device.device_type)}
                                        <span className="font-medium">{device.name}</span>
                                        <span className="text-slate-400">
                                            {device.device_type}
                                        </span>
                                        {device.is_primary && (
                                            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                                                Primary
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedTickets.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Belum ada ticket aktif untuk station ini.
                            </div>
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                {selectedTickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className={`rounded-2xl border p-4 dark:border-slate-800 ${
                                            boardModeState.device_type === "printer"
                                                ? "border-dashed border-slate-300 bg-white dark:bg-slate-950"
                                                : "border-slate-200 bg-slate-50 dark:bg-slate-950/40"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    {ticket.ticket_number}
                                                </p>
                                                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                                    {ticket.invoice || "Tanpa nota"}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {ticket.customer_name || "Walk-in customer"}
                                                </p>
                                            </div>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    ticket.status === "pending"
                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                                        : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                                                }`}
                                            >
                                                {ticket.status === "pending" ? "Pending" : "Diproses"}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <IconClockHour4 size={16} />
                                            <span>Masuk {formatTime(ticket.fired_at)}</span>
                                        </div>

                                        {ticket.dispatch?.dispatched_at && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                {deviceIcon(ticket.dispatch.device_type || "printer")}
                                                <span>
                                                    Dispatch {formatTime(ticket.dispatch.dispatched_at)}
                                                    {ticket.dispatch.device_name
                                                        ? ` • ${ticket.dispatch.device_name}`
                                                        : ""}
                                                </span>
                                            </div>
                                        )}

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

                                        {boardModeState.interactive ? (
                                            <div className="mt-4 flex gap-2">
                                                {ticket.status === "pending" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAcknowledge(ticket.id)}
                                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"
                                                    >
                                                        <IconChefHat size={16} />
                                                        Ambil Ticket
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleComplete(ticket.id)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                                                >
                                                    <IconCheck size={16} />
                                                    Selesai
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mt-4 space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDispatch(ticket.id)}
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                                                >
                                                    <IconPrinter size={16} />
                                                    Tandai Dispatch ke Printer
                                                </button>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                                    Mode printer: ticket ditampilkan sebagai antrian cetak. Dispatch dicatat per device aktif.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Belum ada station dapur aktif untuk outlet ini.
                    </div>
                )}
            </div>
        </>
    );
}

KitchenIndex.layout = (page) => <DashboardLayout children={page} />;
