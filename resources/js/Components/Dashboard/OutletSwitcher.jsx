import React, { useEffect, useState } from "react";
import { router } from "@inertiajs/react";

export default function OutletSwitcher({
    activeOutlet,
    availableOutlets = [],
    workspaceContext = null,
    compact = false,
    className = "",
}) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const syncViewport = () => setIsMobile(window.innerWidth < 768);
        syncViewport();
        window.addEventListener("resize", syncViewport);

        return () => window.removeEventListener("resize", syncViewport);
    }, []);

    const canSwitchOutlet =
        Boolean(workspaceContext?.can_switch_outlet) &&
        Array.isArray(availableOutlets) &&
        availableOutlets.length > 1;

    if (!workspaceContext && !canSwitchOutlet) {
        return null;
    }

    const switchOutlet = (outletId) => {
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

    const handleChange = (event) => {
        switchOutlet(event.target.value || null);
    };

    const runtimeLabel = activeOutlet?.name
        ? `${activeOutlet.code ? `${activeOutlet.code} - ` : ""}${activeOutlet.name}`
        : "";
    const scopeLabel = workspaceContext?.data_scope_label || "";
    const showResolvedOutlet =
        runtimeLabel &&
        runtimeLabel !== scopeLabel &&
        workspaceContext?.data_scope_type === "tenant";

    return (
        <div className={className}>
            {!compact && (
                <div className="mb-2 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Konteks kerja
                    </p>
                    {workspaceContext ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                            <div>
                                Workspace: <span className="font-semibold">{workspaceContext.mode_label || "-"}</span>
                            </div>
                            <div>
                                Scope data: <span className="font-semibold">{workspaceContext.data_scope_label || "-"}</span>
                            </div>
                            {showResolvedOutlet ? (
                                <div>
                                    Outlet induk: <span className="font-semibold">{runtimeLabel}</span>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
            {canSwitchOutlet && isMobile && !compact ? (
                <div className="space-y-2">
                    {availableOutlets.map((outlet) => {
                        const isActive = String(activeOutlet?.id ?? "") === String(outlet.id);

                        return (
                            <button
                                key={outlet.id}
                                type="button"
                                onClick={() => switchOutlet(outlet.id)}
                                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                                    isActive
                                        ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                <div className="font-medium">{outlet.name}</div>
                                {outlet.city ? (
                                    <div className="mt-1 text-xs opacity-70">
                                        {outlet.city}
                                    </div>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : canSwitchOutlet ? (
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
            ) : null}
        </div>
    );
}
