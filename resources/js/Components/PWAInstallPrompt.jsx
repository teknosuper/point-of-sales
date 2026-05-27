import { useEffect, useMemo, useState } from "react";
import {
    IconArrowRight,
    IconDeviceMobile,
    IconDownload,
    IconX,
} from "@/Utils/icons";
import usePwaInstall from "@/Hooks/usePwaInstall";

export default function PWAInstallPrompt() {
    const [dismissed, setDismissed] = useState(false);
    const {
        canPromptInstall,
        installHelpText,
        promptInstall,
        shouldShowInstallEntry,
    } = usePwaInstall();

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        setDismissed(window.localStorage.getItem("pwaInstallPromptDismissed") === "true");
    }, []);

    const canShow = useMemo(() => {
        if (typeof window !== "undefined") {
            const pathname = window.location?.pathname || "";
            if (/^\/order\/table\//.test(pathname) || pathname.startsWith("/dashboard/guides/pwa-setup")) {
                return false;
            }
        }

        if (dismissed || !shouldShowInstallEntry) return false;
        return true;
    }, [dismissed, shouldShowInstallEntry]);

    const handleInstall = async () => {
        if (canPromptInstall) {
            await promptInstall();
            return;
        }

        window.location.href = route("guides.pwa-setup");
    };

    const handleDismiss = () => {
        setDismissed(true);

        if (typeof window !== "undefined") {
            window.localStorage.setItem("pwaInstallPromptDismissed", "true");
        }
    };

    if (!canShow) return null;

    return (
        <div className="fixed inset-x-4 bottom-4 z-[80] max-w-sm rounded-2xl border border-primary-200 bg-white p-4 shadow-xl sm:left-auto sm:right-4 sm:inset-x-auto dark:border-primary-900/40 dark:bg-slate-900 print:hidden">
            <button
                type="button"
                onClick={handleDismiss}
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
                        {installHelpText}
                    </p>

                    {canPromptInstall ? (
                        <button
                            type="button"
                            onClick={handleInstall}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                        >
                            <IconDownload size={16} />
                            Instal Aplikasi
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleInstall}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-200"
                        >
                            <IconArrowRight size={16} />
                            Buka Halaman Install
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
