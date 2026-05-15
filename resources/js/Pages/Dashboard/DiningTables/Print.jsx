import { Head } from "@inertiajs/react";
import { useEffect } from "react";

const qrImageUrl = (value) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=520x520&data=${encodeURIComponent(
        value || ""
    )}`;

const formatPrintedAt = (value) => {
    if (!value) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
};

export default function Print({ table, outlet, printMeta }) {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            window.print();
        }, 350);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <>
            <Head title={`Print QR ${table?.name || "Meja"}`} />

            <style>{`
                @page {
                    size: 4in 6in;
                    margin: 0;
                }

                @media print {
                    body {
                        background: #ffffff;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 print:bg-white print:px-0 print:py-0">
                <div className="mx-auto w-full max-w-[4in]">
                    <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)] print:flex print:h-[6in] print:w-[4in] print:flex-col print:rounded-none print:shadow-none">
                        <div className="relative overflow-hidden bg-[linear-gradient(145deg,_#0f172a_0%,_#0f3b68_48%,_#0b7ea1_100%)] px-5 py-4 text-white">
                            <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-[linear-gradient(180deg,_#38bdf8_0%,_#06b6d4_100%)]" />
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-[linear-gradient(180deg,_#14b8a6_0%,_#22c55e_100%)]" />
                            <div className="pl-4 pr-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200">
                                    Self Order Table
                                </p>
                                <h1 className="mt-1.5 text-[1.45rem] font-black tracking-[-0.04em]">
                                    {table?.code || table?.name}
                                </h1>
                                <p className="mt-0.5 text-[13px] text-slate-200">
                                    {table?.name}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white">
                                        {outlet?.name || "Outlet"}
                                    </span>
                                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-semibold text-white">
                                        {table?.capacity || 0} kursi
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 bg-white px-5 py-4">
                            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-3">
                                <div className="rounded-[20px] border border-slate-200 bg-white p-2">
                                    <img
                                        src={qrImageUrl(table?.order_url)}
                                        alt={`QR ${table?.name || "Meja"}`}
                                        className="mx-auto aspect-square w-full rounded-[16px] bg-white object-contain"
                                    />
                                </div>
                                <div className="mt-2.5 rounded-[18px] bg-slate-950 px-4 py-2.5 text-center text-white">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                                        Scan untuk order
                                    </p>
                                    <p className="mt-1 text-[13px] font-medium leading-5 text-white">
                                        Scan QR, pilih menu, lalu bayar di kasir.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Nama
                                    </p>
                                    <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-900">
                                        {table?.name}
                                    </p>
                                </div>
                                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Kode
                                    </p>
                                    <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-900">
                                        {table?.code || "-"}
                                    </p>
                                </div>
                                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Kursi
                                    </p>
                                    <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-900">
                                        {table?.capacity || 0}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 grid gap-2">
                                {table?.notes ? (
                                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Catatan meja
                                        </p>
                                        <p className="mt-1 text-[12px] leading-5 text-slate-700">
                                            {table.notes}
                                        </p>
                                    </div>
                                ) : null}

                                <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Petunjuk singkat
                                    </p>
                                    <p className="mt-1.5 text-[12px] leading-5 text-slate-700">
                                        Tempel di meja. Pelanggan scan QR untuk buka menu dan kirim order.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[10px] text-slate-500">
                            <div className="flex items-center justify-between gap-3">
                                <span>Format 4 x 6 inch</span>
                                <span>{formatPrintedAt(printMeta?.printed_at)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
