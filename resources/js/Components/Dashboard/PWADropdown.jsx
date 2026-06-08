import React, { useState, useRef, useEffect } from "react";
import { IconWifi, IconChevronDown, IconX } from "@/Utils/icons";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAUpdateControl from "@/Components/PWAUpdateControl";

export default function PWADropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const dropdownRef = useRef(null);

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
                className="p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Status PWA"
            >
                <IconWifi size={20} strokeWidth={1.5} />
            </button>

            {isOpen && (
                isMobile ? (
                    <div className="fixed top-0 right-0 z-50 w-[300px] h-full transition-all duration-300 transform border-l bg-white dark:bg-slate-950 dark:border-slate-900">
                        <div className="flex justify-between items-center gap-2 p-4 border-b mt-2 dark:border-slate-900">
                            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                                Status PWA
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={20} className="text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3">
                                <PWAConnectionStatus />
                                <PWAUpdateControl />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                        <div className="p-4">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                Koneksi & Update Aplikasi
                            </h3>
                            <div className="space-y-2">
                                <PWAConnectionStatus />
                                <PWAUpdateControl />
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
