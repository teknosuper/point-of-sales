import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
    IconLock,
    IconEye,
    IconEyeOff,
    IconLoader2,
    IconX,
    IconShieldLock,
} from "@/Utils/icons";

/**
 * Modal konfirmasi password untuk aksi sensitif.
 * Tidak perlu redirect ke halaman terpisah — cukup panggil komponen ini.
 *
 * Props:
 * - show: boolean — apakah modal ditampilkan
 * - onClose: () => void — callback saat modal ditutup
 * - challengeLabel: string — deskripsi aksi yang dikonfirmasi (contoh: "menyimpan konfigurasi payment")
 * - onConfirmed: () => void — callback setelah password berhasil dikonfirmasi (opsional)
 */
export default function ConfirmPasswordModal({
    show,
    onClose,
    challengeLabel = "aksi sensitif",
    onConfirmed,
}) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [processing, setProcessing] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (show) {
            setPassword("");
            setError("");
        }
    }, [show]);

    const submit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        setError("");

        try {
            await axios.post(route("password.confirm"), { password });
            setPassword("");
            onConfirmed?.();
            onClose();
        } catch (err) {
            const message = err?.response?.data?.errors?.password?.[0]
                || err?.response?.data?.message
                || "Password yang dimasukkan tidak sesuai. Silakan coba lagi.";
            setError(message);
            toast.error("Konfirmasi password gagal.");
        } finally {
            setProcessing(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                {/* Close */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                    <IconX size={18} />
                </button>

                {/* Icon */}
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-950/50">
                    <IconShieldLock
                        size={28}
                        className="text-primary-600 dark:text-primary-400"
                    />
                </div>

                {/* Title */}
                <h2 className="text-center text-lg font-bold text-slate-900 dark:text-white">
                    Konfirmasi Password
                </h2>
                <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                    Untuk melanjutkan <span className="font-semibold">{challengeLabel}</span>, masukkan kembali password akun Anda.
                </p>

                {/* Form */}
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <IconLock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full h-11 pl-10 pr-10 rounded-xl border-2 text-sm ${
                                    error
                                        ? "border-danger-500 focus:border-danger-500"
                                        : "border-slate-200 dark:border-slate-700 focus:border-primary-500"
                                } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-primary-500/20 transition-all`}
                                autoFocus
                                placeholder="Masukkan password Anda"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                            </button>
                        </div>
                        {error && (
                            <p className="mt-1.5 text-xs text-danger-500">{error}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-sm font-semibold text-white hover:from-primary-600 hover:to-primary-700 focus:ring-4 focus:ring-primary-500/30 disabled:opacity-50 transition-all"
                    >
                        {processing ? (
                            <>
                                <IconLoader2 size={18} className="animate-spin" />
                                Memverifikasi...
                            </>
                        ) : (
                            "Konfirmasi & Lanjutkan"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}