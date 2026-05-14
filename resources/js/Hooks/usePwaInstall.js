import { useCallback, useEffect, useMemo, useState } from "react";
import {
    detectPwaInstalled,
    persistPwaInstalled,
} from "@/Utils/pwaInstallation";

export default function usePwaInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isChromeLike, setIsChromeLike] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const syncInstalledState = () => {
            const standalone =
                Boolean(
                    window.matchMedia?.("(display-mode: standalone)")?.matches
                ) || window.navigator.standalone === true;
            const installed = detectPwaInstalled();

            setIsStandalone(standalone);
            setIsInstalled(installed);

            if (installed) {
                persistPwaInstalled();
            }
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
            syncInstalledState();
            setDeferredPrompt(null);
        };

        syncInstalledState();

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt
        );
        window.addEventListener("appinstalled", handleInstalled);
        window.addEventListener("focus", syncInstalledState);
        window.addEventListener("pageshow", syncInstalledState);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
            window.removeEventListener("appinstalled", handleInstalled);
            window.removeEventListener("focus", syncInstalledState);
            window.removeEventListener("pageshow", syncInstalledState);
        };
    }, []);

    const canPromptInstall = Boolean(deferredPrompt);
    const shouldShowInstallEntry = !isInstalled && !isStandalone;

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) {
            return { outcome: "unavailable" };
        }

        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice?.outcome === "accepted") {
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
            return "Jika dialog belum muncul, buka halaman setup PWA dan pastikan aplikasi dibuka dari Chrome atau Edge dengan HTTPS atau localhost.";
        }

        return "Gunakan halaman setup PWA untuk melihat langkah manual instalasi di perangkat ini.";
    }, [canPromptInstall, isChromeLike, isInstalled, isIos, isStandalone]);

    return {
        canPromptInstall,
        installHelpText,
        isChromeLike,
        isInstalled,
        isIos,
        isStandalone,
        promptInstall,
        shouldShowInstallEntry,
    };
}
