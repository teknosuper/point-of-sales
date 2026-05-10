import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link } from "@inertiajs/react";
import { IconArrowLeft, IconDeviceTablet, IconPrinter } from "@tabler/icons-react";

const copyText = async (value) => {
    try {
        await navigator.clipboard.writeText(value);
    } catch {
        // ignore clipboard failures on older browsers
    }
};

const modeLabels = {
    screen: "Layar",
    printer: "Printer",
    tablet: "Tablet",
};

const profileLabels = {
    browser_manual: "Browser Manual",
    rawbt_android: "RawBT Android",
    qz_tray: "QZ Tray",
    local_bridge: "Bridge Lokal",
};

export default function AccessSheet({ station }) {
    const shortcutUrls = station?.shortcut_urls || {};
    const devices = station?.devices || [];

    return (
        <>
            <Head title={`Lembar Akses ${station?.name || "Dapur"}`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Lembar Akses Stasiun
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Gunakan halaman ini untuk membagikan akses cepat ke tablet atau petugas dapur.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={route("settings.kitchen-devices.index", {
                                outlet_id: station?.outlet?.id,
                            })}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconArrowLeft size={16} />
                            Kembali
                        </Link>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white"
                        >
                            <IconPrinter size={16} />
                            Cetak
                        </button>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-0 print:shadow-none">
                    <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
                            {station?.outlet?.code || "OUTLET"} • {station?.station_type || "dapur"}
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                            {station?.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Outlet {station?.outlet?.name} • Mode {modeLabels[station?.display_mode] || station?.display_mode}
                        </p>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <IconDeviceTablet size={18} />
                                <p className="font-semibold">Tautan Tablet / Kiosk</p>
                            </div>
                            <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-300">
                                {shortcutUrls.kiosk_url}
                            </p>
                            <button
                                type="button"
                                onClick={() => copyText(shortcutUrls.kiosk_url)}
                                className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 print:hidden"
                            >
                                Salin Tautan Kiosk
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <IconPrinter size={18} />
                                <p className="font-semibold">Tautan Masuk Stasiun</p>
                            </div>
                            <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-300">
                                {shortcutUrls.entry_url}
                            </p>
                            <button
                                type="button"
                                onClick={() => copyText(shortcutUrls.entry_url)}
                                className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 print:hidden"
                            >
                                Salin Tautan Stasiun
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Cara Pakai di Tablet
                            </p>
                            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                                <li>Buka Tautan Tablet / Kiosk di browser tablet.</li>
                                <li>Login memakai akun dapur jika diminta.</li>
                                <li>Tekan tombol layar penuh di layar antrean.</li>
                                <li>Simpan tautan kiosk ke layar utama agar mudah dibuka ulang.</li>
                            </ol>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Perangkat Aktif di Stasiun
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                {devices.length ? (
                                    devices.map((device) => (
                                        <div
                                            key={device.id}
                                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30"
                                        >
                                            <p className="font-medium text-slate-800 dark:text-slate-100">
                                                {device.name}
                                                {device.is_primary ? " • Utama" : ""}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {modeLabels[device.device_type] || device.device_type} • {profileLabels[device.print_profile] || device.print_profile || "Manual"}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Belum ada perangkat aktif yang terhubung ke stasiun ini.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Tautan login dapur langsung: {shortcutUrls.login_url}
                    </div>
                </div>
            </div>
        </>
    );
}

AccessSheet.layout = (page) => <DashboardLayout children={page} />;
