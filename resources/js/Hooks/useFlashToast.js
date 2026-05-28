import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import toast from "react-hot-toast";

/**
 * Hook reusable untuk menampilkan flash message dari server sebagai toast.
 * Cukup panggil `useFlashToast()` di halaman mana pun, dan semua flash
 * (success, error, warning, info, status) akan otomatis ditampilkan.
 *
 * Dilengkapi deduplication agar toast tidak muncul ganda saat re-render.
 */
export default function useFlashToast() {
    const { flash } = usePage().props;
    const lastSignature = useRef(null);

    useEffect(() => {
        const entries = [
            ["success", flash?.success],
            ["error", flash?.error],
            ["warning", flash?.warning],
            ["info", flash?.info],
            ["status", flash?.status],
        ].filter(([, message]) => Boolean(message));

        if (!entries.length) {
            lastSignature.current = null;
            return;
        }

        const signature = entries
            .map(([type, msg]) => `${type}:${msg}`)
            .join("|");

        if (lastSignature.current === signature) {
            return;
        }

        lastSignature.current = signature;

        entries.forEach(([type, message]) => {
            switch (type) {
                case "success":
                case "status":
                    toast.success(message);
                    break;
                case "error":
                    toast.error(message, { duration: 4500 });
                    break;
                case "warning":
                    toast(message, { icon: "⚠️", duration: 4500 });
                    break;
                default:
                    toast(message);
                    break;
            }
        });
    }, [flash]);
}