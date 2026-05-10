import React, { useEffect, useRef } from "react";
import { Link, usePage } from "@inertiajs/react";
import { Toaster, toast } from "react-hot-toast";
import { IconChefHat, IconLogout } from "@tabler/icons-react";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAInstallButton from "@/Components/PWAInstallButton";
import {
    brandPlaceholderDataUri,
    setFallbackImage,
} from "@/Utils/imagePlaceholder";

export default function KitchenLayout({ children }) {
    const { auth, activeOutlet, storeProfile, flash, kioskMode } = usePage().props;
    const lastFlashSignatureRef = useRef(null);

    useEffect(() => {
        const entries = [
            ["success", flash?.success],
            ["error", flash?.error],
            ["warning", flash?.warning],
            ["info", flash?.info],
            ["status", flash?.status],
        ].filter(([, message]) => Boolean(message));

        if (!entries.length) {
            lastFlashSignatureRef.current = null;
            return;
        }

        const signature = entries
            .map(([type, message]) => `${type}:${message}`)
            .join("|");

        if (lastFlashSignatureRef.current === signature) {
            return;
        }

        lastFlashSignatureRef.current = signature;

        entries.forEach(([type, message]) => {
            if (type === "success" || type === "status") {
                toast.success(message);
                return;
            }

            if (type === "error") {
                toast.error(message, { duration: 4500 });
                return;
            }

            if (type === "warning") {
                toast(message, { duration: 4500, icon: "!" });
                return;
            }

            toast(message);
        });
    }, [flash]);

    const brandName = storeProfile?.name || "Layar Dapur";

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
            <Toaster position={kioskMode ? "top-center" : "top-right"} />
            {!kioskMode ? (
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-primary-600 text-white">
                            {storeProfile?.logo ? (
                                <img
                                    src={storeProfile.logo}
                                    alt={brandName}
                                    className="h-full w-full object-contain"
                                    onError={(event) =>
                                        setFallbackImage(
                                            event,
                                            brandPlaceholderDataUri(brandName)
                                        )
                                    }
                                />
                            ) : (
                                <IconChefHat size={22} />
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {brandName}
                            </p>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                {activeOutlet?.name || "Outlet belum dipilih"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <PWAConnectionStatus compact />
                        <PWAInstallButton compact />
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {auth?.user?.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Mode dapur
                            </p>
                        </div>
                        <Link
                            href={route("logout")}
                            method="post"
                            as="button"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconLogout size={16} />
                            Keluar
                        </Link>
                    </div>
                </div>
            </header>
            ) : null}

            <main
                className={
                    kioskMode
                        ? "px-3 py-3 sm:px-4 lg:px-4"
                        : "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
                }
            >
                {children}
            </main>
        </div>
    );
}
