const PWA_INSTALLED_STORAGE_KEY = "pos:pwa-installed";

export function detectPwaInstalled() {
    if (typeof window === "undefined") {
        return false;
    }

    const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator.standalone === true;

    try {
        return standalone || window.localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === "1";
    } catch {
        return standalone;
    }
}

export function persistPwaInstalled() {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, "1");
    } catch {
        // Abaikan jika storage tidak tersedia.
    }
}
