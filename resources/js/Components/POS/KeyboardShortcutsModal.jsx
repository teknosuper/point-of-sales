// Modal bantuan shortcut keyboard POS (sebelumnya inline di Transactions/Index.jsx).
import { IconKeyboard } from "@/Utils/icons";

const SHORTCUTS = [
    ["F1", "Buka Numpad"],
    ["F2", "Selesaikan Transaksi"],
    ["F3", "Toggle Produk/Keranjang"],
    ["F4", "Tampilkan Bantuan"],
    ["Esc", "Tutup Modal"],
];

export default function KeyboardShortcutsModal({ open, onClose }) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60"
                onClick={onClose}
            />
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <IconKeyboard size={24} />
                    Keyboard Shortcuts
                </h3>
                <div className="space-y-3">
                    {SHORTCUTS.map(([key, desc]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between"
                        >
                            <span className="text-slate-600 dark:text-slate-400">
                                {desc}
                            </span>
                            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                                {key}
                            </kbd>
                        </div>
                    ))}
                </div>
                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium"
                >
                    Tutup
                </button>
            </div>
        </div>
    );
}
