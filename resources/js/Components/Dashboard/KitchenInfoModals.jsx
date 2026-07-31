// Modal kecil info dapur (sebelumnya inline di Dashboard/Kitchen/Index.jsx).
import { IconX } from "@/Utils/icons";
import SoundTestPanel from "@/Components/Dashboard/SoundTestPanel";

export function KitchenSoundTestModal({ open, onClose }) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        🔊 Testing Suara Notifikasi
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>
                <div className="mt-4">
                    <SoundTestPanel />
                </div>
            </div>
        </div>
    );
}

export function KitchenGuideModal({ open, onClose }) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Panduan tombol dapur
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Ringkasan fungsi tombol agar operasional dapur lebih konsisten.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Mulai Proses
                        </p>
                        <p className="mt-1">
                            Mode manual: ambil tiket dari status menunggu ke diproses saat dapur mulai mengerjakan.
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Jika station memakai mode otomatis, langkah ini tidak perlu ditekan karena sistem akan memproses ticket masuk secara otomatis.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Siap Diantar / Diambil
                        </p>
                        <p className="mt-1">
                            Dapur bisa memilih item yang benar-benar siap lebih dulu. Ticket baru berubah penuh ke siap antar saat semua item di dalamnya sudah selesai.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Kirim ke Printer
                        </p>
                        <p className="mt-1">
                            Kirim slip dapur ke printer bila station ini memang memakai cetak.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Preview Ticket
                        </p>
                        <p className="mt-1">
                            Buka preview untuk melihat detail item, catatan pesanan, dan ringkasan ticket lebih lengkap.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
