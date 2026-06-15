const getInstallStorageKey = () => {
    if (typeof window === "undefined") {
        return "pwa-installed:default";
    }

    return `pwa-installed:${window.__PWA_CONFIG?.kind || "default"}`;
};

export function detectPwaInstalled() {
    if (typeof window === "undefined") {
        return false;
    }

    return Boolean(
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
            window.navigator.standalone === true ||
            window.localStorage.getItem(getInstallStorageKey()) === "true"
    );
}

export function persistPwaInstalled() {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(getInstallStorageKey(), "true");
}
