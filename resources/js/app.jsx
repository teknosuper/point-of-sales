import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { ThemeSwitcherProvider } from './Context/ThemeSwitcherContext';
import GlobalLoadingIndicator from './Components/GlobalLoadingIndicator';
import PWAInstallPrompt from './Components/PWAInstallPrompt';
const appName = import.meta.env.VITE_APP_NAME || 'POINZA';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeSwitcherProvider>
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
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
            console.error("Service worker registration failed", error);
        });
    });
}
