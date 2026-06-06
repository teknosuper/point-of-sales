import { IconEye, IconX } from "@/Utils/icons";

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

export default function KitchenTicketPreview({ ticket, station, onClose }) {
    if (!ticket) return null;

    const items = ticket.items || [];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="flex h-[90vh] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <IconEye size={20} className="text-primary-600" />
                        <h2 className="font-semibold text-slate-900 dark:text-white">
                            Preview Tiket Dapur
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Preview Content - Styled like printed ticket */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 font-mono text-sm dark:border-slate-600 dark:bg-slate-950">
                        {/* Store Header */}
                        <div className="mb-3 text-center">
                            <div className="text-lg font-bold">KITCHEN ORDER</div>
                            <div className="text-base font-bold">{station?.name || "Stasiun Dapur"}</div>
                            <div className="mt-1 text-xs text-slate-500">{"=".repeat(32)}</div>
                        </div>

                        {/* Ticket Info */}
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Ticket:</span>
                                <span className="font-semibold">{ticket.ticket_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Invoice:</span>
                                <span>{ticket.invoice || "-"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Pelanggan:</span>
                                <span>{ticket.customer_name || "Pelanggan Umum"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Masuk:</span>
                                <span>{formatDateTime(ticket.fired_at)}</span>
                            </div>
                            {ticket.acknowledged_at && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Proses:</span>
                                    <span>{formatDateTime(ticket.acknowledged_at)}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">{"=".repeat(32)}</div>

                        {/* Items */}
                        <div className="mt-3 space-y-2">
                            {items.map((item) => (
                                <div key={item.id}>
                                    <div className="font-bold">
                                        {item.qty}x {item.product_title || item.name}
                                    </div>
                                    {item.notes && (
                                        <div className="ml-3 text-slate-600">
                                            {"   >> "}{item.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Ticket Notes */}
                        {ticket.notes && (
                            <>
                                <div className="mt-3 text-xs text-slate-500">{"=".repeat(32)}</div>
                                <div className="mt-2 text-xs">
                                    <span className="font-semibold">Catatan: </span>
                                    <span>{ticket.notes}</span>
                                </div>
                            </>
                        )}

                        {/* Status */}
                        <div className="mt-4 text-center">
                            <div className="inline-flex rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                                {ticket.status === "pending" && "Menunggu"}
                                {ticket.status === "acknowledged" && "Diproses"}
                                {ticket.status === "ready" && "Siap Diantar / Diambil"}
                                {ticket.status === "completed" && "Selesai"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                    <p className="text-center text-xs text-slate-500">
                        Preview ini menampilkan tampilan tiket dapur sesuai pengaturan printer station.
                    </p>
                </div>
            </div>
        </div>
    );
}
