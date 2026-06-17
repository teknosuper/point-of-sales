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
            window.matchMedia?.("(display-mode: window-controls-overlay)")?.matches ||
            window.matchMedia?.("(display-mode: minimal-ui)")?.matches ||
            window.navigator.standalone === true
    );
}

export async function probePwaInstalled() {
    if (typeof window === "undefined") {
        return false;
    }

    if (detectPwaInstalled()) {
        return true;
    }

    if (
        typeof window.navigator.getInstalledRelatedApps !== "function"
    ) {
        return false;
    }

    try {
        const relatedApps = await window.navigator.getInstalledRelatedApps();
        const expectedId = window.__PWA_CONFIG?.kind === "menu"
            ? "/daftarmenu"
            : window.__PWA_CONFIG?.kind === "dashboard"
              ? "/dashboard"
              : null;

        const isInstalled = relatedApps.some((app) => {
            const platform = String(app?.platform || "").toLowerCase();
            const id = String(app?.id || "");
            const url = String(app?.url || "");

            if (platform !== "webapp") {
                return false;
            }

            if (expectedId && id === expectedId) {
                return true;
            }

            return expectedId === "/dashboard"
                ? url.includes("/dashboard-manifest.webmanifest")
                : expectedId === "/daftarmenu"
                  ? url.includes("/menu-manifest.webmanifest")
                  : false;
        });

        if (isInstalled) {
            persistPwaInstalled();
        }

        return isInstalled;
    } catch (error) {
        console.error("PWA installed probe failed", error);
        return false;
    }
}

export function persistPwaInstalled() {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(getInstallStorageKey(), "true");
}

export function clearPersistedPwaInstalled() {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(getInstallStorageKey());
}
