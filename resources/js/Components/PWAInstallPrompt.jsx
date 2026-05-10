import { useEffect, useMemo, useState } from "react";
import { IconDeviceMobile, IconDownload, IconX } from "@tabler/icons-react";
import { detectPwaInstalled, persistPwaInstalled } from "@/Utils/pwaInstallation";

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const syncInstalledState = () => {
            const installed = detectPwaInstalled();
            setIsStandalone(installed);
            setIsInstalled(installed);

            if (installed) {
                persistPwaInstalled();
            }
        };

        syncInstalledState();

        const ua = window.navigator.userAgent || "";
        const ios = /iphone|ipad|ipod/i.test(ua);
        setIsIos(ios);

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
        };

        const handleInstalled = () => {
            persistPwaInstalled();
            syncInstalledState();
            setDeferredPrompt(null);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleInstalled);
        window.addEventListener("focus", syncInstalledState);
        window.addEventListener("pageshow", syncInstalledState);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleInstalled);
            window.removeEventListener("focus", syncInstalledState);
            window.removeEventListener("pageshow", syncInstalledState);
        };
    }, []);

    const canShow = useMemo(() => {
        if (dismissed || isInstalled || isStandalone) return false;
        return Boolean(deferredPrompt) || isIos;
    }, [deferredPrompt, dismissed, isInstalled, isStandalone, isIos]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "accepted") {
            setDeferredPrompt(null);
        }
    };

    if (!canShow) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-2xl border border-primary-200 bg-white p-4 shadow-xl dark:border-primary-900/40 dark:bg-slate-900 print:hidden">
            <button
                type="button"
                onClick={() => setDismissed(true)}
                className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Tutup"
            >
                <IconX size={16} />
            </button>

            <div className="flex items-start gap-3 pr-6">
                <div className="rounded-2xl bg-primary-100 p-3 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    <IconDeviceMobile size={20} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Instal aplikasi POINZA
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Pasang ke layar utama agar akses kasir, dapur, dan dashboard terasa seperti aplikasi.
                    </p>

                    {deferredPrompt ? (
                        <button
                            type="button"
                            onClick={handleInstall}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                        >
                            <IconDownload size={16} />
                            Instal Aplikasi
                        </button>
                    ) : isIos ? (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Di iPhone/iPad, gunakan menu <span className="font-semibold">Bagikan</span> lalu pilih <span className="font-semibold">Tambahkan ke Layar Utama</span>.
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
