// Komponen detail pesanan kitchen (sebelumnya inline di Dashboard/Kitchen/Index.jsx).
import {
    IconClockHour4,
    IconChefHat,
    IconCheck,
} from "@/Utils/icons";
import {
    formatDateTime,
    formatOrderLocation,
    kitchenProgressLabel,
    isReturnedKitchenTicket,
    resolveKitchenItemBadge,
    kitchenItemQuantityLabel,
    isKitchenItemSelectable,
    kitchenActionGroupForItem,
    kitchenItemSelectionLabel,
    resolveEligibleKitchenDeliveredItemIds,
    resolveEligibleKitchenItemIds,
} from "@/Utils/kitchen";

export function KitchenTicketSummaryDetail({ ticket }) {
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
                        {ticket.has_return_activity ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                Retur terdeteksi. Aktif: {ticket.active_qty_total || 0} item, retur:{" "}
                                {ticket.returned_qty_total || 0} item.
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

export function KitchenTicketItemsDetail({
    ticket,
    selectedItemIds = [],
    selectionMode = null,
    setSelectedItems,
    toggleItemSelection,
}) {
    if (!ticket) {
        return null;
    }

    const readOnlyReturnedTicket = isReturnedKitchenTicket(ticket);

    return (
        <div className="space-y-4">
            {readOnlyReturnedTicket ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                    Ticket retur bersifat baca-saja. Aksi proses, checklist, dan cetak disembunyikan dari tampilan ini.
                </div>
            ) : (
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
            )}

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
                                {item.has_partial_return || item.status === "returned" ? (
                                    <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                                        {item.status === "returned"
                                            ? `Item ini sudah diretur ${item.returned_qty || item.qty}x`
                                            : `Sebagian diretur ${item.returned_qty}x, sisa aktif ${item.remaining_qty}x`}
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
                                    {kitchenItemQuantityLabel(item)}
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
