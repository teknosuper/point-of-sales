export function detectPwaInstalled() {
    if (typeof window === "undefined") {
        return false;
    }

    return Boolean(
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
            window.navigator.standalone === true
    );
}

export function persistPwaInstalled() {
    // No-op. Status install harus mengikuti kondisi runtime nyata,
    // bukan flag lokal yang bisa tertinggal setelah uninstall.
}
