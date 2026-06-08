import React, { useEffect, useState } from "react";
import { usePage, Link } from "@inertiajs/react";
import { IconMenu2, IconHistory, IconWallet, IconQrcode } from "@/Utils/icons";
import AuthDropdown from "@/Components/Dashboard/AuthDropdown";
import Menu from "@/Utils/Menu";
import Notification from "@/Components/Dashboard/Notification";
import QRNotification from "@/Components/Dashboard/QRNotification";
import OutletSwitcher from "@/Components/Dashboard/OutletSwitcher";
import PWADropdown from "@/Components/Dashboard/PWADropdown";

export default function Navbar({ 
    toggleSidebar, 
    themeSwitcher, 
    darkMode, 
    showHistoryButton = false,
    showTimeDate = false,
    currentTime = null,
    formatTime = null,
    formatDate = null,
    activeCashierShift = null
}) {
    const { auth, activeOutlet, availableOutlets, storeProfile } = usePage().props;
    const menuNavigation = Menu();

    // Get current page title
    const links = menuNavigation.flatMap((item) => item.details);
    const sublinks = links
        .filter((item) => item.hasOwnProperty("subdetails"))
        .flatMap((item) => item.subdetails);

    const getCurrentTitle = () => {
        for (const link of links) {
            if (link.hasOwnProperty("subdetails")) {
                const activeSublink = sublinks.find((s) => s.active);
                if (activeSublink) return activeSublink.title;
            } else if (link.active) {
                return link.title;
            }
        }
        return "Dashboard";
    };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <header
            className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6
            bg-white dark:bg-slate-900
            border-b border-slate-200 dark:border-slate-800
            transition-colors duration-200"
        >
            {/* Left Section */}
            <div className="flex items-center gap-4">
                {/* Sidebar Toggle */}
                <button
                    onClick={toggleSidebar}
                    className="flex p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Toggle Sidebar"
                >
                    <IconMenu2 size={20} strokeWidth={1.5} />
                </button>

                {/* Mobile Logo */}
                <div className="md:hidden flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                            {(storeProfile?.name || "P").charAt(0)}
                        </span>
                    </div>
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                        {storeProfile?.name || "POINZA"}
                    </span>
                </div>

                {/* Current Page Title */}
                <div className="hidden md:flex items-center">
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mr-4" />
                    <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                        {getCurrentTitle()}
                    </h1>
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
                <div className="hidden xl:block">
                    <OutletSwitcher
                        activeOutlet={activeOutlet}
                        availableOutlets={availableOutlets}
                        compact
                    />
                </div>

                {/* History Button (POS only) */}
                {showHistoryButton && (
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent("pos:open-history"))}
                        className="p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                        title="Riwayat Transaksi"
                    >
                        <IconHistory size={20} strokeWidth={1.5} />
                    </button>
                )}

                {/* PWA Dropdown */}
                <PWADropdown />

                {/* QR Orders Notification */}
                
                {/* Shift Badge (POS only) */}
                {activeCashierShift && (
                    <Link
                        href={route("cashier-shifts.show", activeCashierShift.id)}
                        className="hidden lg:flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                        title="Shift Aktif"
                    >
                        <IconWallet size={14} />
                        <span>
                            {new Intl.NumberFormat("id-ID").format(
                                activeCashierShift.expected_cash || 0
                            )}
                        </span>
                    </Link>
                )}
                <QRNotification />

                {/* Notifications */}
                <Notification />

                {/* Divider */}
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* User Dropdown */}
                <AuthDropdown auth={auth} isMobile={isMobile} />
            </div>
        </header>
    );
}
