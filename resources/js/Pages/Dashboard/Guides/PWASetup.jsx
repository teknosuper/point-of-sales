import DashboardLayout from "@/Layouts/DashboardLayout";
import PWAConnectionStatus from "@/Components/PWAConnectionStatus";
import PWAInstallButton from "@/Components/PWAInstallButton";
import { Head, Link } from "@inertiajs/react";
import toast from "react-hot-toast";
import {
    IconBolt,
    IconChecklist,
    IconCloudDown,
    IconDeviceMobile,
    IconDownload,
    IconHome,
    IconInfoCircle,
    IconPlugConnected,
    IconRefresh,
    IconShieldCheck,
    IconTrash,
    IconWifi,
} from "@/Utils/icons";
import { useEffect, useRef, useState } from "react";
import usePwaInstall from "@/Hooks/usePwaInstall";

const OFFLINE_SHELL_STATUS_KEY = "pos:offline-shell-status";

export default function PWASetup({
    platforms = [],
    recommendedRoutes = [],
    offlineShellProfiles = [],
    buildInfo = null,
}) {
    const {
        canPromptInstall,
        installHelpText,
        isInstalled,
        isIos,
        isStandalone,
        promptInstall,
        shouldShowInstallEntry,
    } = usePwaInstall();
    const [diagnostics, setDiagnostics] = useState({
        secureContext: false,
        serviceWorker: false,
        standalone: false,
        online: true,
        waitingUpdate: false,
    });
    const [warmingProfileKey, setWarmingProfileKey] = useState(null);
    const [isWarmingAllProfiles, setIsWarmingAllProfiles] = useState(false);
    const [isCheckingAppUpdate, setIsCheckingAppUpdate] = useState(false);
    const [isResettingAppCache, setIsResettingAppCache] = useState(false);
    const [offlineShellStatus, setOfflineShellStatus] = useState(() => {
        if (typeof window === "undefined") {
            return {};
        }

        try {
            return JSON.parse(
                window.localStorage.getItem(OFFLINE_SHELL_STATUS_KEY) || "{}"
            );
        } catch {
            return {};
        }
    });
    const shouldReloadAfterUpdateRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const sync = () => {
            const waitingUpdate = Boolean(
                navigator.serviceWorker?.controller &&
                    navigator.serviceWorker?.getRegistration
            );

            setDiagnostics({
                secureContext: Boolean(window.isSecureContext),
                serviceWorker: "serviceWorker" in navigator,
                standalone:
                    Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches) ||
                    window.navigator.standalone === true,
                online: navigator.onLine,
                waitingUpdate: false,
            });

            if ("serviceWorker" in navigator && waitingUpdate) {
                navigator.serviceWorker
                    .getRegistration()
                    .then((registration) => {
                        setDiagnostics((current) => ({
                            ...current,
                            waitingUpdate: Boolean(registration?.waiting),
                        }));
                    })
                    .catch(() => {
                        setDiagnostics((current) => ({
                            ...current,
                            waitingUpdate: false,
                        }));
                    });
            }
        };

        sync();
        window.addEventListener("online", sync);
        window.addEventListener("offline", sync);

        return () => {
            window.removeEventListener("online", sync);
            window.removeEventListener("offline", sync);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(
            OFFLINE_SHELL_STATUS_KEY,
            JSON.stringify(offlineShellStatus)
        );
    }, [offlineShellStatus]);

    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        const handleControllerChange = () => {
            if (!shouldReloadAfterUpdateRef.current) {
                return;
            }

            shouldReloadAfterUpdateRef.current = false;
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener(
            "controllerchange",
            handleControllerChange
        );

        return () => {
            navigator.serviceWorker.removeEventListener(
                "controllerchange",
                handleControllerChange
            );
        };
    }, []);

    const handleInstallAction = async () => {
        if (canPromptInstall) {
            await promptInstall();
            return;
        }

        if (isIos) {
            toast("Gunakan Bagikan lalu pilih Tambahkan ke Layar Utama.", {
                duration: 4500,
                icon: "📲",
            });
        }
    };

    const diagnosticItems = [
        {
            label: "Konteks Aman",
            description: "PWA dan service worker butuh HTTPS atau localhost.",
            ok: diagnostics.secureContext,
            icon: <IconShieldCheck size={18} />,
        },
        {
            label: "Service Worker",
            description: "Dipakai untuk cache statis dan fallback offline.",
            ok: diagnostics.serviceWorker,
            icon: <IconBolt size={18} />,
        },
        {
            label: "Status Koneksi",
            description: "Berguna untuk kasir dan kitchen agar tahu saat jaringan putus.",
            ok: diagnostics.online,
            icon: <IconWifi size={18} />,
        },
        {
            label: "Mode Aplikasi / Mandiri",
            description: "Aktif setelah aplikasi dibuka dari hasil instalasi atau Tambahkan ke Layar Utama.",
            ok: diagnostics.standalone,
            icon: <IconDeviceMobile size={18} />,
        },
        {
            label: "Update Menunggu",
            description: "Menunjukkan apakah ada service worker baru yang siap diaktifkan.",
            ok: diagnostics.waitingUpdate,
            icon: <IconRefresh size={18} />,
        },
    ];

    const warmOfflineShell = async (profile) => {
        if (typeof window === "undefined") {
            return null;
        }

        if (!diagnostics.online) {
            toast.error("Hubungkan perangkat ke internet sebelum setup offline shell.");
            return null;
        }

        if (!("serviceWorker" in navigator)) {
            toast.error("Service worker belum tersedia di browser ini.");
            return null;
        }

        const urls = (profile?.routes || [])
            .map((item) => item.href)
            .filter(Boolean);

        if (urls.length === 0) {
            toast.error("Profil offline shell belum memiliki route yang bisa disiapkan.");
            return null;
        }

        setWarmingProfileKey(profile.key);
        let summary = null;

        try {
            const registration = await navigator.serviceWorker.ready;
            const worker =
                navigator.serviceWorker.controller ||
                registration.active ||
                registration.waiting ||
                registration.installing;

            if (!worker) {
                throw new Error("Service worker belum aktif.");
            }

            const result = await new Promise((resolve, reject) => {
                const channel = new MessageChannel();
                const timeoutId = window.setTimeout(() => {
                    reject(new Error("Timeout saat menyiapkan offline shell."));
                }, 30000);

                channel.port1.onmessage = (event) => {
                    window.clearTimeout(timeoutId);
                    resolve(event.data || {});
                };

                worker.postMessage(
                    {
                        type: "WARM_ROUTES",
                        payload: { urls },
                    },
                    [channel.port2]
                );
            });

            const okCount = (result?.results || []).filter(
                (item) => item.ok
            ).length;

            setOfflineShellStatus((current) => ({
                ...current,
                [profile.key]: {
                    preparedAt: new Date().toISOString(),
                    okCount,
                    totalCount: urls.length,
                    results: result?.results || [],
                },
            }));

            if (okCount > 0) {
                toast.success(
                    `Offline shell ${profile.label} siap (${okCount}/${urls.length} route).`
                );
            } else {
                toast.error(
                    `Tidak ada route ${profile.label} yang berhasil disiapkan.`
                );
            }

            summary = {
                key: profile.key,
                label: profile.label,
                okCount,
                totalCount: urls.length,
            };
        } catch (error) {
            toast.error(
                error?.message || "Gagal menyiapkan offline shell perangkat."
            );
            return null;
        } finally {
            setWarmingProfileKey(null);
        }

        return summary;
    };

    const warmAllOfflineShells = async () => {
        if (offlineShellProfiles.length === 0) {
            toast.error("Belum ada profil offline shell yang tersedia.");
            return;
        }

        setIsWarmingAllProfiles(true);

        try {
            const summary = [];

            for (const profile of offlineShellProfiles) {
                const result = await warmOfflineShell(profile);
                if (result) {
                    summary.push(result);
                }
            }

            const totalOk = summary.reduce(
                (carry, item) => carry + Number(item.okCount || 0),
                0
            );
            const totalRoutes = summary.reduce(
                (carry, item) => carry + Number(item.totalCount || 0),
                0
            );

            if (summary.length > 0) {
                toast.success(
                    `Offline shell lengkap selesai (${totalOk}/${totalRoutes} route).`
                );
            }
        } finally {
            setIsWarmingAllProfiles(false);
        }
    };

    const sendMessageToWorker = async (type, payload = {}) => {
        const registration = await navigator.serviceWorker.ready;
        const worker =
            navigator.serviceWorker.controller ||
            registration.active ||
            registration.waiting ||
            registration.installing;

        if (!worker) {
            throw new Error("Service worker belum aktif.");
        }

        return new Promise((resolve, reject) => {
            const channel = new MessageChannel();
            const timeoutId = window.setTimeout(() => {
                reject(new Error("Timeout saat berkomunikasi dengan service worker."));
            }, 30000);

            channel.port1.onmessage = (event) => {
                window.clearTimeout(timeoutId);
                resolve(event.data || {});
            };

            worker.postMessage({ type, payload }, [channel.port2]);
        });
    };

    const handleAppUpdate = async () => {
        if (typeof window === "undefined") {
            return;
        }

        if (!("serviceWorker" in navigator)) {
            toast.error("Service worker belum tersedia di browser ini.");
            return;
        }

        setIsCheckingAppUpdate(true);

        try {
            const registration = await navigator.serviceWorker.getRegistration();

            if (!registration) {
                throw new Error("Aplikasi belum memiliki service worker aktif.");
            }

            await registration.update();

            const activateWaitingWorker = async () => {
                if (!registration.waiting) {
                    return false;
                }

                shouldReloadAfterUpdateRef.current = true;
                await sendMessageToWorker("SKIP_WAITING");
                toast.success("Update aplikasi ditemukan. Memuat ulang versi terbaru...");
                return true;
            };

            if (await activateWaitingWorker()) {
                return;
            }

            if (registration.installing) {
                await new Promise((resolve) => {
                    registration.installing.addEventListener(
                        "statechange",
                        async () => {
                            if (registration.waiting) {
                                await activateWaitingWorker();
                                resolve();
                                return;
                            }

                            if (registration.installing?.state === "activated") {
                                resolve();
                            }
                        }
                    );
                });
                return;
            }

            toast("Tidak ada update baru. Aplikasi sudah memakai versi terbaru.", {
                duration: 3500,
                icon: "ℹ️",
            });
        } catch (error) {
            toast.error(
                error?.message || "Gagal memeriksa update aplikasi."
            );
        } finally {
            setIsCheckingAppUpdate(false);
        }
    };

    const handleResetAppCache = async () => {
        if (typeof window === "undefined") {
            return;
        }

        if (!("serviceWorker" in navigator)) {
            toast.error("Service worker belum tersedia di browser ini.");
            return;
        }

        setIsResettingAppCache(true);

        try {
            await sendMessageToWorker("RESET_APP_CACHE");
            setOfflineShellStatus({});
            window.localStorage.removeItem(OFFLINE_SHELL_STATUS_KEY);
            toast.success(
                "Cache aplikasi direset. Jalankan lagi setup offline shell bila diperlukan."
            );
        } catch (error) {
            toast.error(
                error?.message || "Gagal mereset cache aplikasi."
            );
        } finally {
            setIsResettingAppCache(false);
        }
    };

    return (
        <>
            <Head title="Setup PWA & Perangkat" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Install PWA & Setup Perangkat
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Halaman khusus untuk memasang aplikasi ke perangkat kasir, dapur, atau admin dan mengecek apakah browser siap menampilkan instalasi.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <PWAConnectionStatus />
                        <PWAInstallButton />
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
                    <div className="rounded-3xl border border-primary-200 bg-white p-6 dark:border-primary-900/40 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">
                            Install Aplikasi
                        </p>
                        <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                            {isInstalled || isStandalone
                                ? "Aplikasi sudah terpasang"
                                : "Pasang POINZA ke perangkat ini"}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                            {installHelpText}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-3">
                            {!isInstalled && !isStandalone && (
                                <button
                                    type="button"
                                    onClick={handleInstallAction}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
                                    >
                                        <IconDownload size={18} />
                                        {canPromptInstall
                                        ? "Instal Sekarang"
                                        : isIos
                                        ? "Lihat Cara Install iPhone/iPad"
                                        : "Cek Cara Install Perangkat Ini"}
                                </button>
                            )}
                            {(isInstalled || isStandalone) && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleAppUpdate}
                                        disabled={isCheckingAppUpdate}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                                    >
                                        <IconRefresh size={18} />
                                        {isCheckingAppUpdate
                                            ? "Memeriksa Update..."
                                            : "Periksa Update Aplikasi"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetAppCache}
                                        disabled={isResettingAppCache}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200"
                                    >
                                        <IconTrash size={18} />
                                        {isResettingAppCache
                                            ? "Mereset Cache..."
                                            : "Reset Cache Aplikasi"}
                                    </button>
                                </>
                            )}
                            <Link
                                href={route("transactions.index")}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                <IconHome size={18} />
                                Buka POS Kasir
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                            <IconInfoCircle
                                size={18}
                                className="text-primary-600"
                            />
                            <p className="font-semibold text-slate-900 dark:text-white">
                                Status Install
                            </p>
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Sudah terpasang
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {isInstalled ? "Ya" : "Belum"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Mode standalone
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {isStandalone ? "Aktif" : "Tidak"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Prompt browser siap
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {canPromptInstall ? "Ya" : "Belum"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Tombol install perlu tampil
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {shouldShowInstallEntry ? "Ya" : "Tidak"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Update aplikasi menunggu
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                    {diagnostics.waitingUpdate ? "Ya" : "Tidak"}
                                </span>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                                <p className="text-slate-500 dark:text-slate-400">
                                    Build aplikasi
                                </p>
                                <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                    {buildInfo?.version || "Belum tersedia"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {buildInfo?.generated_at
                                        ? `Build dibuat ${new Date(
                                              buildInfo.generated_at
                                          ).toLocaleString("id-ID")}`
                                        : "Manifest build belum ditemukan di server ini."}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                                Browser tidak menyediakan tombol web untuk uninstall atau install ulang aplikasi native. Untuk itu saya sediakan
                                ` Reset Cache Aplikasi ` agar shell dan cache bisa dibangun ulang dengan aman.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-sky-200 bg-sky-50/70 p-6 dark:border-sky-900/30 dark:bg-sky-950/20">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                                Offline Shell
                            </p>
                            <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                                Install aplikasi belum otomatis berarti siap offline penuh.
                            </h2>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                Setelah POINZA terpasang, jalankan setup offline shell untuk memanaskan route penting sesuai peran perangkat. Ini membantu perangkat kasir, dapur, atau supervisor membuka halaman inti yang sudah dipilih saat koneksi sempat tersedia.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                            {diagnostics.online
                                ? "Perangkat online dan siap setup."
                                : "Sambungkan internet dulu untuk setup offline shell."}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={warmAllOfflineShells}
                            disabled={
                                isWarmingAllProfiles ||
                                !diagnostics.online ||
                                !diagnostics.serviceWorker ||
                                offlineShellProfiles.length === 0
                            }
                            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconCloudDown size={18} />
                            {isWarmingAllProfiles
                                ? "Menyiapkan Semua Profil..."
                                : "Setup Offline Shell Lengkap"}
                        </button>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Cocok saat menyiapkan perangkat baru agar route inti kasir, kitchen, dan supervisor langsung dipanaskan ke cache.
                        </p>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-3">
                        {offlineShellProfiles.map((profile) => {
                            const status = offlineShellStatus[profile.key];
                            const isPreparing = warmingProfileKey === profile.key;

                            return (
                                <div
                                    key={profile.key}
                                    className="rounded-3xl border border-sky-200 bg-white p-5 dark:border-sky-900/30 dark:bg-slate-900"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-base font-semibold text-slate-900 dark:text-white">
                                                {profile.label}
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                {profile.description}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-sky-100 p-3 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                            <IconCloudDown size={18} />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {profile.routes.map((item) => (
                                            <span
                                                key={`${profile.key}-${item.href}`}
                                                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                            >
                                                {item.label}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/40">
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {status?.preparedAt
                                                ? `Terakhir disiapkan ${new Date(
                                                      status.preparedAt
                                                  ).toLocaleString("id-ID")}`
                                                : "Belum pernah disiapkan"}
                                        </p>
                                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                                            {status?.preparedAt
                                                ? `${status.okCount}/${status.totalCount} route berhasil dipanaskan ke cache perangkat.`
                                                : `${profile.routes.length} route inti akan disiapkan untuk profil ini.`}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => warmOfflineShell(profile)}
                                        disabled={
                                            isPreparing ||
                                            !diagnostics.online ||
                                            !diagnostics.serviceWorker
                                        }
                                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                                    >
                                        <IconPlugConnected size={18} />
                                        {isPreparing
                                            ? "Menyiapkan Offline Shell..."
                                            : "Setup Offline Shell"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    {diagnosticItems.map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className={`rounded-xl p-2 ${
                                        item.ok
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                    }`}
                                >
                                    {item.icon}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {item.label}
                                    </p>
                                    <p
                                        className={`text-xs font-medium ${
                                            item.ok
                                                ? "text-emerald-600 dark:text-emerald-300"
                                                : "text-amber-600 dark:text-amber-300"
                                        }`}
                                    >
                                        {item.ok ? "Siap" : "Perlu perhatian"}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                            <IconChecklist size={20} className="text-primary-600" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Checklist per Platform
                            </h2>
                        </div>
                        <div className="mt-4 space-y-4">
                            {platforms.map((platform) => (
                                <div
                                    key={platform.name}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                                >
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {platform.name}
                                    </p>
                                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
                                        {platform.steps.map((step) => (
                                            <li key={step}>{step}</li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <IconHome size={20} className="text-primary-600" />
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    URL Awal yang Direkomendasikan
                                </h2>
                            </div>
                            <div className="mt-4 space-y-3">
                                {recommendedRoutes.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-primary-300 dark:border-slate-800 dark:bg-slate-950/30"
                                    >
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {item.label}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {item.description}
                                        </p>
                                        <p className="mt-2 break-all text-xs text-primary-600 dark:text-primary-300">
                                            {item.href}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                            <div className="flex items-center gap-2">
                                <IconPlugConnected size={18} />
                                <p className="font-semibold">Catatan Operasional</p>
                            </div>
                            <ul className="mt-3 space-y-2 text-blue-800 dark:text-blue-200">
                                <li>Gunakan `localhost` atau HTTPS agar service worker dan tombol instalasi aktif.</li>
                                <li>Untuk tablet dapur, kombinasikan PWA dengan `Tautan Tablet / Kiosk` per stasiun.</li>
                                <li>Untuk kasir, lebih aman install langsung dari halaman POS agar shortcut membuka konteks transaksi.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

PWASetup.layout = (page) => <DashboardLayout children={page} />;
