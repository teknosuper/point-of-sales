import { useCallback, useEffect, useMemo, useState } from "react";
import {
    detectPwaInstalled,
    persistPwaInstalled,
    probePwaInstalled,
} from "@/Utils/pwaInstallation";

export default function usePwaInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isChromeLike, setIsChromeLike] = useState(false);
    const [isCheckingInstallState, setIsCheckingInstallState] = useState(true);
    const isPwaEnabled =
        typeof window !== "undefined"
            ? Boolean(window.__PWA_CONFIG?.sw)
            : false;
    const appLabel =
        typeof window !== "undefined"
            ? window.__PWA_CONFIG?.name || "GTC KASIR"
            : "GTC KASIR";
    const pwaKind =
        typeof window !== "undefined"
            ? window.__PWA_CONFIG?.kind || "default"
            : "default";

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const syncInstalledState = async () => {
            setIsCheckingInstallState(true);
            const standalone =
                Boolean(
                    window.matchMedia?.("(display-mode: standalone)")?.matches
                ) ||
                Boolean(
                    window.matchMedia?.("(display-mode: window-controls-overlay)")?.matches
                ) ||
                Boolean(
                    window.matchMedia?.("(display-mode: minimal-ui)")?.matches
                ) ||
                window.navigator.standalone === true;
            let installed = detectPwaInstalled();

            if (!installed) {
                installed = await probePwaInstalled();
            }

            setIsStandalone(standalone);
            setIsInstalled(installed);

            if (installed) {
                persistPwaInstalled();
            }

            setIsCheckingInstallState(false);
        };

        const ua = window.navigator.userAgent || "";
        setIsIos(/iphone|ipad|ipod/i.test(ua));
        setIsChromeLike(
            /(chrome|chromium|crios|edg|edge)/i.test(ua) &&
                !/opr\//i.test(ua)
        );

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
        };

        const handleInstalled = () => {
            persistPwaInstalled();
            setDeferredPrompt(null);
            setIsInstalled(true);
            setIsStandalone(true);
        };

        syncInstalledState();

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt
        );
        window.addEventListener("appinstalled", handleInstalled);
        const handleFocus = () => {
            syncInstalledState();
        };
        const handlePageShow = () => {
            syncInstalledState();
        };

        window.addEventListener("focus", handleFocus);
        window.addEventListener("pageshow", handlePageShow);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
            window.removeEventListener("appinstalled", handleInstalled);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("pageshow", handlePageShow);
        };
    }, []);

    const canPromptInstall = Boolean(deferredPrompt);
    const shouldShowInstallEntry = isPwaEnabled && !isInstalled && !isStandalone;

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) {
            return { outcome: "unavailable" };
        }

        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice?.outcome === "accepted") {
            persistPwaInstalled();
            setIsInstalled(true);
            setDeferredPrompt(null);
        }

        return choice ?? { outcome: "dismissed" };
    }, [deferredPrompt]);

    const installHelpText = useMemo(() => {
        if (isInstalled || isStandalone) {
            return "Aplikasi sudah berjalan dalam mode terpasang.";
        }

        if (canPromptInstall) {
            return "Perangkat ini siap menampilkan dialog instalasi aplikasi.";
        }

        if (isIos) {
            return "Di iPhone/iPad, gunakan Safari lalu pilih Bagikan > Tambahkan ke Layar Utama.";
        }

        if (isChromeLike) {
            if (pwaKind === "menu") {
                return "Jika dialog belum muncul, buka menu ini dari Chrome atau Edge lalu gunakan opsi Install app pada browser.";
            }

            return "Jika dialog belum muncul, buka halaman setup PWA dan pastikan aplikasi dibuka dari Chrome atau Edge dengan HTTPS atau localhost.";
        }

        if (pwaKind === "menu") {
            return "Gunakan menu browser untuk menambahkan aplikasi ini ke layar utama bila perangkat mendukung.";
        }

        return "Gunakan halaman setup PWA untuk melihat langkah manual instalasi di perangkat ini.";
    }, [canPromptInstall, isChromeLike, isInstalled, isIos, isStandalone, pwaKind]);

    return {
        appLabel,
        canPromptInstall,
        installHelpText,
        isChromeLike,
        isCheckingInstallState,
        isInstalled,
        isIos,
        pwaKind,
        isPwaEnabled,
        isStandalone,
        promptInstall,
        shouldShowInstallEntry,
    };
}
