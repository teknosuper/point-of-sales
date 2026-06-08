import React, { useState, useRef, useEffect } from "react";
import { Link, usePage } from "@inertiajs/react";
import { IconQrcode, IconBell, IconX } from "@/Utils/icons";

export default function QRNotification() {
    const { qrOrders } = usePage().props;
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const dropdownRef = useRef(null);
    
    // Mock QR orders count - replace with actual data from props
    const pendingOrders = qrOrders?.pending || 0;

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Pesanan QR Meja"
            >
                <IconQrcode size={20} strokeWidth={1.5} />
                {pendingOrders > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                        {pendingOrders > 9 ? '9+' : pendingOrders}
                    </span>
                )}
            </button>

            {isOpen && (
                isMobile ? (
                    <div className="fixed top-0 right-0 z-50 w-[300px] h-full transition-all duration-300 transform border-l bg-white dark:bg-slate-950 dark:border-slate-900">
                        <div className="flex justify-between items-center gap-2 p-4 border-b mt-2 dark:border-slate-900">
                            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                                Pesanan QR Meja
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={20} className="text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4">
                            {pendingOrders > 0 ? (
                                <div className="space-y-3">
                                    <Link
                                        href={route('table-orders.index')}
                                        className="block px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                    {pendingOrders} pesanan baru
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Menunggu konfirmasi
                                                </p>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-primary-600"></div>
                                        </div>
                                    </Link>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <IconQrcode size={32} className="mx-auto text-slate-400 dark:text-slate-600 mb-2" strokeWidth={1.5} />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Belum ada pesanan QR
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                Pesanan QR Meja
                            </h3>
                        </div>
                        
                        {pendingOrders > 0 ? (
                            <div className="max-h-96 overflow-y-auto">
                                <Link
                                    href={route('table-orders.index')}
                                    className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                {pendingOrders} pesanan baru
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Menunggu konfirmasi
                                            </p>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-primary-600"></div>
                                    </div>
                                </Link>
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <IconQrcode size={32} className="mx-auto text-slate-400 dark:text-slate-600 mb-2" strokeWidth={1.5} />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada pesanan QR
                                </p>
                            </div>
                        )}
                        
                        {pendingOrders > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50">
                                <Link
                                    href={route('table-orders.index')}
                                    className="block text-center text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                >
                                    Lihat Semua Pesanan
                                </Link>
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
