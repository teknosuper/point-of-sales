import React, { useRef } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import KitchenLayout from "@/Layouts/KitchenLayout";
import {
    IconCheck,
    IconLock,
    IconShieldLock,
} from "@tabler/icons-react";

export default function PasswordPage() {
    const { auth } = usePage().props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const currentPasswordInput = useRef(null);
    const passwordInput = useRef(null);
    const {
        data,
        setData,
        put,
        processing,
        errors,
        reset,
        recentlySuccessful,
    } = useForm({
        current_password: "",
        password: "",
        password_confirmation: "",
    });

    const submit = (event) => {
        event.preventDefault();

        put(route("password.update"), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (formErrors) => {
                if (formErrors.password) {
                    reset("password", "password_confirmation");
                    passwordInput.current?.focus();
                }

                if (formErrors.current_password) {
                    reset("current_password");
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    return (
        <>
            <Head title="Ganti Password" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <IconLock
                                size={28}
                                className="text-primary-500"
                            />
                            Ganti Password
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Ubah password akun Anda secara mandiri. Gunakan
                            password yang kuat dan tidak dipakai di perangkat
                            lain.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                                <IconShieldLock size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Keamanan Akun
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Berlaku untuk akun{" "}
                                    {isKitchenWorkspace
                                        ? "workspace dapur / tenant"
                                        : "workspace dashboard / kasir"}
                                    .
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                Password lama wajib diisi untuk verifikasi.
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                Password baru sebaiknya berbeda dari password
                                lama dan tidak mudah ditebak.
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                Setelah berhasil diubah, sesi perangkat lain
                                akan diminta login ulang bila diperlukan.
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <form onSubmit={submit} className="space-y-5">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Password Saat Ini
                                </label>
                                <input
                                    ref={currentPasswordInput}
                                    type="password"
                                    autoComplete="current-password"
                                    value={data.current_password}
                                    onChange={(event) =>
                                        setData(
                                            "current_password",
                                            event.target.value
                                        )
                                    }
                                    className={`h-11 w-full rounded-xl border px-4 text-sm dark:bg-slate-800 ${
                                        errors.current_password
                                            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                                            : "border-slate-200 bg-slate-50 dark:border-slate-700"
                                    }`}
                                />
                                {errors.current_password ? (
                                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                                        {errors.current_password}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Password Baru
                                </label>
                                <input
                                    ref={passwordInput}
                                    type="password"
                                    autoComplete="new-password"
                                    value={data.password}
                                    onChange={(event) =>
                                        setData("password", event.target.value)
                                    }
                                    className={`h-11 w-full rounded-xl border px-4 text-sm dark:bg-slate-800 ${
                                        errors.password
                                            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                                            : "border-slate-200 bg-slate-50 dark:border-slate-700"
                                    }`}
                                />
                                {errors.password ? (
                                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                                        {errors.password}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Konfirmasi Password Baru
                                </label>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    value={data.password_confirmation}
                                    onChange={(event) =>
                                        setData(
                                            "password_confirmation",
                                            event.target.value
                                        )
                                    }
                                    className={`h-11 w-full rounded-xl border px-4 text-sm dark:bg-slate-800 ${
                                        errors.password_confirmation
                                            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
                                            : "border-slate-200 bg-slate-50 dark:border-slate-700"
                                    }`}
                                />
                                {errors.password_confirmation ? (
                                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                                        {errors.password_confirmation}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                {recentlySuccessful ? (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                        <IconCheck size={16} />
                                        Password berhasil diperbarui.
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        Simpan perubahan setelah semua field
                                        terisi benar.
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {processing
                                        ? "Menyimpan..."
                                        : "Simpan Password Baru"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}

PasswordPage.layout = (page) =>
    page.props?.auth?.user?.preferred_workspace === "kitchen" ? (
        <KitchenLayout children={page} />
    ) : (
        <DashboardLayout children={page} />
    );
