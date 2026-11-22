import { useEffect, useRef } from "react";
import { Head, Link, useForm, usePage } from "@inertiajs/react";
import AuthBotGuardFields from "@/Components/AuthBotGuardFields";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import {
    IconShoppingCart,
    IconMail,
    IconLock,
    IconEye,
    IconEyeOff,
    IconLoader2,
} from "@/Utils/icons";
import { useState } from "react";

export default function Login({
    status,
    canResetPassword,
    canRegister,
    botGuard,
    workspaceMode = "standard",
    stationHint = null,
    kioskMode = false,
}) {
    const { flash } = usePage().props;
    const honeypotField = botGuard?.honeypot_field || "company_website";
    const tokenField = botGuard?.token_field || "bot_guard_token";
    const { data, setData, post, processing, errors, reset } = useForm({
        email: "",
        password: "",
        remember: false,
        [honeypotField]: "",
        [tokenField]: botGuard?.token || "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const lastFlashSignatureRef = useRef(null);
    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    const refreshBotGuard = async () => {
        try {
            const response = await axios.get(route("bot-guard.payload"), {
                headers: {
                    Accept: "application/json",
                },
            });

            const payload = response?.data?.botGuard;
            if (payload?.token) {
                setData(tokenField, payload.token);
                setData(honeypotField, "");
            }
        } catch (error) {
            console.error("Failed to refresh bot guard token", error);
        }
    };

    useEffect(() => {
        return () => reset("password");
    }, []);

    useEffect(() => {
        refreshBotGuard();

        const handlePageShow = () => {
            refreshBotGuard();
        };

        window.addEventListener("pageshow", handlePageShow);

        return () => {
            window.removeEventListener("pageshow", handlePageShow);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const focusDelay = window.setTimeout(() => {
            const isTouchDevice = window.matchMedia?.("(pointer: coarse)")
                ?.matches;
            const target = data.email ? passwordInputRef.current : emailInputRef.current;

            if (isTouchDevice && target) {
                target.focus();
            }
        }, 180);

        return () => window.clearTimeout(focusDelay);
    }, []);

    useEffect(() => {
        if (errors.human) {
            refreshBotGuard();
        }
    }, [errors.human]);

    useEffect(() => {
        const entries = [
            ["success", flash?.success],
            ["error", flash?.error],
            ["warning", flash?.warning],
            ["info", flash?.info],
            ["status", flash?.status],
        ].filter(([, message]) => Boolean(message));

        if (!entries.length) {
            lastFlashSignatureRef.current = null;
            return;
        }

        const signature = entries
            .map(([type, message]) => `${type}:${message}`)
            .join("|");

        if (lastFlashSignatureRef.current === signature) {
            return;
        }

        lastFlashSignatureRef.current = signature;

        entries.forEach(([type, message]) => {
            if (type === "success" || type === "status") {
                toast.success(message);
                return;
            }

            if (type === "error") {
                toast.error(message, { duration: 4500 });
                return;
            }

            if (type === "warning") {
                toast(message, {
                    duration: 4500,
                    icon: "!",
                });
                return;
            }

            toast(message);
        });
    }, [flash]);

    const submit = (e) => {
        e.preventDefault();
        post(route("login"));
    };

    const isKitchenMode = workspaceMode === "kitchen";

    return (
        <>
            <Head title="Masuk" />
            <Toaster position="top-right" />

            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.14),_transparent_34%),linear-gradient(180deg,_#f8fafc,_#eef2ff_52%,_#f8fafc)] px-5 py-8 dark:bg-slate-950">
                <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white/92 p-6 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.3)] backdrop-blur sm:p-7 dark:border-slate-800 dark:bg-slate-900/92">
                        {/* Logo */}
                        <div className="mb-6 text-center">
                            <div className="mb-4 inline-flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
                                    <IconShoppingCart
                                        size={22}
                                        className="text-white"
                                    />
                                </div>
                                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    GTC KASIR
                                </span>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {isKitchenMode
                                    ? "Masuk ke Layar Dapur"
                                    : "Selamat Datang"}
                            </h1>
                            {isKitchenMode && stationHint ? (
                                <div className="mt-4 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-left text-sm text-primary-800 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-200">
                                    <p className="font-semibold">
                                        Stasiun tujuan: {stationHint.name}
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-primary-600 dark:text-primary-300">
                                        {stationHint.outlet_code || "OUT"} •{" "}
                                        {stationHint.outlet_name || "Outlet"}
                                    </p>
                                </div>
                            ) : null}
                            {isKitchenMode && kioskMode ? (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                                    Mode kiosk aktif. Setelah login, perangkat akan beralih ke tampilan antrean dapur yang lebih ringkas.
                                </div>
                            ) : null}
                        </div>

                        {/* Status Message */}
                        {status && (
                            <div className="mb-6 p-4 rounded-xl bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-400 text-sm">
                                {status}
                            </div>
                        )}

                        {flash?.error && (
                            <div className="mb-6 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:bg-danger-950/40 dark:text-danger-300">
                                {flash.error}
                            </div>
                        )}

                        {flash?.warning && (
                            <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                {flash.warning}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={submit} className="space-y-4">
                            <AuthBotGuardFields
                                botGuard={botGuard}
                                data={data}
                                setData={setData}
                            />
                            {errors.human && (
                                <div className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-600 dark:bg-danger-950/40 dark:text-danger-300">
                                    {errors.human}
                                </div>
                            )}
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Email
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <IconMail size={20} />
                                    </div>
                                    <input
                                        ref={emailInputRef}
                                        type="email"
                                        value={data.email}
                                        onChange={(e) =>
                                            setData("email", e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                passwordInputRef.current?.focus();
                                            }
                                        }}
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        inputMode="email"
                                        placeholder="nama@email.com"
                                        className={`w-full h-12 pl-12 pr-4 rounded-xl border-2 ${
                                            errors.email
                                                ? "border-danger-500 focus:border-danger-500"
                                                : "border-slate-200 dark:border-slate-700 focus:border-primary-500"
                                        } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-primary-500/20 transition-all`}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="mt-1.5 text-sm text-danger-500">
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <IconLock size={20} />
                                    </div>
                                    <input
                                        ref={passwordInputRef}
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        value={data.password}
                                        onChange={(e) =>
                                            setData("password", e.target.value)
                                        }
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        className={`w-full h-12 pl-12 pr-12 rounded-xl border-2 ${
                                            errors.password
                                                ? "border-danger-500 focus:border-danger-500"
                                                : "border-slate-200 dark:border-slate-700 focus:border-primary-500"
                                        } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-primary-500/20 transition-all`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? (
                                            <IconEyeOff size={20} />
                                        ) : (
                                            <IconEye size={20} />
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1.5 text-sm text-danger-500">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Remember & Forgot */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.remember}
                                        onChange={(e) =>
                                            setData(
                                                "remember",
                                                e.target.checked
                                            )
                                        }
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-500 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        Ingat saya
                                    </span>
                                </label>

                                {canResetPassword && (
                                    <Link
                                        href={route("password.request")}
                                        className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                        Lupa Password?
                                    </Link>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold hover:from-primary-600 hover:to-primary-700 focus:ring-4 focus:ring-primary-500/30 disabled:opacity-50 transition-all"
                            >
                                {processing ? (
                                    <>
                                        <IconLoader2
                                            size={20}
                                            className="animate-spin"
                                        />
                                        Memproses...
                                    </>
                                ) : (
                                    "Masuk"
                                )}
                            </button>

                            {/* Register Link */}
                            {canRegister && (
                                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                                    Belum punya akun?{" "}
                                    <Link
                                        href="/register"
                                        className="text-primary-500 hover:text-primary-600 font-semibold"
                                    >
                                        Daftar Sekarang
                                    </Link>
                                </p>
                            )}
                        </form>
                </div>
            </div>
        </>
    );
}
