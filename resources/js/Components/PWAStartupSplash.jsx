import { useEffect, useState } from "react";
import { IconShoppingCart } from "@tabler/icons-react";

const MIN_SPLASH_MS = 900;

export default function PWAStartupSplash() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const pathname = window.location?.pathname || "";
        const isPrintRoute = /\/print$/.test(pathname) || pathname.includes("/print/");

        if (isPrintRoute) {
            return undefined;
        }

        const isStandalone =
            Boolean(
                window.matchMedia?.("(display-mode: standalone)")?.matches
            ) || window.navigator.standalone === true;

        if (!isStandalone) {
            return undefined;
        }

        setVisible(true);
        const startedAt = Date.now();
        let hideTimer = null;

        const finishSplash = () => {
            const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
            hideTimer = window.setTimeout(() => {
                setVisible(false);
            }, remaining);
        };

        if (document.readyState === "complete") {
            finishSplash();
        } else {
            window.addEventListener("load", finishSplash, { once: true });
        }

        return () => {
            if (hideTimer) {
                window.clearTimeout(hideTimer);
            }
            window.removeEventListener("load", finishSplash);
        };
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#0f172a_0%,#111827_52%,#020617_100%)]">
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.24),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_58%)]" />

            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="pwa-startup-orb mb-5 flex h-24 w-24 items-center justify-center rounded-[30px] bg-[linear-gradient(145deg,#4f46e5_0%,#4338ca_52%,#312e81_100%)] text-white shadow-[0_30px_80px_-30px_rgba(79,70,229,0.65)]">
                    <IconShoppingCart size={42} strokeWidth={1.8} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-primary-600 dark:text-primary-300">
                    POINZA
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                    Menyiapkan workspace
                </h1>
                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Memuat aplikasi, sesi perangkat, dan komponen kerja utama.
                </p>

                <div className="mt-8 w-full max-w-[14rem] overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div className="pwa-startup-progress h-1.5 rounded-full bg-gradient-to-r from-primary-500 via-sky-500 to-primary-600" />
                </div>
            </div>
        </div>
    );
}
