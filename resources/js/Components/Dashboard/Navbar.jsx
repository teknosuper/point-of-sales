import React, { useEffect, useState } from "react";
import { usePage, Link } from "@inertiajs/react";
import { IconMenu2, IconHistory, IconWallet, IconQrcode } from "@/Utils/icons";
import AuthDropdown from "@/Components/Dashboard/AuthDropdown";
import Menu from "@/Utils/Menu";
import Notification from "@/Components/Dashboard/Notification";
import QRNotification from "@/Components/Dashboard/QRNotification";
import OrderNotificationBell from "@/Components/OrderNotificationBell";
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
    const { auth, activeOutlet, availableOutlets, storeProfile, notificationAccess } = usePage().props;
    const menuNavigation = Menu();
    const showQrNotification = notificationAccess?.qrOrders === true;
    const showGeneralNotification =
        notificationAccess?.stock === true || notificationAccess?.finance === true;

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

    const formatShiftCash = (value = 0) =>
        new Intl.NumberFormat("id-ID").format(Number(value || 0));

    const formatCompactShiftCash = (value = 0) => {
        const amount = Math.max(0, Number(value || 0));

        if (amount >= 1000) {
            return new Intl.NumberFormat("id-ID", {
                notation: "compact",
                maximumFractionDigits: 1,
            }).format(amount);
        }

        return String(amount);
    };

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
                        {storeProfile?.name || "GTC KASIR"}
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 sm:px-2.5 sm:text-xs"
                        title="Shift Aktif"
                    >
                        <IconWallet size={14} />
                        <span className="lg:hidden">
                            {formatCompactShiftCash(
                                activeCashierShift.expected_cash || 0
                            )}
                        </span>
                        <span className="hidden lg:inline">
                            {formatShiftCash(
                                activeCashierShift.expected_cash || 0
                            )}
                        </span>
                    </Link>
                )}
                {showQrNotification ? <QRNotification /> : null}
                {activeOutlet?.outlet_type === 'tenant' || activeOutlet?.outlet_type === 'kitchen' ? <OrderNotificationBell outletId={activeOutlet?.id} /> : null}

                {/* Notifications */}
                {showGeneralNotification ? <Notification /> : null}

                {/* Divider */}
                {(showQrNotification || showGeneralNotification) ? (
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />
                ) : null}

                {/* User Dropdown */}
                <AuthDropdown auth={auth} isMobile={isMobile} />
            </div>
        </header>
    );
}
