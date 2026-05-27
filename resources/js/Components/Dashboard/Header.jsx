import React from "react";

export default function Header({ children, title, subtitle }) {
    return (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            {children}
        </div>
    );
}
