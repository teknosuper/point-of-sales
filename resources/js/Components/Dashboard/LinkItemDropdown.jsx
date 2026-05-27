import React, { useMemo, useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
    IconChevronDown,
    IconChevronUp,
    IconCornerDownRight,
} from "@/Utils/icons";
import { isSuperAdmin } from "@/Utils/authorization";

export default function LinkItemDropdown({ icon, title, data, access, sidebarOpen, ...props }) {
    const [isOpen, setIsOpen] = useState(false);
    const { auth } = usePage().props;
    const superAdmin = isSuperAdmin(auth);

    const visibleItems = useMemo(
        () => data.filter((item) => superAdmin || item.permissions === true),
        [data, superAdmin]
    );

    const canRenderParent = superAdmin || access === true || visibleItems.length > 0;
    const hasActiveChild = visibleItems.some((item) => item.active === true);

    if (!canRenderParent || visibleItems.length === 0) {
        return null;
    }

    const expanded = isOpen || hasActiveChild;
    const buttonClass = sidebarOpen
        ? `min-w-full flex items-center font-medium gap-x-3.5 px-4 py-3 capitalize hover:cursor-pointer text-sm justify-between transition-all ${
            hasActiveChild
                ? "bg-primary-50 text-primary-700 border-l-[3px] border-primary-500 dark:bg-primary-950/50 dark:text-primary-400"
                : "text-gray-500 hover:bg-slate-100 hover:text-gray-900 border-l-[3px] border-transparent dark:text-gray-500 dark:hover:bg-slate-800 dark:hover:text-gray-100"
        }`
        : `min-w-full flex justify-center py-3 transition-all ${
            hasActiveChild
                ? "text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-950/50"
                : "text-gray-500 hover:text-gray-900 hover:bg-slate-100 dark:text-gray-500 dark:hover:text-gray-100 dark:hover:bg-slate-800"
        }`;

    return (
        <>
            <button className={buttonClass} onClick={() => setIsOpen(!expanded)}>
                {sidebarOpen ? (
                    <>
                        <div className="flex items-center gap-x-3.5">
                            <span className={hasActiveChild ? "text-primary-600 dark:text-primary-400" : ""}>
                                {icon}
                            </span>
                            {title}
                        </div>
                        {expanded ? (
                            <IconChevronUp size={18} strokeWidth={1.5} />
                        ) : (
                            <IconChevronDown size={18} strokeWidth={1.5} />
                        )}
                    </>
                ) : !expanded ? (
                    icon
                ) : (
                    <IconChevronDown size={20} strokeWidth={1.5} />
                )}
            </button>

            {expanded &&
                visibleItems.map((item, index) => (
                    <Link
                        key={index}
                        href={item.href}
                        className={`${
                            item.active === true &&
                            "border-l-[3px] border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300"
                        } ${
                            sidebarOpen
                                ? "min-w-full flex items-center font-medium gap-x-3.5 px-5 py-3 capitalize hover:cursor-pointer text-sm line-clamp-1 text-gray-500 hover:bg-slate-100 hover:text-gray-900 border-l-[3px] border-transparent dark:text-gray-500 dark:hover:bg-slate-800 dark:hover:text-gray-100"
                                : "min-w-full flex justify-center py-3 text-gray-500 hover:text-gray-900 hover:bg-slate-100 dark:text-gray-500 dark:hover:text-gray-100 dark:hover:bg-slate-800"
                        }`}
                        {...props}
                    >
                        {sidebarOpen ? (
                            <>
                                <IconCornerDownRight
                                    size={18}
                                    strokeWidth={1.5}
                                />{" "}
                                {item.title}
                            </>
                        ) : (
                            item.icon
                        )}
                    </Link>
                ))}
        </>
    );
}
