import React, { useEffect, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import Sidebar from "@/Components/Dashboard/Sidebar";
import Navbar from "@/Components/Dashboard/Navbar";
import ConcurrentSessionWatcher from "@/Components/Dashboard/ConcurrentSessionWatcher";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAInstallButton from "@/Components/PWAInstallButton";
import PWAUpdateControl from "@/Components/PWAUpdateControl";
import { Toaster, toast } from "react-hot-toast";
import { useTheme } from "@/Context/ThemeSwitcherContext";

export default function AppLayout({ children }) {
    const { darkMode, themeSwitcher } = useTheme();
    const { auth, security, flash } = usePage().props;
    const lastFlashSignatureRef = useRef(null);

    const getInitialSidebarState = () => {
        if (typeof window === "undefined") return false;
        const stored = localStorage.getItem("sidebarOpen");
        if (stored !== null) return stored === "true";
        // Default collapsed for cleaner look
        return false;
    };

    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);
    const [isMobile, setIsMobile] = useState(
        typeof window !== "undefined" ? window.innerWidth < 768 : false
    );
    const [showDeviceTools, setShowDeviceTools] = useState(false);

    useEffect(() => {
        localStorage.setItem("sidebarOpen", sidebarOpen);
    }, [sidebarOpen]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

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
                toast(message, {
                    duration: 4500,
                    icon: "!",
                });
                return;
            }

            toast(message);
        });
    }, [flash]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const securityWarnings = security?.warnings ?? [];
    const showSecurityWarnings =
        auth?.super === true && securityWarnings.length > 0;

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar sidebarOpen={sidebarOpen} />
            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 bg-slate-900/40 md:hidden transition-opacity duration-300 ${
                    sidebarOpen ? "opacity-100 pointer-events-auto z-30" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setSidebarOpen(false)}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Navbar
                    toggleSidebar={toggleSidebar}
                    themeSwitcher={themeSwitcher}
                    darkMode={darkMode}
                />
                <main className="dashboard-scrollbar flex-1 overflow-y-auto">
                    <div className="w-full py-6 px-4 md:px-6 lg:px-8 pb-20 md:pb-6">
                        <div className="mb-4 print:hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                        Perangkat & aplikasi
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Buka hanya saat perlu cek koneksi, install, atau update.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowDeviceTools((value) => !value)
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    {showDeviceTools
                                        ? "Sembunyikan"
                                        : "Buka alat perangkat"}
                                </button>
                            </div>
                            {showDeviceTools ? (
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <PWAConnectionStatus />
                                    <PWAInstallButton />
                                    <PWAUpdateControl />
                                </div>
                            ) : null}
                        </div>
                        {showSecurityWarnings && (
                            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                <p className="text-sm font-semibold">
                                    Production security baseline warning
                                </p>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {securityWarnings.map((warning) => (
                                        <li key={warning.key}>
                                            - {warning.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                className: "text-sm",
                                duration: 3000,
                                style: {
                                    background: darkMode ? "#1e293b" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    border: `1px solid ${
                                        darkMode ? "#334155" : "#e2e8f0"
                                    }`,
                                    borderRadius: "12px",
                                },
                            }}
                        />
                        <ConcurrentSessionWatcher enabled={Boolean(auth?.user)} />
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
