import React, { useEffect, useRef, useState } from "react";
import {
    IconAlertTriangle,
    IconCamera,
    IconLoader2,
    IconX,
} from "@tabler/icons-react";

const HTML5_QRCODE_SCRIPT_ID = "html5-qrcode-script";
const HTML5_QRCODE_SCRIPT_SRC =
    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

function loadHtml5QrcodeScript() {
    return new Promise((resolve, reject) => {
        if (window.Html5Qrcode) {
            resolve(window.Html5Qrcode);

            return;
        }

        const existingScript = document.getElementById(
            HTML5_QRCODE_SCRIPT_ID
        );

        if (existingScript) {
            existingScript.addEventListener("load", () =>
                resolve(window.Html5Qrcode)
            );
            existingScript.addEventListener("error", () =>
                reject(new Error("Gagal memuat library scanner kamera."))
            );

            return;
        }

        const script = document.createElement("script");
        script.id = HTML5_QRCODE_SCRIPT_ID;
        script.src = HTML5_QRCODE_SCRIPT_SRC;
        script.async = true;
        script.onload = () => resolve(window.Html5Qrcode);
        script.onerror = () =>
            reject(new Error("Gagal memuat library scanner kamera."));

        document.body.appendChild(script);
    });
}

export default function CameraBarcodeScanner({
    open = false,
    onClose,
    onDetected,
}) {
    const scannerRef = useRef(null);
    const containerIdRef = useRef(
        `camera-barcode-scanner-${Math.random().toString(36).slice(2)}`
    );
    const isMountedRef = useRef(false);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        let cancelled = false;

        const stopScanner = async () => {
            const scanner = scannerRef.current;
            scannerRef.current = null;

            if (!scanner) {
                return;
            }

            try {
                if (scanner.isScanning) {
                    await scanner.stop();
                }
            } catch {
                // ignore scanner stop failures during teardown
            }

            try {
                await scanner.clear();
            } catch {
                // ignore clear failures during teardown
            }
        };

        const startScanner = async () => {
            setError("");
            setStatus("starting");

            try {
                const Html5Qrcode = await loadHtml5QrcodeScript();

                if (cancelled || !Html5Qrcode) {
                    return;
                }

                const scanner = new Html5Qrcode(containerIdRef.current);
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 260, height: 160 },
                        aspectRatio: 1.333334,
                    },
                    async (decodedText) => {
                        const barcode = decodedText?.trim();

                        if (!barcode || cancelled) {
                            return;
                        }

                        cancelled = true;
                        setStatus("detected");
                        await stopScanner();

                        if (isMountedRef.current) {
                            onDetected?.(barcode);
                            onClose?.();
                        }
                    },
                    () => {}
                );

                if (!cancelled && isMountedRef.current) {
                    setStatus("scanning");
                }
            } catch (cameraError) {
                const message =
                    cameraError?.name === "NotAllowedError"
                        ? "Izin kamera ditolak. Aktifkan izin kamera lalu coba lagi."
                        : cameraError?.message ||
                          "Kamera tidak dapat diakses dari browser ini.";

                if (!cancelled && isMountedRef.current) {
                    setError(message);
                    setStatus("error");
                }
            }
        };

        startScanner();

        return () => {
            cancelled = true;
            stopScanner();
        };
    }, [open, onClose, onDetected]);

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Scan Barcode dengan Kamera
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Arahkan kamera ke barcode produk.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                <div className="p-5">
                    <div className="relative overflow-hidden rounded-2xl bg-slate-950">
                        <div
                            id={containerIdRef.current}
                            className="scanner-shell aspect-[4/3] w-full overflow-hidden"
                        />

                        {status === "starting" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-white">
                                <IconLoader2 size={28} className="animate-spin" />
                                <p className="text-sm">
                                    Menyiapkan kamera...
                                </p>
                            </div>
                        )}

                        {status === "scanning" && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="h-40 w-[78%] rounded-2xl border-2 border-primary-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]" />
                            </div>
                        )}
                    </div>

                    {error ? (
                        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                            <IconAlertTriangle size={18} className="mt-0.5" />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <IconCamera size={18} className="mt-0.5" />
                            <span>
                                Gunakan kamera belakang pada ponsel untuk hasil
                                scan yang lebih stabil.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
