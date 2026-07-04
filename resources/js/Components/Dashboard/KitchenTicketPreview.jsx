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

const resolvePaperWidth = (station) => {
    const primaryDevice =
        station?.devices?.find((device) => device?.is_primary) ||
        station?.devices?.[0];
    const paperWidth = String(primaryDevice?.meta?.paper_width || "80mm").toLowerCase();

    return paperWidth === "58mm" ? "58mm" : "80mm";
};

const resolveColumns = (station) =>
    resolvePaperWidth(station) === "58mm" ? 32 : 48;

const wrapText = (text, width) => {
    const value = String(text || "").trim();
    if (!value) return [];

    const words = value.split(/\s+/);
    const lines = [];
    let current = "";

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;

        if (candidate.length <= width) {
            current = candidate;
            return;
        }

        if (current) {
            lines.push(current);
            current = "";
        }

        if (word.length <= width) {
            current = word;
            return;
        }

        for (let index = 0; index < word.length; index += width) {
            lines.push(word.slice(index, index + width));
        }
    });

    if (current) lines.push(current);

    return lines;
};

const buildThermalLines = (ticket, station) => {
    const cols = resolveColumns(station);
    const sep = "=".repeat(cols);
    const lines = [
        { text: "KITCHEN ORDER", align: "center", bold: true },
        { text: station?.name || "Stasiun Dapur", align: "center", bold: true },
        { text: sep, align: "left" },
    ];

    if (ticket?.ticket_number) lines.push({ text: `Ticket: ${ticket.ticket_number}` });
    if (ticket?.invoice) lines.push({ text: `Invoice: ${ticket.invoice}` });
    if (ticket?.order_type) lines.push({ text: `Order: ${ticket.order_type}` });
    if (ticket?.table_label || ticket?.table_name || ticket?.table_code) {
        lines.push({
            text: `Meja: ${ticket.table_label || ticket.table_code || ticket.table_name}`,
        });
    }

    lines.push({
        text: `Customer: ${ticket?.customer_name || "Pelanggan Umum"}`,
    });

    if (ticket?.fired_at) {
        lines.push({ text: `Waktu: ${formatDateTime(ticket.fired_at)}` });
    }

    lines.push({ text: sep, align: "left" });

    (ticket?.items || []).forEach((item) => {
        lines.push({
            text: `${item?.qty || 0}x ${item?.product_title || item?.name || "Item"}`,
            bold: true,
        });

        if (item?.notes) {
            wrapText(item.notes, Math.max(8, cols - 6)).forEach((line, index) => {
                lines.push({
                    text: index === 0 ? `   >> ${line}` : `      ${line}`,
                });
            });
        }
    });

    if (ticket?.notes) {
        lines.push({ text: sep, align: "left" });
        wrapText(`Catatan: ${ticket.notes}`, cols).forEach((line) => {
            lines.push({ text: line });
        });
    }

    return {
        cols,
        paperWidth: resolvePaperWidth(station),
        lines,
    };
};

export default function KitchenTicketPreview({ ticket, station, onClose }) {
    if (!ticket) return null;

    const thermal = ticket?.print?.preview || buildThermalLines(ticket, station);
    const previewLines = (thermal?.lines || []).map((line) =>
        typeof line === "string" ? { text: line, align: "left", bold: false } : line
    );

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
                    <div className="mx-auto rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 font-mono text-sm dark:border-slate-600 dark:bg-slate-950">
                        <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Mode thermal</span>
                            <span>{thermal.paperWidth}</span>
                        </div>

                        <div
                            className="space-y-1 text-xs leading-5 text-slate-900 dark:text-slate-100"
                            style={{
                                width: thermal.cols === 48 ? "100%" : "32ch",
                                maxWidth: "100%",
                            }}
                        >
                            {previewLines.map((line, index) => (
                                <div
                                    key={`${index}-${line.text}`}
                                    className={[
                                        "whitespace-pre-wrap break-words",
                                        line.align === "center" ? "text-center" : "text-left",
                                        line.bold ? "font-bold" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    {line.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                    <p className="text-center text-xs text-slate-500">
                        Preview mengikuti payload thermal backend yang dipakai print dapur.
                    </p>
                </div>
            </div>
        </div>
    );
}
