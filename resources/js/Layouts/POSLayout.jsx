import React, { useState, useEffect, useRef } from "react";
import { usePage, Link, router } from "@inertiajs/react";
import { Toaster, toast } from "react-hot-toast";
import { useTheme } from "@/Context/ThemeSwitcherContext";
import Sidebar from "@/Components/Dashboard/Sidebar";
import Navbar from "@/Components/Dashboard/Navbar";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAUpdateControl from "@/Components/PWAUpdateControl";
import {
    IconWallet,
} from "@/Utils/icons";

export default function POSLayout({ children }) {
    const {
        auth,
        storeProfile,
        activeCashierShift,
        activeOutlet,
        availableOutlets,
        flash,
    } = usePage().props;
    const { darkMode, themeSwitcher } = useTheme();
    const [currentTime, setCurrentTime] = useState(new Date());
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

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(timer);
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

    const formatTime = (date) => {
        return date.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="flex h-screen min-h-dvh overflow-hidden bg-slate-100 transition-colors duration-200 dark:bg-slate-950">
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
                    showHistoryButton={true}
                    showTimeDate={true}
                    currentTime={currentTime}
                    formatTime={formatTime}
                    formatDate={formatDate}
                    activeCashierShift={activeCashierShift}
                />

                {/* Main Content - Full Height */}
                <main className="flex-1 overflow-hidden">
                    
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
                    {children}
                </main>
            </div>
        </div>
    );
}
