import React, { useMemo } from "react";
import Modal from "@/Components/Dashboard/Modal";

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
}) {
    const sessions = useMemo(
        () => monitor?.other_sessions || [],
        [monitor]
    );

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
                        </div>
                    ))}
                </div>

                <div className="flex justify-end">
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
