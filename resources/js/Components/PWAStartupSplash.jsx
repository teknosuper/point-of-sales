import { useEffect, useState } from "react";
import { IconShoppingCart } from "@/Utils/icons";

const MIN_SPLASH_MS = 900;

export default function PWAStartupSplash() {
    const [visible, setVisible] = useState(false);
    const pwaConfig =
        typeof window !== "undefined" ? window.__PWA_CONFIG || null : null;
    const isMenuApp = pwaConfig?.kind === "menu";

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
        <div className={`pointer-events-none fixed inset-0 z-[10000] overflow-hidden ${
            isMenuApp
                ? "bg-[linear-gradient(180deg,#e2e8f0_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_52%,#082f49_100%)]"
                : "bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_48%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#0f172a_0%,#111827_52%,#020617_100%)]"
        }`}>
            <div className={`absolute inset-x-0 top-0 h-56 ${
                isMenuApp
                    ? "bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.24),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_58%)]"
                    : "bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.24),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_58%)]"
            }`} />

            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className={`pwa-startup-orb mb-5 flex h-24 w-24 items-center justify-center rounded-[30px] text-white ${
                    isMenuApp
                        ? "bg-[linear-gradient(145deg,#0f172a_0%,#0f766e_52%,#0ea5e9_100%)] shadow-[0_30px_80px_-30px_rgba(14,165,233,0.55)]"
                        : "bg-[linear-gradient(145deg,#4f46e5_0%,#4338ca_52%,#312e81_100%)] shadow-[0_30px_80px_-30px_rgba(79,70,229,0.65)]"
                }`}>
                    {isMenuApp ? <MenuGlyph /> : <IconShoppingCart size={42} strokeWidth={1.8} />}
                </div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.34em] ${
                    isMenuApp ? "text-sky-700 dark:text-sky-300" : "text-primary-600 dark:text-primary-300"
                }`}>
                    {pwaConfig?.name || "GTC KASIR"}
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                    {pwaConfig?.splash_title || "Menyiapkan workspace"}
                </h1>
                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {pwaConfig?.splash_description || "Memuat aplikasi, sesi perangkat, dan komponen kerja utama."}
                </p>

                <div className="mt-8 w-full max-w-[14rem] overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div className={`pwa-startup-progress h-1.5 rounded-full ${
                        isMenuApp
                            ? "bg-gradient-to-r from-slate-900 via-sky-500 to-teal-500"
                            : "bg-gradient-to-r from-primary-500 via-sky-500 to-primary-600"
                    }`} />
                </div>
            </div>
        </div>
    );
}

function MenuGlyph() {
    return (
        <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-11 w-11"
        >
            <circle cx="32" cy="36" r="17" fill="white" fillOpacity="0.96" />
            <circle cx="32" cy="36" r="10" fill="#BAE6FD" />
            <path d="M21 16C22.5 10.5 27 7 32 7H38C43 7 47.5 10.5 49 16" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M18 20H46" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
            <path d="M25.5 29V41M25.5 34H35.5" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M43 28V42M40 28H46M43 34H46" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
    );
}
