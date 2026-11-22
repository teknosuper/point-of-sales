import React, { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";

const MIN_VISIBLE_MS = 300;

export default function GlobalLoadingIndicator() {
    const [visible, setVisible] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [progress, setProgress] = useState(0);
    const [hasDeterminateProgress, setHasDeterminateProgress] = useState(false);
    const [label, setLabel] = useState("Memproses permintaan...");
    const [detail, setDetail] = useState(
        "Menunggu respons server dan render halaman selesai."
    );
    const [phase, setPhase] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const startedAtRef = useRef(0);
    const hideTimerRef = useRef(null);
    const overlayTimerRef = useRef(null);
    const hasDeterminateProgressRef = useRef(false);
    const phaseTimerRef = useRef(null);

    useEffect(() => {
        const clearHideTimer = () => {
            if (hideTimerRef.current) {
                window.clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };

        const clearOverlayTimer = () => {
            if (overlayTimerRef.current) {
                window.clearTimeout(overlayTimerRef.current);
                overlayTimerRef.current = null;
            }
        };

        const clearPhaseTimer = () => {
            if (phaseTimerRef.current) {
                window.clearInterval(phaseTimerRef.current);
                phaseTimerRef.current = null;
            }
        };

        const begin = (nextLabel = "Memuat halaman...") => {
            clearHideTimer();
            clearOverlayTimer();
            clearPhaseTimer();
            startedAtRef.current = Date.now();
            setLabel(nextLabel);
            setProgress(0);
            setDetail("Menghubungkan ke server...");
            setPhase(0);
            setElapsedMs(0);
            hasDeterminateProgressRef.current = false;
            setHasDeterminateProgress(false);
            setVisible(true);
            setShowOverlay(false);

            overlayTimerRef.current = window.setTimeout(() => {
                setShowOverlay(true);
            }, 220);

            phaseTimerRef.current = window.setInterval(() => {
                const elapsed = Date.now() - startedAtRef.current;
                setElapsedMs(elapsed);

                if (hasDeterminateProgressRef.current) {
                    setDetail("Progress ditampilkan dari permintaan yang sedang berjalan.");
                    return;
                }

                if (elapsed < 700) {
                    setDetail("Menghubungkan ke server...");
                    return;
                }

                if (elapsed < 1800) {
                    setPhase(1);
                    setDetail("Menunggu respons server...");
                    return;
                }

                if (elapsed < 3200) {
                    setPhase(2);
                    setDetail("Merender halaman dan menyiapkan komponen...");
                    return;
                }

                setPhase(2);
                setDetail("Masih diproses. Permintaan ini memakan waktu lebih lama dari biasanya.");
            }, 180);
        };

        const complete = () => {
            const elapsed = Date.now() - startedAtRef.current;
            const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);

            clearOverlayTimer();
            clearPhaseTimer();
            if (hasDeterminateProgressRef.current) {
                setProgress(100);
            }
            setPhase(3);
            setDetail("Menyelesaikan tampilan...");

            hideTimerRef.current = window.setTimeout(() => {
                setVisible(false);
                setShowOverlay(false);
                setProgress(0);
                setPhase(0);
                setElapsedMs(0);
                setDetail("Menunggu respons server dan render halaman selesai.");
                hasDeterminateProgressRef.current = false;
                setHasDeterminateProgress(false);
            }, delay + 180);
        };

        const unbindStart = router.on("start", (event) => {
            const method = event?.detail?.visit?.method?.toUpperCase?.() || "GET";
            const url = event?.detail?.visit?.url;
            const pathname = url
                ? new URL(url, window.location.origin).pathname
                : "";

            if (pathname === "/login" && method === "POST") {
                begin("Memverifikasi akun...");
                return;
            }

            begin(method === "GET" ? "Memuat halaman..." : "Menyimpan perubahan...");
        });

        const unbindProgress = router.on("progress", (event) => {
            const percentage = Number(event?.detail?.progress?.percentage ?? 0);
            if (Number.isFinite(percentage) && percentage > 0) {
                hasDeterminateProgressRef.current = true;
                setHasDeterminateProgress(true);
                setDetail("Progress ditampilkan dari permintaan yang sedang berjalan.");
                setProgress(Math.min(percentage, 92));
                setPhase(percentage < 35 ? 0 : percentage < 75 ? 1 : 2);
            }
        });

        const unbindFinish = router.on("finish", () => {
            complete();
        });

        const unbindError = router.on("invalid", () => {
            setLabel("Validasi selesai diperiksa...");
            complete();
        });

        const unbindException = router.on("exception", () => {
            setLabel("Permintaan selesai diproses.");
            complete();
        });

        return () => {
            clearHideTimer();
            clearOverlayTimer();
            clearPhaseTimer();
            unbindStart();
            unbindProgress();
            unbindFinish();
            unbindError();
            unbindException();
        };
    }, []);

    const phases = ["Koneksi", "Proses server", "Siapkan tampilan"];
    const elapsedLabel = `${(elapsedMs / 1000).toFixed(1)} dtk`;

    return (
        <div
            className={`pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-200 ${
                visible ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!visible}
        >
            <div className="absolute inset-x-0 top-0 z-[10000] h-1.5 overflow-hidden bg-slate-200/80 dark:bg-slate-800/80">
                {hasDeterminateProgress ? (
                    <div
                        className="h-full bg-gradient-to-r from-primary-500 via-sky-500 to-primary-600 transition-[width] duration-200 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                ) : (
                    <div className="global-loading-indeterminate h-full w-full overflow-hidden">
                        <div className="global-loading-indeterminate-bar h-full rounded-full bg-gradient-to-r from-primary-500 via-sky-500 to-primary-600" />
                    </div>
                )}
            </div>

            {showOverlay ? (
                <>
                    <div className="absolute inset-0 bg-slate-950/22 backdrop-blur-[2px] dark:bg-slate-950/40" />

                    <div className="absolute left-1/2 top-1/2 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/80 bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
                        <div className="mb-4 flex items-center gap-3">
                            <span className="global-loading-dot flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 ring-1 ring-primary-100 dark:bg-primary-950/50 dark:ring-primary-900/50">
                                <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {label}
                                </p>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    {detail}
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <span className="block text-sm font-bold text-primary-600 dark:text-primary-300">
                                    {hasDeterminateProgress
                                        ? `${Math.max(0, Math.min(100, Math.round(progress)))}%`
                                        : `Tahap ${Math.min(phase + 1, 3)}/3`}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                                    {elapsedLabel}
                                </span>
                            </div>
                        </div>

                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            {hasDeterminateProgress ? (
                                <div
                                    className="global-loading-bar h-full bg-gradient-to-r from-primary-500 via-sky-500 to-primary-600 transition-[width] duration-200 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            ) : (
                                <div className="global-loading-indeterminate h-full w-full overflow-hidden">
                                    <div className="global-loading-indeterminate-bar h-full rounded-full bg-gradient-to-r from-primary-500 via-sky-500 to-primary-600" />
                                </div>
                            )}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                            {phases.map((item, index) => {
                                const isComplete = phase > index;
                                const isActive = phase === index;

                                return (
                                    <div
                                        key={item}
                                        className={`rounded-xl border px-2.5 py-2 transition-colors ${
                                            isComplete || isActive
                                                ? "border-primary-200 bg-primary-50/80 dark:border-primary-900/60 dark:bg-primary-950/30"
                                                : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${
                                                    isComplete
                                                        ? "bg-success-500"
                                                        : isActive
                                                          ? "global-loading-dot bg-primary-500"
                                                          : "bg-slate-300 dark:bg-slate-700"
                                                }`}
                                            />
                                            <span className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                {item}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
