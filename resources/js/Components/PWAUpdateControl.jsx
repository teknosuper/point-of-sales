import { useEffect, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import toast from "react-hot-toast";
import { IconRefresh, IconSparkles } from "@/Utils/icons";

export default function PWAUpdateControl({ compact = false }) {
    const { appMeta } = usePage().props;
    const [waitingUpdate, setWaitingUpdate] = useState(false);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const shouldReloadAfterUpdateRef = useRef(false);
    const hasAnnouncedWaitingUpdateRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        const syncRegistration = async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                const hasWaitingUpdate = Boolean(registration?.waiting);
                setWaitingUpdate(hasWaitingUpdate);

                if (hasWaitingUpdate && !hasAnnouncedWaitingUpdateRef.current) {
                    hasAnnouncedWaitingUpdateRef.current = true;
                    toast(
                        "Versi baru GTC KASIR tersedia. Tekan update untuk memuat versi terbaru.",
                        {
                            duration: 5000,
                            icon: "⬆️",
                        }
                    );
                }

                if (!hasWaitingUpdate) {
                    hasAnnouncedWaitingUpdateRef.current = false;
                }
            } catch {
                setWaitingUpdate(false);
                hasAnnouncedWaitingUpdateRef.current = false;
            }
        };

        const handleControllerChange = () => {
            if (!shouldReloadAfterUpdateRef.current) {
                return;
            }

            shouldReloadAfterUpdateRef.current = false;
            window.location.reload();
        };

        syncRegistration();
        window.addEventListener("focus", syncRegistration);
        window.addEventListener("pageshow", syncRegistration);
        navigator.serviceWorker.addEventListener(
            "controllerchange",
            handleControllerChange
        );

        return () => {
            window.removeEventListener("focus", syncRegistration);
            window.removeEventListener("pageshow", syncRegistration);
            navigator.serviceWorker.removeEventListener(
                "controllerchange",
                handleControllerChange
            );
        };
    }, []);

    const handleCheckUpdate = async () => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            toast.error("Service worker belum tersedia di browser ini.");
            return;
        }

        setIsCheckingUpdate(true);

        try {
            const registration = await navigator.serviceWorker.getRegistration();

            if (!registration) {
                throw new Error("Aplikasi belum memiliki service worker aktif.");
            }

            await registration.update();

            if (registration.waiting) {
                shouldReloadAfterUpdateRef.current = true;
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
                toast.success("Update aplikasi ditemukan. Memuat versi terbaru...");
                return;
            }

            if (registration.installing) {
                await new Promise((resolve) => {
                    registration.installing.addEventListener("statechange", () => {
                        if (registration.waiting) {
                            shouldReloadAfterUpdateRef.current = true;
                            registration.waiting.postMessage({
                                type: "SKIP_WAITING",
                            });
                            toast.success(
                                "Update aplikasi ditemukan. Memuat versi terbaru..."
                            );
                            resolve();
                            return;
                        }

                        if (registration.installing?.state === "activated") {
                            resolve();
                        }
                    });
                });
                return;
            }

            toast("Tidak ada update baru.", {
                duration: 2500,
                icon: "ℹ️",
            });
        } catch (error) {
            toast.error(
                error?.message || "Gagal memeriksa update aplikasi."
            );
        } finally {
            setIsCheckingUpdate(false);
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                const hasWaitingUpdate = Boolean(registration?.waiting);
                setWaitingUpdate(hasWaitingUpdate);
                hasAnnouncedWaitingUpdateRef.current = hasWaitingUpdate;
            } catch {
                setWaitingUpdate(false);
                hasAnnouncedWaitingUpdateRef.current = false;
            }
        }
    };

    if (!appMeta?.buildVersion && !waitingUpdate) {
        return null;
    }

    const buildLabel = appMeta?.buildVersion
        ? `Build ${appMeta.buildVersion.slice(0, 8)}`
        : "Build aktif";

    if (compact) {
        return (
            <div className="inline-flex items-center gap-2">
                <span className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 xl:inline-flex">
                    {buildLabel}
                </span>
                <button
                    type="button"
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
                        waitingUpdate
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                >
                    {waitingUpdate ? (
                        <IconSparkles size={16} />
                    ) : (
                        <IconRefresh size={16} />
                    )}
                    {isCheckingUpdate
                        ? "Memeriksa..."
                        : waitingUpdate
                        ? "Update tersedia"
                        : "Cek update"}
                </button>
            </div>
        );
    }

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                waitingUpdate
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
        >
            {waitingUpdate ? (
                <IconSparkles size={16} />
            ) : (
                <IconRefresh size={16} />
            )}
            <span>{buildLabel}</span>
            <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate}
                className="rounded-lg border border-current/15 bg-white/70 px-2.5 py-1 text-xs font-semibold disabled:opacity-60 dark:bg-slate-950/40"
            >
                {isCheckingUpdate
                    ? "Memeriksa..."
                    : waitingUpdate
                    ? "Terapkan update"
                    : "Cek update"}
            </button>
        </div>
    );
}
