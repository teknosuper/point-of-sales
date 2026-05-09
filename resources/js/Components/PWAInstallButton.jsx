import { useEffect, useMemo, useState } from "react";
import { IconDownload } from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function PWAInstallButton({ compact = false }) {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const standalone =
            window.matchMedia?.("(display-mode: standalone)")?.matches ||
            window.navigator.standalone === true;
        setIsInstalled(Boolean(standalone));

        const ua = window.navigator.userAgent || "";
        setIsIos(/iphone|ipad|ipod/i.test(ua));

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
        };

        const handleInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    const visible = useMemo(
        () => !isInstalled && (Boolean(deferredPrompt) || isIos),
        [deferredPrompt, isInstalled, isIos]
    );

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice?.outcome === "accepted") {
                setDeferredPrompt(null);
            }
            return;
        }

        if (isIos) {
            toast("Gunakan Share lalu pilih Add to Home Screen.", {
                duration: 4000,
                icon: "📲",
            });
        }
    };

    if (!visible) return null;

    return (
        <button
            type="button"
            onClick={handleInstall}
            className={`inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 transition hover:border-primary-300 hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-200 ${
                compact
                    ? "px-3 py-2 text-sm font-medium"
                    : "px-4 py-2.5 text-sm font-semibold"
            }`}
        >
            <IconDownload size={16} />
            Install App
        </button>
    );
}
