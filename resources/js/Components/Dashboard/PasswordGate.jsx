import { useState, useEffect, useCallback } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import { IconLoader2, IconShieldLock } from "@/Utils/icons";

/**
 * PasswordGate — bungkus halaman yang butuh konfirmasi password.
 * Jika session password masih fresh (15 menit), tampilkan children.
 * Jika expired, tampilkan form konfirmasi password biasa.
 */
export default function PasswordGate({ children, label = "halaman ini" }) {
    const { security } = usePage().props;
    const checkFresh = useCallback(() => {
        if (!security?.stepUpFreshUntil) return false;
        return new Date(security.stepUpFreshUntil) > new Date();
    }, [security?.stepUpFreshUntil]);

    const [fresh, setFresh] = useState(checkFresh);

    useEffect(() => {
        setFresh(checkFresh());
    }, [checkFresh]);

    const { data, setData, post, processing, errors, reset } = useForm({
        password: "",
    });

    const submit = (e) => {
        e.preventDefault();
        post(route("password.confirm"), {
            preserveScroll: true,
            onSuccess: () => {
                setFresh(true);
                reset("password");
            },
        });
    };

    if (fresh) {
        return children;
    }

    return (
        <>
            <Head title="Konfirmasi Password" />
            <div className="mx-auto max-w-md py-12">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-950/50">
                        <IconShieldLock size={28} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <h1 className="text-center text-lg font-bold text-slate-900 dark:text-white">
                        Konfirmasi Password
                    </h1>
                    <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                        Masukkan password akun Anda untuk mengakses {label}.
                    </p>

                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Password
                            </label>
                            <input
                                type="password"
                                value={data.password}
                                onChange={(e) => setData("password", e.target.value)}
                                placeholder="Masukkan password Anda"
                                autoFocus
                                className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-danger-500">{errors.password}</p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-sm font-semibold text-white hover:from-primary-600 hover:to-primary-700 disabled:opacity-50"
                        >
                            {processing ? (
                                <><IconLoader2 size={18} className="animate-spin" /> Memverifikasi...</>
                            ) : (
                                "Lanjutkan"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
