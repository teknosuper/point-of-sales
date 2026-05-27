import React, { useEffect, useRef, useState } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { Toaster, toast } from "react-hot-toast";
import {
    IconChefHat,
    IconDotsVertical,
    IconLogout,
    IconMenu2,
    IconX,
} from "@/Utils/icons";
import Sidebar from "@/Components/Dashboard/Sidebar";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAInstallButton from "@/Components/PWAInstallButton";
import PWAUpdateControl from "@/Components/PWAUpdateControl";
import {
    brandPlaceholderDataUri,
    setFallbackImage,
} from "@/Utils/imagePlaceholder";

export default function KitchenLayout({ children }) {
    const { auth, activeOutlet, storeProfile, flash, kioskMode } = usePage().props;
    const lastFlashSignatureRef = useRef(null);
    const mobileActionsRef = useRef(null);
    const [showMobileActions, setShowMobileActions] = useState(false);
    const getInitialSidebarState = () => {
        if (typeof window === "undefined") return false;
        const stored = localStorage.getItem("kitchenSidebarOpen");
        if (stored !== null) return stored === "true";
        return false;
    };
    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);

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

    const handleLogout = () => {
        setShowMobileActions(false);
        router.post(route("logout"));
    };

    useEffect(() => {
        if (!showMobileActions) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (!mobileActionsRef.current?.contains(event.target)) {
                setShowMobileActions(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setShowMobileActions(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown, {
            passive: true,
        });
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [showMobileActions]);

    useEffect(() => {
        const unbindStart = router.on("start", () => {
            setShowMobileActions(false);
        });

        return () => {
            unbindStart();
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || kioskMode) {
            return;
        }

        localStorage.setItem("kitchenSidebarOpen", String(sidebarOpen));
    }, [sidebarOpen, kioskMode]);

    useEffect(() => {
        if (typeof window === "undefined" || kioskMode) {
            return undefined;
        }

        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [kioskMode]);

    const brandName = storeProfile?.name || "Layar Dapur";
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
            <Toaster position={kioskMode ? "top-center" : "top-right"} />
            {!kioskMode ? (
                <div
                    className={`fixed inset-0 z-30 bg-slate-950/30 transition-opacity lg:hidden ${
                        sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                />
            ) : null}
            <div className={kioskMode ? "min-h-screen" : "flex min-h-screen"}>
            {!kioskMode ? (
                <Sidebar sidebarOpen={sidebarOpen} hideWhenCollapsed />
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {!kioskMode ? (
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <div
                        ref={mobileActionsRef}
                        className="relative flex items-center gap-3"
                    >
                        <button
                            type="button"
                            onClick={() => setSidebarOpen((value) => !value)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            aria-label="Toggle menu dapur"
                        >
                            <IconMenu2 size={18} />
                        </button>
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
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {auth?.user?.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Mode dapur
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMobileActions((value) => !value)}
                            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:hidden"
                            aria-label="Aksi akun dapur"
                            aria-expanded={showMobileActions}
                        >
                            {showMobileActions ? (
                                <IconX size={18} />
                            ) : (
                                <IconDotsVertical size={18} />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconLogout size={16} />
                            Keluar
                        </button>
                    </div>
                </div>
            </header>
            ) : null}

            {!kioskMode && showMobileActions ? (
                <div className="sticky top-[73px] z-40 border-b border-slate-200 bg-white/96 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/96 sm:hidden">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {auth?.user?.name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Mode dapur
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <PWAConnectionStatus compact />
                            <PWAInstallButton compact />
                            <PWAUpdateControl compact />
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 active:scale-[0.99] dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300"
                        >
                            <IconLogout size={16} />
                            Keluar dari akun dapur
                        </button>
                    </div>
                </div>
            ) : null}

            <main
                className={
                    kioskMode
                        ? "px-3 py-3 sm:px-4 lg:px-4"
                        : "px-4 py-6 sm:px-6 lg:px-8"
                }
            >
                {children}
            </main>
            </div>
            </div>
        </div>
    );
}
