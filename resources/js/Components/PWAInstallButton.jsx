import { useCallback } from "react";
import { IconDownload } from "@tabler/icons-react";
import toast from "react-hot-toast";
import usePwaInstall from "@/Hooks/usePwaInstall";

export default function PWAInstallButton({ compact = false }) {
    const { canPromptInstall, isIos, promptInstall, shouldShowInstallEntry } =
        usePwaInstall();

    const handleInstall = useCallback(async () => {
        if (canPromptInstall) {
            await promptInstall();
            return;
        }

        if (isIos) {
            toast("Gunakan Bagikan lalu pilih Tambahkan ke Layar Utama.", {
                duration: 4000,
                icon: "📲",
            });
            window.location.href = route("guides.pwa-setup");
            return;
        }

        window.location.href = route("guides.pwa-setup");
    }, [canPromptInstall, isIos, promptInstall]);

    if (!shouldShowInstallEntry) return null;

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
            {canPromptInstall ? "Instal Aplikasi" : "Halaman Install PWA"}
        </button>
    );
}
