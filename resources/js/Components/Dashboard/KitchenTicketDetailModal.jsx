// Modal detail pesanan kitchen (sebelumnya inline di Dashboard/Kitchen/Index.jsx).
import { IconX } from "@/Utils/icons";
import {
    KitchenTicketSummaryDetail,
    KitchenTicketItemsDetail,
} from "@/Components/Dashboard/KitchenTicketDetail";
import {
    resolveKitchenSelectionMode,
    isReturnedKitchenTicket,
} from "@/Utils/kitchen";

export default function KitchenTicketDetailModal({
    ticket,
    onClose,
    tab,
    setTab,
    selectedItemIdsByTicket,
    setSelectedItems,
    toggleItemSelection,
}) {
    if (!ticket) {
        return null;
    }

    const selectedItemIds = (selectedItemIdsByTicket[ticket.id] || []).map(
        Number
    );

    return (
        <div className="fixed inset-0 z-[130] bg-slate-950/60">
            <div className="flex min-h-dvh items-end justify-center md:items-center md:p-4">
                <div className="flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 md:h-auto md:max-h-[calc(100vh-3rem)] md:max-w-3xl md:rounded-3xl md:border md:border-slate-200 dark:md:border-slate-800">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white md:text-lg">
                                Detail Pesanan {ticket.ticket_number}
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {ticket.invoice || "Tanpa nomor nota"} •{" "}
                                {ticket.customer_name || "Pelanggan umum"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                setTab("items");
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
                                onClick={() => setTab("summary")}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                    tab === "summary"
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                        : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                }`}
                            >
                                Ringkasan Order
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab("items")}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                    tab === "items"
                                        ? "bg-primary-600 text-white"
                                        : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                }`}
                            >
                                Item & Checklist
                            </button>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                        {tab === "summary" ? (
                            <KitchenTicketSummaryDetail ticket={ticket} />
                        ) : (
                            <KitchenTicketItemsDetail
                                ticket={ticket}
                                selectedItemIds={selectedItemIds}
                                selectionMode={resolveKitchenSelectionMode(
                                    ticket,
                                    selectedItemIds
                                )}
                                setSelectedItems={setSelectedItems}
                                toggleItemSelection={toggleItemSelection}
                            />
                        )}
                    </div>

                    <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {ticket.items?.length || 0} item
                                {!isReturnedKitchenTicket(ticket)
                                    ? ` • ${selectedItemIds.length} dipilih`
                                    : " • mode histori retur"}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    setTab("items");
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
    );
}
