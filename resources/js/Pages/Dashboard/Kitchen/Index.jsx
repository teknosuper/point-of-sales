import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import KitchenTicketPreview from "@/Components/Dashboard/KitchenTicketPreview";
import Modal from "@/Components/Dashboard/Modal";
import SoundTestPanel from "@/Components/Dashboard/SoundTestPanel";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
    IconCheck,
    IconChefHat,
    IconChevronDown,
    IconChevronUp,
    IconClockHour4,
    IconCopy,
    IconDeviceDesktop,
    IconDeviceIpad,
    IconEye,
    IconExternalLink,
    IconFilter,
    IconInfoCircle,
    IconMaximize,
    IconMinimize,
    IconPrinter,
    IconReceipt2,
    IconRefresh,
    IconSearch,
    IconX,
} from "@/Utils/icons";
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

const ticketItemStatusMeta = {
    pending: {
        label: "Menunggu",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    },
    acknowledged: {
        label: "Diproses",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    },
    completed: {
        label: "Siap Antar",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    },
};

const kitchenServiceStatusMeta = {
    ready: {
        label: "Siap Antar",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    },
    picked_up: {
        label: "Sedang Dibawa",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    },
    delivered: {
        label: "Sudah Diserahkan",
        badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
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

const formatOrderLocation = (ticket) => {
    if (ticket?.order_type === "dine_in") {
        if (ticket?.table_name && ticket?.table_code) {
            return `${ticket.table_code} - ${ticket.table_name}`;
        }

        return ticket?.table_name || ticket?.table_code || "Meja belum dipilih";
    }

    return "Ambil sendiri / takeaway";
};

const normalizeKitchenServiceStatus = (item) => {
    if (item?.resolved_service_status) {
        return item.resolved_service_status;
    }

    if (item?.service_status) {
        return item.service_status;
    }

    if (item?.status === "completed") {
        return "ready";
    }

    return "pending";
};

const resolveKitchenItemBadge = (item) => {
    if (item?.status === "completed") {
        return (
            kitchenServiceStatusMeta[normalizeKitchenServiceStatus(item)] ||
            kitchenServiceStatusMeta.ready
        );
    }

    return ticketItemStatusMeta[item?.status] || ticketItemStatusMeta.pending;
};

const summarizeKitchenTicketProgress = (ticket) => {
    const items = ticket?.items || [];
    const totalItems = items.length;
    const readyItems = items.filter(
        (item) => item.status === "completed" && normalizeKitchenServiceStatus(item) !== "delivered"
    ).length;
    const deliveredItems = items.filter(
        (item) => normalizeKitchenServiceStatus(item) === "delivered"
    ).length;
    const processingItems = items.filter((item) =>
        ["pending", "acknowledged"].includes(item.status)
    ).length;

    return {
        totalItems,
        readyItems,
        deliveredItems,
        processingItems,
    };
};

const resolveKitchenTicketStatusMeta = (ticket) => {
    const baseMeta =
        ticketStatusMeta[ticket?.status] || ticketStatusMeta.pending;
    const { totalItems, readyItems, deliveredItems, processingItems } =
        summarizeKitchenTicketProgress(ticket);

    if (totalItems <= 0) {
        return baseMeta;
    }

    if (ticket?.status === "acknowledged" && readyItems > 0 && processingItems > 0) {
        return {
            label: "Parsial Siap",
            badge: "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/40",
        };
    }

    if (ticket?.status === "ready" && deliveredItems > 0 && deliveredItems < totalItems) {
        return {
            label: "Parsial Diserahkan",
            badge: "bg-violet-100 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900/40",
        };
    }

    return baseMeta;
};

const kitchenPrintStatusMeta = (ticket) => {
    const status = ticket?.print?.status || "not_printed";

    return (
        {
            not_printed: {
                label: "Belum tercetak",
                badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            },
            queued: {
                label: "Menunggu cetak",
                badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
            },
            reprint_queued: {
                label: "Cetak ulang antre",
                badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
            },
            failed: {
                label: "Cetak gagal",
                badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
            },
            printed: {
                label: "Sudah tercetak",
                badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
            },
        }[status] || {
            label: "Belum tercetak",
            badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        }
    );
};

const kitchenPrintSummaryLabel = (ticket) => {
    const successJobs = Number(ticket?.print?.success_jobs || 0);

    if (successJobs <= 0) {
        return "Belum ada cetak sukses";
    }

    if (successJobs === 1) {
        return "Tercetak 1x";
    }

    return `Tercetak 1x • Cetak ulang ${successJobs - 1}x`;
};

const kitchenPrintTimeMeta = (ticket) => {
    const successJobs = Number(ticket?.print?.success_jobs || 0);
    const firstPrintedAt = ticket?.print?.first_printed_at;
    const lastPrintedAt = ticket?.print?.last_printed_at;

    if (successJobs <= 0 || !firstPrintedAt) {
        return null;
    }

    if (successJobs === 1) {
        return {
            primary: `Cetak pertama: ${formatDateTime(firstPrintedAt)}`,
            secondary: null,
        };
    }

    return {
        primary: `Cetak pertama: ${formatDateTime(firstPrintedAt)}`,
        secondary: `Cetak ulang terakhir: ${formatDateTime(
            lastPrintedAt || firstPrintedAt
        )}`,
    };
};

const kitchenProgressLabel = (ticket) => {
    const { totalItems, readyItems, deliveredItems, processingItems } =
        summarizeKitchenTicketProgress(ticket);

    if (totalItems === 0) {
        return null;
    }

    if (deliveredItems > 0 && deliveredItems < totalItems) {
        return `${deliveredItems}/${totalItems} item sudah diserahkan`;
    }

    if (readyItems > 0 && processingItems > 0) {
        return `${readyItems}/${totalItems} item siap antar`;
    }

    if (ticket?.status === "ready") {
        return `${readyItems}/${totalItems} item siap antar`;
    }

    if (processingItems > 0) {
        return `${processingItems}/${totalItems} item masih diproses`;
    }

    return `${totalItems} item`;
};

const isKitchenItemSelectable = (item) =>
    ["pending", "acknowledged"].includes(item?.status) ||
    (item?.status === "completed" &&
        ["ready", "picked_up"].includes(normalizeKitchenServiceStatus(item)));

const kitchenItemSelectionLabel = (item) => {
    const serviceStatus = normalizeKitchenServiceStatus(item);

    if (["pending", "acknowledged"].includes(item?.status)) {
        return "Pilih untuk siap";
    }

    if (item?.status === "completed" && serviceStatus === "ready") {
        return "Pilih untuk diserahkan";
    }

    if (item?.status === "completed" && serviceStatus === "picked_up") {
        return "Sedang dibawa";
    }

    return "Final";
};

const countKitchenActionableItems = (ticket) => {
    const items = ticket?.items || [];

    return {
        readyToMark: items.filter((item) =>
            ["pending", "acknowledged"].includes(item.status)
        ).length,
        readyToDeliver: items.filter(
            (item) =>
                ["pending", "acknowledged"].includes(item.status) ||
                (item.status === "completed" &&
                    ["ready", "picked_up"].includes(
                        normalizeKitchenServiceStatus(item)
                    ))
        ).length,
    };
};

const countKitchenItemNotes = (ticket) =>
    (ticket?.items || []).filter((item) => Boolean(item?.notes)).length;

function KitchenTicketSummaryDetail({ ticket }) {
    if (!ticket) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Waktu
                    </p>
                    <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-start gap-2">
                            <IconClockHour4 size={14} className="mt-0.5 shrink-0" />
                            <span>Masuk {formatDateTime(ticket.fired_at)}</span>
                        </div>
                        {ticket.acknowledged_at ? (
                            <div className="flex items-start gap-2">
                                <IconChefHat size={14} className="mt-0.5 shrink-0" />
                                <span>Proses {formatDateTime(ticket.acknowledged_at)}</span>
                            </div>
                        ) : null}
                        {ticket.ready_at ? (
                            <div className="flex items-start gap-2">
                                <IconCheck size={14} className="mt-0.5 shrink-0" />
                                <span>Siap {formatDateTime(ticket.ready_at)}</span>
                            </div>
                        ) : null}
                        {ticket.completed_at ? (
                            <div className="flex items-start gap-2">
                                <IconCheck size={14} className="mt-0.5 shrink-0" />
                                <span>Diserahkan {formatDateTime(ticket.completed_at)}</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Detail Order
                    </p>
                    <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {kitchenProgressLabel(ticket) ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                {kitchenProgressLabel(ticket)}
                            </div>
                        ) : null}
                        <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                Jenis:
                            </span>{" "}
                            {ticket.order_type_label || "Bawa Pulang"}
                        </div>
                        <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                Lokasi:
                            </span>{" "}
                            {formatOrderLocation(ticket)}
                        </div>
                        <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                Pelanggan:
                            </span>{" "}
                            {ticket.customer_name || "Pelanggan umum"}
                        </div>
                        <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                No. HP:
                            </span>{" "}
                            {ticket.customer_phone || "-"}
                        </div>
                        {ticket.notes ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                {ticket.notes}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

function KitchenTicketItemsDetail({
    ticket,
    selectedItemIds = [],
    selectionMode = null,
    setSelectedItems,
    toggleItemSelection,
}) {
    if (!ticket) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <button
                    type="button"
                    onClick={() =>
                        setSelectedItems(
                            ticket.id,
                            ticket.status === "ready"
                                ? resolveEligibleKitchenDeliveredItemIds(ticket)
                                : resolveEligibleKitchenItemIds(ticket, ["pending", "acknowledged"])
                        )
                    }
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                    Pilih item aktif
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedItems(ticket.id, [])}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                >
                    Kosongkan pilihan
                </button>
                <span className="text-slate-400 dark:text-slate-500">
                    {selectedItemIds.length} item dipilih
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                    Hanya item aktif yang bisa dicentang
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                    Pilihan beda aksi akan diganti otomatis
                </span>
                {selectionMode ? (
                    <span
                        className={`rounded-full px-2.5 py-1 font-semibold ${
                            selectionMode === "ready"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                        }`}
                    >
                        Mode: {selectionMode === "ready" ? "Tandai Siap" : "Antar / Serahkan"}
                    </span>
                ) : null}
            </div>

            <div className="space-y-2">
                {ticket.items.map((item) => (
                    <div
                        key={`detail-item-${ticket.id}-${item.id}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="break-words font-medium text-slate-900 dark:text-white">
                                        {item.product_title}
                                    </p>
                                    <span
                                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                            resolveKitchenItemBadge(item).badge
                                        }`}
                                    >
                                        {resolveKitchenItemBadge(item).label}
                                    </span>
                                </div>
                                {item.notes ? (
                                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                        {item.notes}
                                    </p>
                                ) : null}
                                {item.ready_at || item.completed_at ? (
                                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                        Siap: {formatDateTime(item.ready_at || item.completed_at)}
                                    </p>
                                ) : null}
                                {item.picked_up_at ? (
                                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                        Dibawa: {formatDateTime(item.picked_up_at)}
                                    </p>
                                ) : null}
                                {item.delivered_at ? (
                                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                        Diserahkan: {formatDateTime(item.delivered_at)}
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex shrink-0 items-start gap-3">
                                <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                    x{item.qty}
                                </span>
                                <div
                                    className={`min-w-[112px] rounded-2xl border px-2.5 py-2 text-center ${
                                        isKitchenItemSelectable(item)
                                            ? kitchenActionGroupForItem(item) === "ready"
                                                ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/30"
                                                : "border-violet-300 bg-violet-50 shadow-sm dark:border-violet-700 dark:bg-violet-950/30"
                                            : "border-slate-200 bg-white opacity-75 dark:border-slate-700 dark:bg-slate-900/60"
                                    }`}
                                >
                                    {isKitchenItemSelectable(item) ? (
                                        <label
                                            className={`flex cursor-pointer items-center justify-center gap-2 text-[11px] font-semibold ${
                                                kitchenActionGroupForItem(item) === "ready"
                                                    ? "text-emerald-700 dark:text-emerald-300"
                                                    : "text-violet-700 dark:text-violet-300"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.includes(item.id)}
                                                onChange={() => toggleItemSelection(ticket.id, item.id)}
                                                className={`h-5 w-5 rounded-md border-2 focus:ring-2 ${
                                                    kitchenActionGroupForItem(item) === "ready"
                                                        ? "border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                                                        : "border-violet-400 text-violet-600 focus:ring-violet-500"
                                                }`}
                                            />
                                            <span>{kitchenItemSelectionLabel(item)}</span>
                                        </label>
                                    ) : (
                                        <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                            {kitchenItemSelectionLabel(item)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const kitchenActionGroupForItem = (item) => {
    if (["pending", "acknowledged"].includes(item?.status)) {
        return "ready";
    }

    if (
        item?.status === "completed" &&
        ["ready", "picked_up"].includes(normalizeKitchenServiceStatus(item))
    ) {
        return "deliver";
    }

    return null;
};

const resolveKitchenSelectionMode = (ticket, selectedItemIds = []) => {
    const selectedItems = (ticket?.items || []).filter((item) =>
        selectedItemIds.map(Number).includes(Number(item.id))
    );

    const groups = selectedItems
        .map((item) => kitchenActionGroupForItem(item))
        .filter(Boolean);

    if (groups.length === 0) {
        return null;
    }

    return groups[0] || null;
};

const resolveKitchenSelectionState = (ticket, selectedItemIds = []) => {
    const items = (ticket?.items || []).filter((item) =>
        selectedItemIds.map(Number).includes(Number(item.id))
    );

    const readyToMark = items.filter((item) =>
        ["pending", "acknowledged"].includes(item.status)
    ).length;
    const readyToDeliver = items.filter(
        (item) =>
            item.status === "completed" &&
            ["ready", "picked_up"].includes(normalizeKitchenServiceStatus(item))
    ).length;

    return {
        totalSelected: items.length,
        readyToMark,
        readyToDeliver,
        hasMixedAction:
            readyToMark > 0 && readyToDeliver > 0,
    };
};

const reconcileSelectedItemsByTicket = (currentSelections = {}, ticketList = []) => {
    const nextSelections = {};

    Object.entries(currentSelections).forEach(([ticketId, selectedIds]) => {
        const ticket = ticketList.find(
            (candidate) => Number(candidate.id) === Number(ticketId)
        );

        if (!ticket) {
            return;
        }

        const selectedItems = (ticket.items || []).filter((item) =>
            (selectedIds || []).map(Number).includes(Number(item.id))
        );
        const actionableItems = selectedItems.filter((item) =>
            isKitchenItemSelectable(item)
        );

        if (actionableItems.length === 0) {
            return;
        }

        const targetGroup = kitchenActionGroupForItem(actionableItems[0]);
        const normalizedIds = actionableItems
            .filter((item) => kitchenActionGroupForItem(item) === targetGroup)
            .map((item) => Number(item.id));

        if (normalizedIds.length > 0) {
            nextSelections[ticketId] = normalizedIds;
        }
    });

    return nextSelections;
};

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
    const { flash, activeOutlet, printClient } = usePage().props;
    const [isFullscreenActive, setIsFullscreenActive] = useState(false);
    const [selectedPrinterId, setSelectedPrinterId] = useState(null);
    const [showPageHeader, setShowPageHeader] = useState(false);
    const [showStationControls, setShowStationControls] = useState(false);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [showSoundTestPanel, setShowSoundTestPanel] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showPrinterLinkModal, setShowPrinterLinkModal] = useState(false);
    const [ticketDetailModal, setTicketDetailModal] = useState(null);
    const [ticketDetailTab, setTicketDetailTab] = useState("items");
    const [printerLinkDevice, setPrinterLinkDevice] = useState(null);
    const [previewTicket, setPreviewTicket] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedItemIdsByTicket, setSelectedItemIdsByTicket] = useState({});
    const [submittingActionByTicket, setSubmittingActionByTicket] = useState({});
    const [boardState, setBoardState] = useState(
        buildBoardState({ activeStation, tickets, refreshMeta, filters, selectedDevice })
    );
    const [draftFilters, setDraftFilters] = useState(() =>
        buildBoardFilters(filters, selectedDevice)
    );
    const audioContextRef = useRef(null);
    const audioRef = useRef(null);
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
        setSelectedItemIdsByTicket((current) =>
            reconcileSelectedItemsByTicket(current, nextBoardState.tickets?.data || [])
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

    // Audio unlock handler - sounds now come from database
    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const markAudioUnlocked = () => {
            audioUnlockedRef.current = true;
        };

        window.addEventListener("pointerdown", markAudioUnlocked, { once: true });
        window.addEventListener("keydown", markAudioUnlocked, { once: true });

        return () => {
            window.removeEventListener("pointerdown", markAudioUnlocked);
            window.removeEventListener("keydown", markAudioUnlocked);
        };
    }, []);

    // playNotificationSound - now uses database sounds via KitchenNotificationProvider

    const findTicketById = (ticketId) =>
        (boardState.tickets?.data || []).find((ticket) => ticket.id === ticketId) || null;

    const setSelectedItems = (ticketId, itemIds) => {
        setSelectedItemIdsByTicket((current) => ({
            ...current,
            [ticketId]: itemIds.map(Number),
        }));
    };

    const toggleItemSelection = (ticketId, itemId) => {
        setSelectedItemIdsByTicket((current) => {
            const ticket = findTicketById(ticketId);
            const targetItem = (ticket?.items || []).find(
                (item) => Number(item.id) === Number(itemId)
            );
            const targetGroup = kitchenActionGroupForItem(targetItem);
            const currentSelectedIds = (current[ticketId] || []).map(Number);
            const next = new Set(
                currentSelectedIds.filter((selectedId) => {
                    const selectedItem = (ticket?.items || []).find(
                        (item) => Number(item.id) === Number(selectedId)
                    );

                    return kitchenActionGroupForItem(selectedItem) === targetGroup;
                })
            );

            if (next.has(Number(itemId))) {
                next.delete(Number(itemId));
            } else {
                next.add(Number(itemId));
            }

            return {
                ...current,
                [ticketId]: Array.from(next),
            };
        });
    };

    const resolveEligibleKitchenItemIds = (ticket, allowedStatuses = []) =>
        (ticket?.items || [])
            .filter((item) => allowedStatuses.includes(item.status))
            .map((item) => Number(item.id));

const resolveEligibleKitchenDeliveredItemIds = (ticket) =>
    (ticket?.items || [])
        .filter(
            (item) =>
                ["pending", "acknowledged"].includes(item.status) ||
                (item.status === "completed" &&
                    ["ready", "picked_up"].includes(
                        normalizeKitchenServiceStatus(item)
                    ))
        )
        .map((item) => Number(item.id));

    const resolveSelectedKitchenActionItemIds = (ticket, allowedStatuses = []) => {
        const eligibleItemIds = resolveEligibleKitchenItemIds(ticket, allowedStatuses);
        const selectedItemIds = (selectedItemIdsByTicket[ticket?.id] || [])
            .map(Number)
            .filter((itemId) => eligibleItemIds.includes(itemId));

        return selectedItemIds.length > 0 ? selectedItemIds : eligibleItemIds;
    };

    const confirmTicketAction = async ({
        ticketId,
        title,
        text,
        confirmButtonText,
        icon = "warning",
        itemIds = [],
        itemSectionTitle = "Item terpilih",
    }) => {
        const ticket = findTicketById(ticketId);
        const selectedItems = (ticket?.items || []).filter((item) =>
            itemIds.includes(Number(item.id))
        );
        const detailRows = [
            ticket?.ticket_number
                ? `<div><strong>Tiket:</strong> ${ticket.ticket_number}</div>`
                : "",
            ticket?.invoice
                ? `<div><strong>Nota:</strong> ${ticket.invoice}</div>`
                : "",
            `<div><strong>Pelanggan:</strong> ${ticket?.customer_name || "Pelanggan umum"}</div>`,
            `<div><strong>Jenis:</strong> ${ticket?.order_type_label || "Bawa Pulang"}</div>`,
            `<div><strong>Item:</strong> ${(ticket?.items || []).length} menu</div>`,
        ]
            .filter(Boolean)
            .join("");
        const selectedItemRows = selectedItems
            .map(
                (item) =>
                    `<div class="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2">
                        <div class="min-w-0 text-left">
                            <div class="font-medium text-slate-800">${item.product_title}</div>
                            ${item.notes ? `<div class="mt-1 text-xs text-slate-500">${item.notes}</div>` : ""}
                        </div>
                        <div class="shrink-0 text-xs font-semibold text-slate-600">x${item.qty}</div>
                    </div>`
            )
            .join("");

        const result = await Swal.fire({
            title,
            text,
            icon,
            html:
                detailRows || selectedItemRows
                    ? `<div class="space-y-4 text-left text-sm text-slate-600">
                        ${detailRows ? `<div class="space-y-2">${detailRows}</div>` : ""}
                        ${
                            selectedItemRows
                                ? `<div class="space-y-2">
                                    <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">${itemSectionTitle}</div>
                                    <div class="space-y-2">${selectedItemRows}</div>
                                   </div>`
                                : ""
                        }
                    </div>`
                    : undefined,
            showCancelButton: true,
            confirmButtonText,
            cancelButtonText: "Batal",
            reverseButtons: true,
            focusCancel: true,
            customClass: {
                popup: "rounded-3xl",
                confirmButton:
                    "rounded-2xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white",
                cancelButton:
                    "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700",
            },
            buttonsStyling: false,
        });

        return result.isConfirmed;
    };

    const handleAcknowledge = async (ticketId) => {
        if (submittingActionByTicket[ticketId]) {
            return;
        }

        if ((boardState.activeStation?.processing_mode || "auto") === "manual") {
            const confirmed = await confirmTicketAction({
                ticketId,
                title: "Mulai proses ticket ini?",
                text: "Gunakan aksi ini saat dapur benar-benar mulai mengerjakan pesanan.",
                confirmButtonText: "Ya, mulai proses",
                icon: "question",
            });

            if (!confirmed) {
                return;
            }
        }

        setSubmittingActionByTicket((current) => ({
            ...current,
            [ticketId]: true,
        }));
        router.post(route("kitchen.tickets.acknowledge", ticketId), {}, {
            preserveScroll: true,
            onFinish: () =>
                setSubmittingActionByTicket((current) => ({
                    ...current,
                    [ticketId]: false,
                })),
        });
    };

    const handleComplete = async (ticketId) => {
        if (submittingActionByTicket[ticketId]) {
            return;
        }

        const ticket = findTicketById(ticketId);
        const selectedItemIds = (selectedItemIdsByTicket[ticketId] || []).map(Number);
        const selectionState = resolveKitchenSelectionState(ticket, selectedItemIds);
        const itemIds =
            selectionState.totalSelected > 0
                ? selectedItemIds.filter((itemId) =>
                      resolveEligibleKitchenItemIds(ticket, ["pending", "acknowledged"]).includes(itemId)
                  )
                : resolveSelectedKitchenActionItemIds(ticket, ["pending", "acknowledged"]);

        if (itemIds.length === 0) {
            toast.error("Tidak ada item aktif yang bisa ditandai siap.");
            return;
        }

        if (selectionState.hasMixedAction) {
            toast.error("Pilihan item bercampur. Pilih hanya item yang masih diproses untuk aksi ini.");
            return;
        }

        const confirmed = await confirmTicketAction({
            ticketId,
            title: "Tandai pesanan sudah siap?",
            text: "Status ticket akan dipindahkan ke siap diantar atau diambil.",
            confirmButtonText: "Ya, tandai siap",
            itemIds,
            itemSectionTitle: "Item yang akan ditandai siap",
        });

        if (!confirmed) {
            return;
        }

        setSubmittingActionByTicket((current) => ({
            ...current,
            [ticketId]: true,
        }));
        router.post(
            route("kitchen.tickets.complete", ticketId),
            { item_ids: itemIds },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedItems(ticketId, []),
                onFinish: () =>
                    setSubmittingActionByTicket((current) => ({
                        ...current,
                        [ticketId]: false,
                    })),
            }
        );
    };

    const handleDeliver = async (ticketId) => {
        if (submittingActionByTicket[ticketId]) {
            return;
        }

        const ticket = findTicketById(ticketId);
        const selectedItemIds = (selectedItemIdsByTicket[ticketId] || []).map(Number);
        const selectionState = resolveKitchenSelectionState(ticket, selectedItemIds);
        const itemIds = (() => {
            const eligibleItemIds = resolveEligibleKitchenDeliveredItemIds(ticket);
            const filteredSelectedItemIds = selectedItemIds
                .filter((itemId) => eligibleItemIds.includes(itemId));

            return filteredSelectedItemIds.length > 0 ? filteredSelectedItemIds : eligibleItemIds;
        })();

        if (itemIds.length === 0) {
            toast.error("Tidak ada item yang bisa langsung ditandai diserahkan.");
            return;
        }

        const confirmed = await confirmTicketAction({
            ticketId,
            title: "Tandai pesanan sudah diserahkan?",
            text: "Item yang belum ditandai siap akan otomatis diproses sebagai siap lalu langsung diserahkan.",
            confirmButtonText: "Ya, sudah diserahkan",
            itemIds,
            itemSectionTitle: "Item yang akan ditandai diserahkan",
        });

        if (!confirmed) {
            return;
        }

        setSubmittingActionByTicket((current) => ({
            ...current,
            [ticketId]: true,
        }));
        router.post(
            route("kitchen.tickets.deliver", ticketId),
            { item_ids: itemIds },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedItems(ticketId, []),
                onFinish: () =>
                    setSubmittingActionByTicket((current) => ({
                        ...current,
                        [ticketId]: false,
                    })),
            }
        );
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

    const handlePreview = (ticket) => {
        setPreviewTicket(ticket);
        setShowPreviewModal(true);
    };

    const buildKitchenPrintClientUrl = (station) => {
        if (!station?.id) {
            return "";
        }

        const fallbackBaseUrl =
            typeof window !== "undefined"
                ? window.location.origin
                : "";
        const baseUrl = printClient?.base_url || fallbackBaseUrl;
        const version = printClient?.version || "latest";
        const token = printClient?.token || "0000";
        const outletId = Number(printClient?.outlet_id || activeOutlet?.id || 0);

        const params = new URLSearchParams({
            v: version,
            base_url: baseUrl,
            token,
            outlet_id: String(outletId),
            type: "kitchen",
            station_id: String(station.id),
            autostart: "1",
        });

        return `${baseUrl}/print-client.html?${params.toString()}`;
    };

    const handleOpenPrinterLinkModal = (device) => {
        setSelectedPrinterId(device.id);
        setPrinterLinkDevice(device);
        setShowPrinterLinkModal(true);
    };

    const handleCopyPrinterLink = async () => {
        const printClientUrl = buildKitchenPrintClientUrl(selectedStation);

        if (!printClientUrl) {
            toast.error("Link print client belum tersedia.");
            return;
        }

        try {
            await navigator.clipboard.writeText(printClientUrl);
            toast.success("Link print client berhasil disalin.");
        } catch (error) {
            toast.error("Gagal menyalin link print client.");
        }
    };

    const handleOpenPrinterLink = () => {
        const printClientUrl = buildKitchenPrintClientUrl(selectedStation);

        if (!printClientUrl) {
            toast.error("Link print client belum tersedia.");
            return;
        }

        window.open(printClientUrl, "_blank", "noopener,noreferrer");
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
            setSelectedItemIdsByTicket((current) =>
                reconcileSelectedItemsByTicket(current, payload.tickets?.data || [])
            );
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
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-slate-900 dark:text-white">
                                {kioskMode ? "Antrean Dapur" : "Layar Dapur"}
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {selectedStation?.name || "Pilih station dapur"} • {ticketMeta.total || 0} tiket
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPageHeader((current) => !current)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                            {showPageHeader ? "Sembunyikan header" : "Buka header"}
                            {showPageHeader ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                        </button>
                    </div>

                    {showPageHeader ? (
                        <div
                            className={`mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 ${
                                kioskMode ? "lg:border-0 lg:pt-0" : ""
                            }`}
                        >
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pantau tiket dapur dan selesaikan pesanan yang sedang berjalan.
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
                                    onClick={() => setShowSoundTestPanel((current) => !current)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    🔊 Testing Suara
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
                    ) : null}
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
                                <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline">
                                    {(selectedStation.processing_mode || "auto") === "manual"
                                        ? "Ticket menunggu perlu diklik dan dikonfirmasi sebelum masuk proses."
                                        : "Ticket menunggu akan otomatis masuk ke status diproses saat board aktif."}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowStationControls((current) => !current)}
                                    className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                >
                                    <IconFilter size={14} />
                                    {showStationControls ? "Sembunyikan kontrol" : "Buka kontrol"}
                                    {showStationControls ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                </button>
                            </div>

                            {showStationControls && (selectedStation.processing_mode || "auto") === "manual" ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 md:px-4 md:py-3 md:text-xs">
                                    Station ini sedang memakai mode manual. Ticket baru tidak akan otomatis diproses sampai tombol
                                    <span className="mx-1 font-semibold">Mulai Proses</span>
                                    ditekan.
                                </div>
                            ) : null}

                            {showStationControls ? (
                            <div className="space-y-2">
                                <div className="-mx-1 overflow-x-auto pb-1">
                                    <div className="flex w-max min-w-full items-center gap-2 px-1">
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
                                                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                    selectedStatus === option.value
                                                        ? "bg-primary-600 text-white"
                                                        : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                }`}
                                            >
                                                {option.label} ({option.count})
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvancedFilter((current) => !current)}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        <IconFilter size={14} />
                                        {showAdvancedFilter ? "Sembunyikan filter" : "Buka filter"}
                                        {showAdvancedFilter ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                    </button>
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
                            ) : (
                                <div className="text-xs text-slate-400 dark:text-slate-500">
                                    Filter status, urutan tiket, dan kontrol mode disembunyikan agar area daftar pesanan lebih luas.
                                </div>
                            )}
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
                                                onClick={() => handleOpenPrinterLinkModal(device)}
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
                                <div className="space-y-3 md:hidden">
                                    {selectedTickets.map((ticket) => (
                                        <div
                                            key={`mobile-${ticket.id}`}
                                            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            {(() => {
                                                const actionCounts = countKitchenActionableItems(ticket);
                                                const selectedIds = (selectedItemIdsByTicket[ticket.id] || []).map(Number);
                                                const selectionState = resolveKitchenSelectionState(ticket, selectedIds);
                                                const selectionMode = resolveKitchenSelectionMode(ticket, selectedIds);
                                                const canMarkReady =
                                                    selectionState.totalSelected > 0
                                                        ? selectionState.readyToMark > 0 &&
                                                          !selectionState.hasMixedAction &&
                                                          selectionState.readyToDeliver === 0
                                                        : actionCounts.readyToMark > 0;
                                                const canDeliver =
                                                    selectionState.totalSelected > 0
                                                        ? selectionState.readyToDeliver > 0
                                                        : actionCounts.readyToDeliver > 0;
                                                const actionBusy = Boolean(
                                                    submittingActionByTicket[ticket.id]
                                                );
                                                const readyButtonClass =
                                                    selectionMode === "ready"
                                                        ? "bg-emerald-700 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                                                        : selectionMode === "deliver"
                                                          ? "bg-emerald-500/70"
                                                          : "bg-emerald-600";
                                                const deliverButtonClass =
                                                    selectionMode === "deliver"
                                                        ? "bg-violet-700 ring-2 ring-violet-200 dark:ring-violet-900/40"
                                                        : selectionMode === "ready"
                                                          ? "bg-violet-500/70"
                                                          : "bg-violet-600";

                                                return (
                                                    <>
                                            {(() => {
                                                const ticketStatus = resolveKitchenTicketStatusMeta(ticket);
                                                const printStatus = kitchenPrintStatusMeta(ticket);
                                                const printTimeMeta = kitchenPrintTimeMeta(ticket);

                                                return (
                                            <div className="flex items-start justify-between gap-2.5">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                        {ticket.ticket_number}
                                                    </p>
                                                    <p className="mt-0.5 break-words text-sm font-semibold text-slate-900 dark:text-white">
                                                        {ticket.invoice || "Tanpa nomor nota"}
                                                    </p>
                                                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                                        {ticket.customer_name || "Pelanggan umum"}
                                                    </p>
                                                    {kitchenProgressLabel(ticket) ? (
                                                        <p className="mt-1.5 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                            {kitchenProgressLabel(ticket)}
                                                        </p>
                                                    ) : null}
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${printStatus.badge}`}
                                                        >
                                                            {printStatus.label}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {kitchenPrintSummaryLabel(ticket)}
                                                        </span>
                                                        {printTimeMeta ? (
                                                            <div className="mt-1 flex flex-col gap-1 text-[10px] leading-4">
                                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                    {printTimeMeta.primary}
                                                                </span>
                                                                {printTimeMeta.secondary ? (
                                                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                                                        {printTimeMeta.secondary}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                                        ticketStatus.badge
                                                    }`}
                                                >
                                                    {ticketStatus.label}
                                                </span>
                                            </div>
                                                );
                                            })()}

                                            <div className="mt-3 -mx-1 overflow-x-auto pb-1">
                                                <div className="flex w-max min-w-full gap-2 px-1">
                                                    <div className="w-[230px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                            Waktu
                                                        </p>
                                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-slate-900">
                                                                <IconClockHour4 size={14} className="mt-0.5 shrink-0" />
                                                                <span>Masuk {formatTime(ticket.fired_at)}</span>
                                                            </div>
                                                            {ticket.acknowledged_at ? (
                                                                <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-slate-900">
                                                                    <IconChefHat size={14} className="mt-0.5 shrink-0" />
                                                                    <span>Proses {formatTime(ticket.acknowledged_at)}</span>
                                                                </div>
                                                            ) : null}
                                                            {ticket.ready_at ? (
                                                                <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-slate-900">
                                                                    <IconCheck size={14} className="mt-0.5 shrink-0" />
                                                                    <span>Siap {formatTime(ticket.ready_at)}</span>
                                                                </div>
                                                            ) : null}
                                                            {ticket.completed_at ? (
                                                                <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-slate-900">
                                                                    <IconCheck size={14} className="mt-0.5 shrink-0" />
                                                                    <span>Serah {formatTime(ticket.completed_at)}</span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="w-[250px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                            Detail order
                                                        </p>
                                                        <div className="mt-1.5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                                            {kitchenProgressLabel(ticket) ? (
                                                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                                    {kitchenProgressLabel(ticket)}
                                                                </div>
                                                            ) : null}
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                                    {ticket.order_type_label || "Bawa Pulang"}
                                                                </span>
                                                                <span className="rounded-full bg-white px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                                    {formatOrderLocation(ticket)}
                                                                </span>
                                                            </div>
                                                            <div className="truncate">
                                                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                    Pelanggan:
                                                                </span>{" "}
                                                                {ticket.customer_name || "Pelanggan umum"}
                                                            </div>
                                                            {ticket.notes ? (
                                                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                                    Ada catatan pesanan. Buka detail untuk lihat isi lengkap.
                                                                </div>
                                                            ) : null}
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {(() => {
                                                                    const printStatus = kitchenPrintStatusMeta(ticket);

                                                                    return (
                                                                        <span
                                                                            className={`rounded-full px-2 py-1 font-semibold ${printStatus.badge}`}
                                                                        >
                                                                            {printStatus.label}
                                                                        </span>
                                                                    );
                                                                })()}
                                                                <span className="rounded-full bg-white px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                                    {kitchenPrintSummaryLabel(ticket)}
                                                                </span>
                                                                {(() => {
                                                                    const printTimeMeta = kitchenPrintTimeMeta(ticket);

                                                                    return printTimeMeta ? (
                                                                        <div className="flex flex-col gap-1 text-[11px] leading-4">
                                                                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                                {printTimeMeta.primary}
                                                                            </span>
                                                                            {printTimeMeta.secondary ? (
                                                                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                                                                    {printTimeMeta.secondary}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    Pesanan
                                                </p>
                                                <div className="mt-1.5 space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                            {ticket.items.length} item
                                                        </span>
                                                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                            {(selectedItemIdsByTicket[ticket.id] || []).length} dipilih
                                                        </span>
                                                        {countKitchenItemNotes(ticket) > 0 ? (
                                                            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                                {countKitchenItemNotes(ticket)} catatan
                                                            </span>
                                                        ) : null}
                                                        {selectionMode ? (
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 font-semibold ${
                                                                    selectionMode === "ready"
                                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                        : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                                                }`}
                                                            >
                                                                Mode: {selectionMode === "ready" ? "Tandai Siap" : "Antar / Serahkan"}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                        Lihat detail item, catatan, dan checklist aksi di popup agar tampilan tetap ringkas saat order banyak.
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTicketDetailModal(ticket);
                                                            setTicketDetailTab("items");
                                                        }}
                                                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                    >
                                                        <IconEye size={16} />
                                                        Detail Pesanan
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                {selectionMode ? (
                                                    <div
                                                        className={`col-span-2 rounded-xl border px-3 py-1.5 text-center text-[11px] font-semibold ${
                                                            selectionMode === "ready"
                                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                                : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300"
                                                        }`}
                                                    >
                                                        Aksi aktif: {selectionMode === "ready" ? "Tandai Item Siap" : "Antar / Serahkan Item"}
                                                    </div>
                                                ) : null}
                                                {ticket.status === "pending" &&
                                                (boardState.activeStation?.processing_mode || "auto") === "manual" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAcknowledge(ticket.id)}
                                                        disabled={actionBusy}
                                                        className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <IconChefHat size={14} />
                                                        Mulai Proses
                                                    </button>
                                                ) : null}

                                                <button
                                                    type="button"
                                                    onClick={() => handleComplete(ticket.id)}
                                                    disabled={!canMarkReady || actionBusy}
                                                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 ${readyButtonClass}`}
                                                >
                                                    <IconCheck size={14} />
                                                    Tandai Siap
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeliver(ticket.id)}
                                                    disabled={!canDeliver || actionBusy}
                                                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 ${deliverButtonClass}`}
                                                >
                                                    <IconCheck size={14} />
                                                    Antar / Serah
                                                </button>

                                                {printerDevices.length > 0 &&
                                                ticket.status !== "completed" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQueueDispatch(ticket.id)}
                                                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 text-xs font-semibold text-white transition hover:bg-primary-700"
                                                    >
                                                        <IconPrinter size={14} />
                                                        {Number(ticket?.print?.success_jobs || 0) > 0
                                                            ? "Cetak Ulang"
                                                            : "Kirim Print"}
                                                    </button>
                                                ) : null}

                                                <button
                                                    type="button"
                                                    onClick={() => handlePreview(ticket)}
                                                    className={`${printerDevices.length > 0 && ticket.status !== "completed" ? "" : "col-span-2"} inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
                                                >
                                                    <IconEye size={14} />
                                                    Preview
                                                </button>
                                            </div>
                                            <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                {selectionState.totalSelected > 0
                                                    ? selectionState.hasMixedAction
                                                        ? "Pilihan bercampur. Pilih hanya item diproses atau hanya item siap antar."
                                                        : selectionState.readyToDeliver > 0
                                                          ? `${selectionState.readyToDeliver} item terpilih siap diantar atau diserahkan sekarang.`
                                                          : selectionState.readyToMark > 0
                                                            ? `${selectionState.readyToMark} item terpilih siap ditandai siap antar.`
                                                            : "Pilihan saat ini tidak punya aksi yang bisa dijalankan."
                                                    : actionCounts.readyToDeliver > 0 &&
                                                        actionCounts.readyToMark > 0
                                                      ? `${actionCounts.readyToDeliver} item sudah bisa diantar sekarang, sementara ${actionCounts.readyToMark} item lain masih menunggu proses dapur.`
                                                      : actionCounts.readyToDeliver > 0
                                                        ? `${actionCounts.readyToDeliver} item sudah bisa diantar atau diserahkan sekarang.`
                                                        : actionCounts.readyToMark > 0
                                                          ? `${actionCounts.readyToMark} item masih menunggu ditandai siap antar.`
                                                          : "Semua item pada ticket ini sudah final."}
                                            </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 md:block">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                                            <thead className="bg-slate-50 dark:bg-slate-950/40">
                                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                                    <th className="px-4 py-3">Tiket</th>
                                                    <th className="px-4 py-3">Waktu</th>
                                                    <th className="px-4 py-3">Pesanan</th>
                                                    <th className="px-4 py-3">Detail Order</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3 text-right">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                                {selectedTickets.map((ticket) => (
                                                    <tr key={ticket.id} className="align-top">
                                                        {(() => {
                                                            const actionCounts = countKitchenActionableItems(ticket);
                                                            const selectedIds = (selectedItemIdsByTicket[ticket.id] || []).map(Number);
                                                            const selectionState = resolveKitchenSelectionState(ticket, selectedIds);
                                                            const selectionMode = resolveKitchenSelectionMode(ticket, selectedIds);
                                                            const canMarkReady =
                                                                selectionState.totalSelected > 0
                                                                    ? selectionState.readyToMark > 0 &&
                                                                      !selectionState.hasMixedAction &&
                                                                      selectionState.readyToDeliver === 0
                                                                    : actionCounts.readyToMark > 0;
                                                            const canDeliver =
                                                                selectionState.totalSelected > 0
                                                                    ? selectionState.readyToDeliver > 0
                                                                    : actionCounts.readyToDeliver > 0;
                                                            const actionBusy = Boolean(
                                                                submittingActionByTicket[ticket.id]
                                                            );
                                                            const readyButtonClass =
                                                                selectionMode === "ready"
                                                                    ? "bg-emerald-700 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                                                                    : selectionMode === "deliver"
                                                                      ? "bg-emerald-500/70"
                                                                      : "bg-emerald-600";
                                                            const deliverButtonClass =
                                                                selectionMode === "deliver"
                                                                    ? "bg-violet-700 ring-2 ring-violet-200 dark:ring-violet-900/40"
                                                                    : selectionMode === "ready"
                                                                      ? "bg-violet-500/70"
                                                                      : "bg-violet-600";

                                                            return (
                                                                <>
                                                        <td className="px-4 py-4">
                                                            {(() => {
                                                                const ticketStatus = resolveKitchenTicketStatusMeta(ticket);

                                                                return (
                                                            <>
                                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                                                {ticket.ticket_number}
                                                            </p>
                                                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                                                {ticket.invoice || "Tanpa nomor nota"}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {ticket.customer_name || "Pelanggan umum"}
                                                            </p>
                                                            {kitchenProgressLabel(ticket) ? (
                                                                <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                                                    {kitchenProgressLabel(ticket)}
                                                                </p>
                                                            ) : null}
                                                            <p className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                                Status tampilan: {ticketStatus.label}
                                                            </p>
                                                            </>
                                                                );
                                                            })()}
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
                                                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                                                        {ticket.items.length} item
                                                                    </span>
                                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                                                        {(selectedItemIdsByTicket[ticket.id] || []).length} dipilih
                                                                    </span>
                                                                    {countKitchenItemNotes(ticket) > 0 ? (
                                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                                            {countKitchenItemNotes(ticket)} catatan
                                                                        </span>
                                                                    ) : null}
                                                                    <span className="text-slate-400 dark:text-slate-500">
                                                                        Detail item dan checklist aksi dibuka di popup
                                                                    </span>
                                                                    {selectionMode ? (
                                                                        <span
                                                                            className={`rounded-full px-2.5 py-1 font-semibold ${
                                                                                selectionMode === "ready"
                                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                                    : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                                                            }`}
                                                                        >
                                                                            Mode: {selectionMode === "ready" ? "Tandai Siap" : "Antar / Serahkan"}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setTicketDetailModal(ticket);
                                                                        setTicketDetailTab("items");
                                                                    }}
                                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                                >
                                                                    <IconEye size={16} />
                                                                    Detail Pesanan
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                                                            <div className="min-w-[220px] space-y-2">
                                                                {kitchenProgressLabel(ticket) ? (
                                                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                                        {kitchenProgressLabel(ticket)}
                                                                    </div>
                                                                ) : null}
                                                                <div>
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                        Jenis:
                                                                    </span>{" "}
                                                                    {ticket.order_type_label || "Bawa Pulang"}
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                        Lokasi:
                                                                    </span>{" "}
                                                                    {formatOrderLocation(ticket)}
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                        Pelanggan:
                                                                    </span>{" "}
                                                                    {ticket.customer_name || "Pelanggan umum"}
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                        No. HP:
                                                                    </span>{" "}
                                                                    {ticket.customer_phone || "-"}
                                                                </div>
                                                                {ticket.notes ? (
                                                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                                        {ticket.notes}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            {(() => {
                                                                const ticketStatus = resolveKitchenTicketStatusMeta(ticket);

                                                                return (
                                                            <span
                                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                                    ticketStatus.badge
                                                                }`}
                                                            >
                                                                {ticketStatus.label}
                                                            </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex min-w-[260px] flex-col gap-2">
                                                                {(() => {
                                                                    const printStatus = kitchenPrintStatusMeta(ticket);

                                                                    return (
                                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                            <span
                                                                                className={`rounded-full px-2.5 py-1 font-semibold ${printStatus.badge}`}
                                                                            >
                                                                                {printStatus.label}
                                                                            </span>
                                                                            <span className="text-slate-500 dark:text-slate-400">
                                                                                {kitchenPrintSummaryLabel(ticket)}
                                                                            </span>
                                                                            {(() => {
                                                                                const printTimeMeta = kitchenPrintTimeMeta(ticket);

                                                                                return printTimeMeta ? (
                                                                                    <div className="flex flex-col gap-1 leading-4">
                                                                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                                            {printTimeMeta.primary}
                                                                                        </span>
                                                                                        {printTimeMeta.secondary ? (
                                                                                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                                                                                {printTimeMeta.secondary}
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </div>
                                                                                ) : null;
                                                                            })()}
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {selectionMode ? (
                                                                    <div
                                                                        className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${
                                                                            selectionMode === "ready"
                                                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                                                : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300"
                                                                        }`}
                                                                    >
                                                                        Aksi aktif: {selectionMode === "ready" ? "Tandai Item Siap" : "Antar / Serahkan Item"}
                                                                    </div>
                                                                ) : null}
                                                                {ticket.status === "pending" &&
                                                                (boardState.activeStation?.processing_mode || "auto") === "manual" ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAcknowledge(ticket.id)}
                                                                        disabled={actionBusy}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                                    >
                                                                        <IconChefHat size={16} />
                                                                        Mulai Proses
                                                                    </button>
                                                                ) : null}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleComplete(ticket.id)}
                                                                    disabled={!canMarkReady || actionBusy}
                                                                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 ${readyButtonClass}`}
                                                                >
                                                                    <IconCheck size={16} />
                                                                    Tandai Item Siap
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeliver(ticket.id)}
                                                                    disabled={!canDeliver || actionBusy}
                                                                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 ${deliverButtonClass}`}
                                                                >
                                                                    <IconCheck size={16} />
                                                                    Antar / Serahkan Item
                                                                </button>

                                                                {printerDevices.length > 0 &&
                                                                ticket.status !== "completed" ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQueueDispatch(ticket.id)}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
                                                                    >
                                                                        <IconPrinter size={16} />
                                                                        {Number(ticket?.print?.success_jobs || 0) > 0
                                                                            ? "Cetak Ulang"
                                                                            : "Kirim ke Printer"}
                                                                    </button>
                                                                ) : null}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePreview(ticket)}
                                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                                >
                                                                    <IconEye size={16} />
                                                                    Preview
                                                                </button>
                                                            </div>
                                                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                                {selectionState.totalSelected > 0
                                                                    ? selectionState.hasMixedAction
                                                                        ? "Pilihan bercampur. Pilih hanya item diproses atau hanya item siap antar."
                                                                        : selectionState.readyToDeliver > 0
                                                                          ? `${selectionState.readyToDeliver} item terpilih siap diantar atau diserahkan sekarang.`
                                                                          : selectionState.readyToMark > 0
                                                                            ? `${selectionState.readyToMark} item terpilih siap ditandai siap antar.`
                                                                            : "Pilihan saat ini tidak punya aksi yang bisa dijalankan."
                                                                    : actionCounts.readyToDeliver > 0 &&
                                                                        actionCounts.readyToMark > 0
                                                                      ? `${actionCounts.readyToDeliver} item sudah bisa diantar sekarang, sementara ${actionCounts.readyToMark} item lain masih menunggu proses dapur.`
                                                                      : actionCounts.readyToDeliver > 0
                                                                        ? `${actionCounts.readyToDeliver} item sudah bisa diantar atau diserahkan sekarang.`
                                                                        : actionCounts.readyToMark > 0
                                                                          ? `${actionCounts.readyToMark} item masih menunggu ditandai siap antar.`
                                                                          : "Semua item pada ticket ini sudah final."}
                                                            </div>
                                                        </td>
                                                                </>
                                                            );
                                                        })()}
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

            {showSoundTestPanel ? (
                <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                🔊 Testing Suara Notifikasi
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowSoundTestPanel(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>
                        <div className="mt-4">
                            <SoundTestPanel />
                        </div>
                    </div>
                </div>
            ) : null}

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
                                    Dapur bisa memilih item yang benar-benar siap lebih dulu. Ticket baru berubah penuh ke siap antar saat semua item di dalamnya sudah selesai.
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
                                    Preview Ticket
                                </p>
                                <p className="mt-1">
                                    Buka preview untuk melihat detail item, catatan pesanan, dan ringkasan ticket lebih lengkap.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <Modal
                title="Link Printer Dapur"
                show={showPrinterLinkModal}
                maxWidth="2xl"
                onClose={() => {
                    setShowPrinterLinkModal(false);
                    setPrinterLinkDevice(null);
                }}
            >
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {printerLinkDevice?.name || "Printer dapur"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Station: {selectedStation?.name || "-"} • Outlet: {activeOutlet?.name || "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Profile: {printerLinkDevice?.meta?.print_profile || "browser_manual"} • Paper: {printerLinkDevice?.meta?.paper_width || "80mm"} • Template: {printerLinkDevice?.meta?.template_style || "standard"}
                        </p>
                        {printerLinkDevice?.meta?.bridge_device_key ? (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Bridge Key: {printerLinkDevice.meta.bridge_device_key}
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Link Print Client
                        </label>
                        <textarea
                            readOnly
                            rows={5}
                            value={buildKitchenPrintClientUrl(selectedStation)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                        />
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                        Gunakan link ini di device printer untuk station {selectedStation?.name || "-"} agar polling tiket dapur langsung terikat ke dapur tenant yang sedang aktif.
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setShowPrinterLinkModal(false);
                                setPrinterLinkDevice(null);
                            }}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            Tutup
                        </button>
                        <button
                            type="button"
                            onClick={handleCopyPrinterLink}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconCopy size={16} />
                            Salin Link
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenPrinterLink}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
                        >
                            <IconExternalLink size={16} />
                            Buka Print Client
                        </button>
                    </div>
                </div>
            </Modal>

            {ticketDetailModal ? (
                <div className="fixed inset-0 z-[130] bg-slate-950/60">
                    <div className="flex min-h-dvh items-end justify-center md:items-center md:p-4">
                        <div className="flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 md:h-auto md:max-h-[calc(100vh-3rem)] md:max-w-3xl md:rounded-3xl md:border md:border-slate-200 dark:md:border-slate-800">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white md:text-lg">
                                        Detail Pesanan {ticketDetailModal.ticket_number}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {ticketDetailModal.invoice || "Tanpa nomor nota"} •{" "}
                                        {ticketDetailModal.customer_name || "Pelanggan umum"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTicketDetailModal(null);
                                        setTicketDetailTab("items");
                                    }}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTicketDetailTab("summary")}
                                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                            ticketDetailTab === "summary"
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                                : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        }`}
                                    >
                                        Ringkasan Order
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTicketDetailTab("items")}
                                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                            ticketDetailTab === "items"
                                                ? "bg-primary-600 text-white"
                                                : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        }`}
                                    >
                                        Item & Checklist
                                    </button>
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                                {ticketDetailTab === "summary" ? (
                                    <KitchenTicketSummaryDetail ticket={ticketDetailModal} />
                                ) : (
                                    <KitchenTicketItemsDetail
                                        ticket={ticketDetailModal}
                                        selectedItemIds={(selectedItemIdsByTicket[ticketDetailModal.id] || []).map(Number)}
                                        selectionMode={resolveKitchenSelectionMode(
                                            ticketDetailModal,
                                            (selectedItemIdsByTicket[ticketDetailModal.id] || []).map(Number)
                                        )}
                                        setSelectedItems={setSelectedItems}
                                        toggleItemSelection={toggleItemSelection}
                                    />
                                )}
                            </div>

                            <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {ticketDetailModal.items?.length || 0} item •{" "}
                                        {(selectedItemIdsByTicket[ticketDetailModal.id] || []).length} dipilih
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTicketDetailModal(null);
                                            setTicketDetailTab("items");
                                        }}
                                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {showPreviewModal && previewTicket ? (
                <KitchenTicketPreview
                    ticket={previewTicket}
                    station={selectedStation}
                    onClose={() => {
                        setShowPreviewModal(false);
                        setPreviewTicket(null);
                    }}
                />
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
