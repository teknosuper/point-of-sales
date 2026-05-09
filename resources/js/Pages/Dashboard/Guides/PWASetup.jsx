import DashboardLayout from "@/Layouts/DashboardLayout";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAInstallButton from "@/Components/PWAInstallButton";
import { Head, Link } from "@inertiajs/react";
import {
    IconBolt,
    IconChecklist,
    IconDeviceMobile,
    IconHome,
    IconPlugConnected,
    IconShieldCheck,
    IconWifi,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

export default function PWASetup({ platforms = [], recommendedRoutes = [] }) {
    const [diagnostics, setDiagnostics] = useState({
        secureContext: false,
        serviceWorker: false,
        standalone: false,
        online: true,
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        const sync = () => {
            setDiagnostics({
                secureContext: Boolean(window.isSecureContext),
                serviceWorker: "serviceWorker" in navigator,
                standalone:
                    Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches) ||
                    window.navigator.standalone === true,
                online: navigator.onLine,
            });
        };

        sync();
        window.addEventListener("online", sync);
        window.addEventListener("offline", sync);

        return () => {
            window.removeEventListener("online", sync);
            window.removeEventListener("offline", sync);
        };
    }, []);

    const diagnosticItems = [
        {
            label: "Secure Context",
            description: "PWA install dan service worker butuh HTTPS atau localhost.",
            ok: diagnostics.secureContext,
            icon: <IconShieldCheck size={18} />,
        },
        {
            label: "Service Worker",
            description: "Dipakai untuk cache statis dan fallback offline.",
            ok: diagnostics.serviceWorker,
            icon: <IconBolt size={18} />,
        },
        {
            label: "Status Koneksi",
            description: "Berguna untuk kasir dan kitchen agar tahu saat jaringan putus.",
            ok: diagnostics.online,
            icon: <IconWifi size={18} />,
        },
        {
            label: "Mode App / Standalone",
            description: "Aktif setelah app dibuka dari hasil install atau Add to Home Screen.",
            ok: diagnostics.standalone,
            icon: <IconDeviceMobile size={18} />,
        },
    ];

    return (
        <>
            <Head title="Setup PWA & Device" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Setup PWA & Device
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Panduan instalasi aplikasi web ke Android, iPhone, desktop, dan pengecekan dasar PWA tanpa membuka DevTools.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <PWAConnectionStatus />
                        <PWAInstallButton />
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    {diagnosticItems.map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className={`rounded-xl p-2 ${
                                        item.ok
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                    }`}
                                >
                                    {item.icon}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {item.label}
                                    </p>
                                    <p
                                        className={`text-xs font-medium ${
                                            item.ok
                                                ? "text-emerald-600 dark:text-emerald-300"
                                                : "text-amber-600 dark:text-amber-300"
                                        }`}
                                    >
                                        {item.ok ? "Siap" : "Perlu perhatian"}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                            <IconChecklist size={20} className="text-primary-600" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Checklist Per Platform
                            </h2>
                        </div>
                        <div className="mt-4 space-y-4">
                            {platforms.map((platform) => (
                                <div
                                    key={platform.name}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                                >
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {platform.name}
                                    </p>
                                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                                        {platform.steps.map((step) => (
                                            <li key={step}>{step}</li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <IconHome size={20} className="text-primary-600" />
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Start URL yang Direkomendasikan
                                </h2>
                            </div>
                            <div className="mt-4 space-y-3">
                                {recommendedRoutes.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-primary-300 dark:border-slate-800 dark:bg-slate-950/30"
                                    >
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {item.label}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {item.description}
                                        </p>
                                        <p className="mt-2 break-all text-xs text-primary-600 dark:text-primary-300">
                                            {item.href}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                            <div className="flex items-center gap-2">
                                <IconPlugConnected size={18} />
                                <p className="font-semibold">Catatan Operasional</p>
                            </div>
                            <ul className="mt-3 space-y-2 text-blue-800 dark:text-blue-200">
                                <li>Gunakan `localhost` atau HTTPS agar service worker dan install prompt aktif.</li>
                                <li>Untuk tablet dapur, kombinasikan PWA dengan `Link Tablet / Kiosk` per station.</li>
                                <li>Untuk kasir, lebih aman install langsung dari halaman POS agar shortcut membuka konteks transaksi.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

PWASetup.layout = (page) => <DashboardLayout children={page} />;
