import React, { useState, useRef, useEffect } from "react";
import { IconWifi, IconChevronDown } from "@/Utils/icons";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAUpdateControl from "@/Components/PWAUpdateControl";

export default function PWADropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
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
            )}
        </div>
    );
}
