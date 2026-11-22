import React from "react";
import { Link, usePage } from "@inertiajs/react";
import { isSuperAdmin } from "@/Utils/authorization";

export default function LinkItem({
    href,
    icon,
    access,
    active = false,
    title,
    sidebarOpen,
    variant = "default",
    ...props
}) {
    const { auth } = usePage().props;
    const isActive = active === true;
    const canAccess = isSuperAdmin(auth) || access === true;
    const isPosVariant = variant === "pos";

    if (!canAccess) return null;

    const baseClasses = `
        flex items-center gap-3
        transition-all duration-200
        text-slate-600 dark:text-slate-400
    `;

    const activeClasses = isActive
        ? "bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400 border-l-[3px] border-primary-500"
        : "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border-l-[3px] border-transparent";

    if (sidebarOpen) {
        return (
            <Link
                href={href}
                className={`${baseClasses} ${activeClasses} ${
                    isPosVariant
                        ? "mx-3 mb-2 rounded-2xl px-4 py-3 text-base font-semibold"
                        : "px-4 py-2.5 text-sm font-medium"
                }`}
                {...props}
            >
                <span
                    className={`flex shrink-0 items-center justify-center ${
                        isPosVariant ? "h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800" : ""
                    } ${isActive ? "text-primary-600 dark:text-primary-400" : ""}`}
                >
                    {icon}
                </span>
                <span className="truncate">{title}</span>
            </Link>
        );
    }

    // Collapsed sidebar
    return (
        <Link
            href={href}
            className={`
                w-full flex justify-center py-3
                transition-all duration-200
                ${
                    isActive
                        ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }
            `}
            title={title}
            {...props}
        >
            {icon}
        </Link>
    );
}
