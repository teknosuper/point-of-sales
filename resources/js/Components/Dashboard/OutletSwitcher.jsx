import React from "react";
import { router } from "@inertiajs/react";

export default function OutletSwitcher({
    activeOutlet,
    availableOutlets = [],
    compact = false,
    className = "",
}) {
    if (!Array.isArray(availableOutlets) || availableOutlets.length <= 1) {
        return null;
    }

    const handleChange = (event) => {
        const outletId = event.target.value || null;

        router.post(
            route("outlets.switch"),
            {
                outlet_id: outletId ? Number(outletId) : null,
            },
            {
                preserveScroll: true,
                preserveState: false,
            }
        );
    };

    return (
        <div className={className}>
            {!compact && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Outlet aktif
                </p>
            )}
            <select
                value={activeOutlet?.id ?? ""}
                onChange={handleChange}
                className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-950 ${
                    compact ? "min-w-[180px]" : ""
                }`}
            >
                {availableOutlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                        {outlet.city ? ` - ${outlet.city}` : ""}
                    </option>
                ))}
            </select>
        </div>
    );
}
