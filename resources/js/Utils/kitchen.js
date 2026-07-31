// Helper murni + konstanta untuk Kitchen (sebelumnya inline di Dashboard/Kitchen/Index.jsx).
export const statusMeta = {
    active: { label: "Semua aktif" },
    pending: { label: "Menunggu" },
    acknowledged: { label: "Diproses" },
    ready: { label: "Siap Antar / Ambil" },
    completed: { label: "Selesai" },
    returned: { label: "Retur" },
};

export const ticketStatusMeta = {
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
    returned: {
        label: "Diretur",
        badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    },
};

export const ticketItemStatusMeta = {
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
    returned: {
        label: "Diretur",
        badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    },
};

export const kitchenServiceStatusMeta = {
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
    returned: {
        label: "Diretur",
        badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    },
};

export const emptyTicketPayload = {
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

export const formatTime = (value) =>
    value
        ? new Date(value).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

export const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

export const formatOrderLocation = (ticket) => {
    if (ticket?.order_type === "dine_in") {
        if (ticket?.table_name && ticket?.table_code) {
            return `${ticket.table_code} - ${ticket.table_name}`;
        }

        return ticket?.table_name || ticket?.table_code || "Meja belum dipilih";
    }

    return "Ambil sendiri / takeaway";
};

export const formatCustomerAlertLocation = (customerAlert, ticket) => {
    const orderType = customerAlert?.order_type || ticket?.order_type;
    const tableCode = customerAlert?.table_code || ticket?.table_code;
    const tableName = customerAlert?.table_name || ticket?.table_name;

    if (orderType === "dine_in") {
        if (tableCode && tableName) {
            return `${tableCode} - ${tableName}`;
        }

        return tableCode || tableName || "Meja belum dipilih";
    }

    return "Ambil sendiri / takeaway";
};

export const normalizeKitchenServiceStatus = (item) => {
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

export const resolveKitchenItemBadge = (item) => {
    if (item?.status === "returned" || item?.service_status === "returned") {
        return (
            kitchenServiceStatusMeta.returned || ticketItemStatusMeta.returned
        );
    }

    if (item?.status === "completed") {
        return (
            kitchenServiceStatusMeta[normalizeKitchenServiceStatus(item)] ||
            kitchenServiceStatusMeta.ready
        );
    }

    return ticketItemStatusMeta[item?.status] || ticketItemStatusMeta.pending;
};

export const summarizeKitchenTicketProgress = (ticket) => {
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

export const resolveKitchenTicketStatusMeta = (ticket) => {
    if (ticket?.display_status_key === "returned" || ticket?.is_fully_returned) {
        return ticketStatusMeta.returned;
    }

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

export const kitchenPrintStatusMeta = (ticket) => {
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

export const kitchenPrintSummaryLabel = (ticket) => {
    const successJobs = Number(ticket?.print?.success_jobs || 0);

    if (successJobs <= 0) {
        return "Belum ada cetak sukses";
    }

    if (successJobs === 1) {
        return "Tercetak 1x";
    }

    return `Tercetak 1x • Cetak ulang ${successJobs - 1}x`;
};

export const kitchenPrintTimeMeta = (ticket) => {
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

export const kitchenProgressLabel = (ticket) => {
    if (ticket?.is_fully_returned) {
        return `${ticket?.returned_qty_total || 0} item dibatalkan / diretur`;
    }

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

    if (Number(ticket?.returned_qty_total || 0) > 0) {
        return `${ticket.returned_qty_total} item diretur`;
    }

    return `${totalItems} item`;
};

export const isKitchenItemSelectable = (item) =>
    item?.status !== "returned" &&
    (["pending", "acknowledged"].includes(item?.status) ||
        (item?.status === "completed" &&
            ["ready", "picked_up"].includes(normalizeKitchenServiceStatus(item))));

export const kitchenItemSelectionLabel = (item) => {
    if (item?.status === "returned" || item?.service_status === "returned") {
        return "Diretur";
    }

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

export const countKitchenActionableItems = (ticket) => {
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

export const countKitchenItemNotes = (ticket) =>
    (ticket?.items || []).filter((item) => Boolean(item?.notes)).length;

export const isReturnedKitchenTicket = (ticket) =>
    ticket?.display_status_key === "returned" || Boolean(ticket?.is_fully_returned);

/**
 * Card border/bg color based on print status — agar kasir/dapur langsung tahu status cetak.
 * failed   → merah
 * queued / reprint_queued → biru
 * printed  → hijau tipis
 * not_printed → abu default
 */
export const kitchenCardPrintClass = (ticket) => {
    const status = ticket?.print?.status || "not_printed";
    switch (status) {
        case "failed":
            return "border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/20";
        case "queued":
        case "reprint_queued":
            return "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20";
        case "printed":
            return "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/10";
        default:
            return "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
    }
};

export const kitchenItemQuantityLabel = (item) => {
    const activeQty = Number(item?.remaining_qty ?? item?.qty ?? 0);
    const returnedQty = Number(item?.returned_qty || 0);

    if (item?.status === "returned") {
        return `Retur x${Number(item?.qty || returnedQty || 0)}`;
    }

    if (returnedQty > 0 && activeQty > 0) {
        return `Aktif x${activeQty} • Retur x${returnedQty}`;
    }

    return `x${Number(item?.qty || activeQty || 0)}`;
};

export const kitchenActionGroupForItem = (item) => {
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

export const resolveKitchenSelectionMode = (ticket, selectedItemIds = []) => {
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

export const resolveKitchenSelectionState = (ticket, selectedItemIds = []) => {
    const items = (ticket?.items || []).filter((item) =>
        selectedItemIds.map(Number).includes(Number(item.id))
    );

    const readyToMark = items.filter((item) =>
        ["pending", "acknowledged"].includes(item.status)
    ).length;
    const readyToDeliver = items.filter(
        (item) =>
            ["pending", "acknowledged"].includes(item.status) ||
            (item.status === "completed" &&
                ["ready", "picked_up"].includes(
                    normalizeKitchenServiceStatus(item)
                ))
    ).length;

    return {
        totalSelected: items.length,
        readyToMark,
        readyToDeliver,
        hasMixedAction:
            readyToMark > 0 && readyToDeliver > 0,
    };
};

export const reconcileSelectedItemsByTicket = (currentSelections = {}, ticketList = []) => {
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

export const buildBoardFilters = (filters = {}, selectedDevice = null) => ({
    status: filters?.status || "active",
    q: filters?.q || "",
    page: Number(filters?.page || 1),
    per_page: Number(filters?.per_page || 15),
    sort: filters?.sort || "oldest",
    device_id: selectedDevice?.id || filters?.device_id || null,
});

export const buildBoardState = ({
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

export const resolveEligibleKitchenItemIds = (ticket, allowedStatuses = []) =>
    (ticket?.items || [])
        .filter((item) => allowedStatuses.includes(item.status))
        .map((item) => Number(item.id));

export const resolveEligibleKitchenDeliveredItemIds = (ticket) =>
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
