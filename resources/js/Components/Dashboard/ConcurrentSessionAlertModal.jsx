import React, { useMemo, useState } from "react";
import Modal from "@/Components/Dashboard/Modal";
import toast from "react-hot-toast";

const formatDateTime = (value) => {
    if (!value) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
};

export default function ConcurrentSessionAlertModal({
    monitor,
    open,
    onClose,
    onMonitorChange = () => {},
}) {
    const [processingId, setProcessingId] = useState(null);
    const [processingAll, setProcessingAll] = useState(false);
    const sessions = useMemo(
        () => monitor?.other_sessions || [],
        [monitor]
    );

    const handleLogoutSession = async (sessionId) => {
        setProcessingId(sessionId);

        try {
            const response = await window.axios.delete(
                route("auth.sessions.destroy", sessionId)
            );

            onMonitorChange(response?.data?.sessionMonitor || null);
            toast.success(response?.data?.message || "Session berhasil dikeluarkan.");
        } catch (error) {
            toast.error(
                error?.response?.data?.message || "Gagal mengeluarkan session."
            );
        } finally {
            setProcessingId(null);
        }
    };

    const handleLogoutAllSessions = async () => {
        setProcessingAll(true);

        try {
            const response = await window.axios.post(
                route("auth.sessions.logout-others")
            );

            onMonitorChange(response?.data?.sessionMonitor || null);
            toast.success(
                response?.data?.message || "Session lain berhasil dikeluarkan."
            );
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Gagal mengeluarkan session lain."
            );
        } finally {
            setProcessingAll(false);
        }
    };

    return (
        <Modal
            title="Login Lain Terdeteksi"
            show={open}
            onClose={onClose}
            maxWidth="2xl"
        >
            <div className="space-y-4">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
                    Terdeteksi session login lain untuk akun ini. Modal ini sekarang juga akan muncul
                    untuk session browser lain di device yang sama, termasuk incognito. Jika itu bukan
                    Anda, segera ganti password dan keluarkan session lain.
                </div>

                <div className="space-y-3">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {session.device_label}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Browser: {session.browser} • IP: {session.ip_address}
                                    </p>
                                </div>
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                    Aktif {session.last_activity_human}
                                </span>
                            </div>
                            <div className="mt-2">
                                <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                        session.is_same_device
                                            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                                    }`}
                                >
                                    {session.is_same_device
                                        ? "Session browser lain di device yang sama"
                                        : "Session dari device / browser berbeda"}
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                Aktivitas terakhir: {formatDateTime(session.last_activity_at)}
                            </p>
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleLogoutSession(session.id)}
                                    disabled={processingId === session.id || processingAll}
                                    className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                                >
                                    {processingId === session.id
                                        ? "Mengeluarkan..."
                                        : "Keluarkan Session Ini"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                    {sessions.length > 1 ? (
                        <button
                            type="button"
                            onClick={handleLogoutAllSessions}
                            disabled={processingAll || processingId !== null}
                            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        >
                            {processingAll
                                ? "Mengeluarkan Semua..."
                                : "Keluarkan Semua Session Lain"}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-600"
                    >
                        Saya mengerti
                    </button>
                </div>
            </div>
        </Modal>
    );
}
