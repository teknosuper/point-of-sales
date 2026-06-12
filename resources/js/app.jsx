import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { ThemeSwitcherProvider } from './Context/ThemeSwitcherContext';
import GlobalLoadingIndicator from './Components/GlobalLoadingIndicator';
import PWAInstallPrompt from './Components/PWAInstallPrompt';
import PWAStartupSplash from './Components/PWAStartupSplash';
const appName = import.meta.env.VITE_APP_NAME || 'GTC KASIR';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeSwitcherProvider>
                <PWAStartupSplash />
                <GlobalLoadingIndicator />
                <PWAInstallPrompt />
                <App {...props} />
            </ThemeSwitcherProvider>
        );
    },
    progress: {
        color: '#0ea5e9',
        showSpinner: false,
    },
});

if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", async () => {
        const hostname = window.location.hostname;
        const isLocalhost =
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1";

        if (isLocalhost) {
            try {
                const registrations =
                    await navigator.serviceWorker.getRegistrations();
                await Promise.all(
                    registrations.map((registration) =>
                        registration.unregister()
                    )
                );

                if ("caches" in window) {
                    const cacheKeys = await window.caches.keys();
                    await Promise.all(
                        cacheKeys
                            .filter((key) => key.startsWith("poinza-"))
                            .map((key) => window.caches.delete(key))
                    );
                }
            } catch (error) {
                console.error(
                    "Service worker cleanup failed on localhost",
                    error
                );
            }

            return;
        }

        navigator.serviceWorker.register("/sw.js").catch((error) => {
            console.error("Service worker registration failed", error);
        });
    });
}
