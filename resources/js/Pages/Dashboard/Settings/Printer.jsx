import { Head, useForm } from "@inertiajs/react";
import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import toast from "react-hot-toast";
import {
    IconPrinter,
    IconCopy,
    IconCheck,
    IconChefHat,
    IconReceipt,
    IconActivity,
    IconDevices,
    IconInfoCircle,
} from "@/Utils/icons";

function CashierReceiptCard({ receipt = null, receiptProfiles = {} }) {
    const form = useForm({
        receipt_profile: receipt?.receipt_profile || "80_standard",
        paper_width: receipt?.paper_width || "80mm",
    });

    const submit = (event) => {
        event.preventDefault();
        form.put(route("settings.printer.cashier-receipt"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Pengaturan struk kasir diperbarui"),
            onError: () => toast.error("Gagal memperbarui pengaturan struk kasir"),
        });
    };

    return (
        <form
            onSubmit={submit}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
            <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Profile Struk Kasir
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pengaturan ini khusus untuk print client kasir, terpisah dari printer dapur.
                </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Lebar Kertas
                    </span>
                    <select
                        value={form.data.paper_width}
                        onChange={(event) => form.setData("paper_width", event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                        <option value="58mm">58mm</option>
                        <option value="80mm">80mm</option>
                    </select>
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Profile Receipt
                    </span>
                    <select
                        value={form.data.receipt_profile}
                        onChange={(event) => form.setData("receipt_profile", event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                        {Object.entries(receiptProfiles).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <button
                type="submit"
                disabled={form.processing}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
                {form.processing ? "Menyimpan..." : "Simpan Profile"}
            </button>
        </form>
    );
}

function CopyButton({ text, label = "Copy" }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("URL disalin ke clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            toast.success("URL disalin ke clipboard");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
            {copied ? <IconCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
            {copied ? "Disalin!" : label}
        </button>
    );
}

function UrlCard({ icon, label, description, url }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400">
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                </div>
                <CopyButton text={url} />
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/50">
                <code className="block break-all text-xs text-slate-700 dark:text-slate-300">{url}</code>
            </div>
        </div>
    );
}

export default function Printer({
    queueUrls = {},
    stationUrls = [],
    deviceUrls = [],
    cashierReceipt = null,
    receiptProfiles = {},
    config = {},
}) {
    return (
        <>
            <Head title="Pengaturan Printer" />

            <div className="space-y-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                        <IconPrinter size={28} className="text-primary-500" />
                        Pengaturan Printer
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Konfigurasi URL antrian print untuk aplikasi ESC/POS Web Direct. Copy URL di bawah lalu paste ke aplikasi printer.
                    </p>
                </div>

                {/* Info Box */}
                <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                    <div className="flex gap-3">
                        <IconInfoCircle size={20} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
                        <div className="space-y-2 text-sm text-sky-900 dark:text-sky-100">
                            <p className="font-semibold">Cara Penggunaan:</p>
                            <ol className="list-inside list-decimal space-y-1 text-xs">
                                <li>Buka aplikasi <strong>ESC/POS Web Direct</strong> di perangkat Android yang terhubung printer</li>
                                <li>Copy salah satu <strong>URL Print Client</strong> di bawah</li>
                                <li>Paste ke kolom URL di aplikasi ESC/POS Web Direct</li>
                                <li>Printer akan otomatis mencetak saat ada transaksi baru</li>
                            </ol>
                            <p className="text-xs text-sky-700 dark:text-sky-300">
                                Token: <code className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">{config.token}</code>
                                {" "}• Outlet: <strong>{config.outlet_name}</strong>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Aplikasi GTC Printer */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex gap-3">
                        <IconPrinter size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div className="w-full space-y-2 text-sm text-emerald-900 dark:text-emerald-100">
                            <p className="font-semibold">📱 Aplikasi GTC Printer Thermal</p>
                            <p className="text-xs">
                                Download dan install aplikasi Android <strong>GTC Printer</strong> untuk menghubungkan printer thermal Bluetooth/ USB ke sistem GTC KASIR.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <a
                                    href="/media/printer/gtcprinter.apk"
                                    download
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                                >
                                    <IconPrinter size={18} />
                                    Download GTC Printer APK
                                </a>
                                <div className="rounded-xl bg-white px-3 py-2.5 text-xs text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                                    <p className="font-semibold text-slate-900 dark:text-white">Info Aplikasi:</p>
                                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                                        <li>Ukuran: ~6.2 MB</li>
                                        <li>Koneksi: Bluetooth / USB (OTG)</li>
                                        <li>Support: ESC/POS thermal printer 58mm & 80mm</li>
                                        <li>Cocok untuk: struk kasir dan tiket dapur</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                                <p className="font-semibold text-slate-900 dark:text-white">Cara Konfigurasi:</p>
                                <ol className="mt-1 list-inside list-decimal space-y-0.5">
                                    <li>Download APK di atas dan install di perangkat Android</li>
                                    <li>Hubungkan printer thermal via Bluetooth atau USB OTG</li>
                                    <li>Buka menu <strong>Settings / Printer</strong> di sidebar GTC KASIR dashboard</li>
                                    <li>Copy <strong>URL Print Client</strong> yang sesuai (struk kasir atau tiket dapur)</li>
                                    <li>Paste URL ke kolom yang tersedia di aplikasi GTC Printer</li>
                                    <li>Printer siap mencetak secara otomatis</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Client URLs - Main CTA */}
                <div>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">🚀 URL Print Client (Buka di ESC/POS Web Direct)</h2>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        Copy URL ini lalu paste ke aplikasi ESC/POS Web Direct. Akan langsung auto-connect dan mulai mencetak.
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                        {config.print_client_cashier && (
                            <UrlCard
                                icon={<IconReceipt size={20} />}
                                label="Print Client — Struk Kasir"
                                description="Auto-print struk setiap transaksi baru"
                                url={config.print_client_cashier}
                            />
                        )}
                        {config.print_client_kitchen && (
                            <UrlCard
                                icon={<IconChefHat size={20} />}
                                label="Print Client — Tiket Dapur"
                                description="Auto-print tiket pesanan ke dapur"
                                url={config.print_client_kitchen}
                            />
                        )}
                    </div>
                </div>

                {/* Main Queue URLs */}
                <div>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                        Profile Struk Kasir
                    </h2>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        Atur ukuran dan profile struk kasir di sini. Pengaturan ini tidak mengambil printer dapur.
                    </p>
                    <CashierReceiptCard
                        receipt={cashierReceipt}
                        receiptProfiles={receiptProfiles}
                    />
                </div>

                <div>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">URL Antrian Utama</h2>
                    <div className="grid gap-3 lg:grid-cols-2">
                        {queueUrls.cashier && (
                            <UrlCard
                                icon={<IconReceipt size={20} />}
                                label={queueUrls.cashier.label}
                                description={queueUrls.cashier.description}
                                url={queueUrls.cashier.url}
                            />
                        )}
                        {queueUrls.kitchen && (
                            <UrlCard
                                icon={<IconChefHat size={20} />}
                                label={queueUrls.kitchen.label}
                                description={queueUrls.kitchen.description}
                                url={queueUrls.kitchen.url}
                            />
                        )}
                        {queueUrls.status && (
                            <UrlCard
                                icon={<IconActivity size={20} />}
                                label={queueUrls.status.label}
                                description={queueUrls.status.description}
                                url={queueUrls.status.url}
                            />
                        )}
                    </div>
                </div>

                {/* Per-Station URLs */}
                {stationUrls.length > 0 && (
                    <div>
                        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                            🚀 URL Print Client per Stasiun Dapur
                        </h2>
                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                            Copy URL ini ke aplikasi ESC/POS Web Direct di masing-masing dapur. Setiap stasiun akan auto-print hanya pesanan stasiun mereka.
                        </p>
                        <div className="grid gap-3 lg:grid-cols-2">
                            {stationUrls.map((station) => (
                                <div key={station.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                                <IconChefHat size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{station.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Station {station.code || station.name}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Print Client (ESC/POS Web Direct)</p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 truncate rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{station.print_client_url}</code>
                                                <CopyButton text={station.print_client_url} label="Copy" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Queue URL (API)</p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">{station.url}</code>
                                                <CopyButton text={station.url} label="Copy" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Per-Device URLs */}
                {deviceUrls.length > 0 && (
                    <div>
                        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                            URL per Device Printer
                        </h2>
                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                            Gunakan URL ini jika ingin mengarahkan print job ke device spesifik.
                        </p>
                        <div className="space-y-3">
                            {deviceUrls.map((device) => (
                                <div key={device.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            <IconDevices size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{device.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {device.station_name} • {device.device_type}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kasir</span>
                                                <CopyButton text={device.url_cashier} label="Copy" />
                                            </div>
                                            <code className="block break-all text-[11px] text-slate-600 dark:text-slate-400">{device.url_cashier}</code>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dapur</span>
                                                <CopyButton text={device.url_kitchen} label="Copy" />
                                            </div>
                                            <code className="block break-all text-[11px] text-slate-600 dark:text-slate-400">{device.url_kitchen}</code>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* API Reference */}
                <div>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Referensi API</h2>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                                        <th className="px-3 py-2 font-semibold">Endpoint</th>
                                        <th className="px-3 py-2 font-semibold">Method</th>
                                        <th className="px-3 py-2 font-semibold">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-700 dark:text-slate-300">
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-2 font-mono">/api/print-queue/cashier</td>
                                        <td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">GET</span></td>
                                        <td className="px-3 py-2">Poll antrian struk kasir</td>
                                    </tr>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-2 font-mono">/api/print-queue/kitchen</td>
                                        <td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">GET</span></td>
                                        <td className="px-3 py-2">Poll antrian tiket dapur</td>
                                    </tr>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-2 font-mono">/api/print-queue/status</td>
                                        <td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">GET</span></td>
                                        <td className="px-3 py-2">Cek jumlah antrian pending</td>
                                    </tr>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-2 font-mono">{"/api/print-queue/{id}/done"}</td>
                                        <td className="px-3 py-2"><span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">POST</span></td>
                                        <td className="px-3 py-2">Tandai job selesai dicetak</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-mono">{"/api/print-queue/{id}/fail"}</td>
                                        <td className="px-3 py-2"><span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">POST</span></td>
                                        <td className="px-3 py-2">Tandai job gagal dicetak</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Parameter Autentikasi:</p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                Query param: <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">?token={config.token}</code> atau Header: <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">X-Print-Bridge-Token: {config.token}</code>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

Printer.layout = (page) => <DashboardLayout children={page} />;
