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
            hasDeterminateProgressRef.current = false;
            setHasDeterminateProgress(false);
            setVisible(true);
            setShowOverlay(false);

            overlayTimerRef.current = window.setTimeout(() => {
                setShowOverlay(true);
            }, 220);

            phaseTimerRef.current = window.setInterval(() => {
                const elapsed = Date.now() - startedAtRef.current;

                if (hasDeterminateProgressRef.current) {
                    setDetail("Progress ditampilkan dari permintaan yang sedang berjalan.");
                    return;
                }

                if (elapsed < 700) {
                    setDetail("Menghubungkan ke server...");
                    return;
                }

                if (elapsed < 1800) {
                    setDetail("Menunggu respons server...");
                    return;
                }

                if (elapsed < 3200) {
                    setDetail("Merender halaman dan menyiapkan komponen...");
                    return;
                }

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
            setDetail("Menyelesaikan tampilan...");

            hideTimerRef.current = window.setTimeout(() => {
                setVisible(false);
                setShowOverlay(false);
                setProgress(0);
                setDetail("Menunggu respons server dan render halaman selesai.");
                hasDeterminateProgressRef.current = false;
                setHasDeterminateProgress(false);
            }, delay + 180);
        };

        const unbindStart = router.on("start", (event) => {
            const method = event?.detail?.visit?.method?.toUpperCase?.() || "GET";
            begin(method === "GET" ? "Memuat halaman..." : "Menyimpan perubahan...");
        });

        const unbindProgress = router.on("progress", (event) => {
            const percentage = Number(event?.detail?.progress?.percentage ?? 0);
            if (Number.isFinite(percentage) && percentage > 0) {
                hasDeterminateProgressRef.current = true;
                setHasDeterminateProgress(true);
                setDetail("Progress ditampilkan dari permintaan yang sedang berjalan.");
                setProgress(Math.min(percentage, 92));
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

                    <div className="absolute left-1/2 top-1/2 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-3">
                            <span className="global-loading-dot h-3 w-3 rounded-full bg-primary-500" />
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {label}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {detail}
                                </p>
                            </div>
                            {hasDeterminateProgress ? (
                                <span className="ml-auto text-sm font-bold text-primary-600 dark:text-primary-300">
                                    {Math.max(0, Math.min(100, Math.round(progress)))}%
                                </span>
                            ) : (
                                <span className="ml-auto text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                    Loading
                                </span>
                            )}
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
                    </div>
                </>
            ) : null}
        </div>
    );
}
