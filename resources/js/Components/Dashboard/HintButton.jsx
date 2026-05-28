import { useState } from "react";
import { IconInfoCircle } from "@/Utils/icons";

const hints = {};

export function registerHints(newHints) {
    Object.assign(hints, newHints);
}

export default function HintButton({ hintKey, children }) {
    const [activeHint, setActiveHint] = useState(null);
    const hintText = children || hints[hintKey];

    if (!hintText) return null;

    return (
        <div className="relative inline-flex">
            <button
                type="button"
                onClick={() =>
                    setActiveHint(activeHint === hintKey ? null : hintKey)
                }
                onMouseEnter={() => setActiveHint(hintKey)}
                onMouseLeave={() => setActiveHint(null)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400"
                aria-label={`Bantuan${hintKey ? ` untuk ${hintKey}` : ""}`}
            >
                <IconInfoCircle size={16} />
            </button>
            {activeHint === hintKey && (
                <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {hintText}
                    </div>
                    <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
                </div>
            )}
        </div>
    );
}