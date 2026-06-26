import React, { useEffect, useState } from "react";
import ConcurrentSessionAlertModal from "@/Components/Dashboard/ConcurrentSessionAlertModal";

export default function ConcurrentSessionWatcher({ enabled = true }) {
    const [sessionMonitor, setSessionMonitor] = useState(null);
    const [showConcurrentSessionAlert, setShowConcurrentSessionAlert] =
        useState(false);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        let cancelled = false;

        const syncSessionMonitor = async () => {
            if (document.visibilityState === "hidden") {
                return;
            }

            try {
                const response = await window.axios.get(
                    route("auth.sessions.status")
                );
                const nextMonitor = response?.data?.sessionMonitor || null;

                if (cancelled || !nextMonitor?.supported) {
                    return;
                }

                setSessionMonitor(nextMonitor);

                if (!nextMonitor?.alert?.should_alert || !nextMonitor?.alert?.key) {
                    setShowConcurrentSessionAlert(false);
                    return;
                }

                const dismissedKey = window.sessionStorage.getItem(
                    "dismissedConcurrentSessionAlertKey"
                );

                if (dismissedKey !== nextMonitor.alert.key) {
                    setShowConcurrentSessionAlert(true);
                }
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn("Gagal sinkron session monitor", error);
                }
            }
        };

        syncSessionMonitor();

        const intervalId = window.setInterval(syncSessionMonitor, 30000);
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                syncSessionMonitor();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [enabled]);

    const handleCloseConcurrentSessionAlert = () => {
        if (sessionMonitor?.alert?.key) {
            window.sessionStorage.setItem(
                "dismissedConcurrentSessionAlertKey",
                sessionMonitor.alert.key
            );
        }

        setShowConcurrentSessionAlert(false);
    };

    if (!enabled) {
        return null;
    }

    return (
        <ConcurrentSessionAlertModal
            monitor={sessionMonitor}
            open={showConcurrentSessionAlert}
            onClose={handleCloseConcurrentSessionAlert}
        />
    );
}
