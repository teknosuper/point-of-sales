import { Head } from "@inertiajs/react";
import { useEffect } from "react";

const qrImageUrl = (value) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
        value || ""
    )}`;

const steps = [
    { num: 1, title: "Scan Meja", desc: "Scan QR code dengan HP untuk buka halaman menu" },
    { num: 2, title: "Masukkan Data Pemesan", desc: "Isi nama & no HP agar pesanan tercatat" },
    { num: 3, title: "Lakukan Pemesanan", desc: "Pilih menu, pilih jumlah, lalu tambah ke pesanan" },
    { num: 4, title: "Konfirmasi Pesanan", desc: "Cek kembali pesanan, lalu kirim ke dapur" },
    { num: 5, title: "Bayar ke Kasir", desc: "Datang ke kasir, sebutkan nama, lakukan pembayaran" },
    { num: 6, title: "Tunggu Pesanan", desc: "Duduk santai, pesanan akan diantar ke meja" },
];

function TableCard({ table, outlet }) {
    return (
        <div className="flex overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)] print:h-[4in] print:w-[6in] print:flex-row print:rounded-none print:shadow-none">
            <div className="flex w-1/2 shrink-0 flex-col bg-[linear-gradient(145deg,_#0f172a_0%,_#0f3b68_48%,_#0b7ea1_100%)] p-4 text-white print:w-1/2 print:shrink-0">
                <div className="flex flex-1 flex-col items-center justify-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-sky-200">
                        Self Order
                    </p>
                    <h1 className="mt-1 text-xl font-black tracking-[-0.04em]">
                        {table?.code || table?.name}
                    </h1>
                    <p className="text-[11px] text-slate-300">{table?.name}</p>
                </div>

                <div className="mt-2 rounded-[16px] border border-white/20 bg-white/10 p-2">
                    <img
                        src={qrImageUrl(table?.order_url)}
                        alt={`QR ${table?.name || "Meja"}`}
                        className="mx-auto aspect-square w-full rounded-[12px] bg-white object-contain"
                    />
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 font-semibold text-white">
                        {outlet?.name || "Outlet"}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 font-semibold text-white">
                        {table?.capacity || 0} kursi
                    </span>
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col bg-white p-3">
                <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold text-white">
                        i
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-800">
                        Panduan Order
                    </p>
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                    {steps.map((step) => (
                        <div
                            key={`${table?.id}-${step.num}`}
                            className="flex items-start gap-2.5 rounded-[12px] border border-slate-100 bg-slate-50 px-2.5 py-1.5"
                        >
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
                                {step.num}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold leading-4 text-slate-900">
                                    {step.title}
                                </p>
                                <p className="text-[9px] leading-3.5 text-slate-500">
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-2 rounded-[10px] bg-emerald-50 px-2.5 py-1.5 text-center">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        Nikmati pesanan Anda!
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function PrintV2All({ tables = [], outlet }) {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            window.print();
        }, 350);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <>
            <Head title={`Print Semua QR ${outlet?.name || "Meja"}`} />

            <style>{`
                @page {
                    size: 6in 4in;
                    margin: 0;
                }

                @media print {
                    body {
                        background: #ffffff;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 print:bg-white print:px-0 print:py-0">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                    {tables.map((table) => (
                        <div
                            key={table.id}
                            className="mx-auto w-full max-w-[6in] print:break-after-page"
                        >
                            <TableCard table={table} outlet={outlet} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
