import { useEffect, useState } from "react";
import { IconCloudCheck, IconCloudOff } from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function PWAConnectionStatus({ compact = false }) {
    const [isOnline, setIsOnline] = useState(
        typeof navigator === "undefined" ? true : navigator.onLine
    );

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Koneksi kembali aktif.");
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.error("Perangkat sedang offline.", {
                duration: 4000,
            });
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const baseClass = compact
        ? "px-3 py-2 text-sm font-medium"
        : "px-4 py-2.5 text-sm font-semibold";

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-xl border transition ${
                isOnline
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
            } ${baseClass}`}
        >
            {isOnline ? <IconCloudCheck size={16} /> : <IconCloudOff size={16} />}
            <span>{isOnline ? "Online" : "Offline"}</span>
        </div>
    );
}
