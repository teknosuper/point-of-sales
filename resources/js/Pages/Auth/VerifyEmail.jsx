import { Head, Link, useForm } from "@inertiajs/react";
import AuthBotGuardFields from "@/Components/AuthBotGuardFields";
import {
    IconShoppingCart,
    IconMailCheck,
    IconLoader2,
    IconLogout,
    IconRefresh,
} from "@tabler/icons-react";

export default function VerifyEmail({ status, botGuard }) {
    const honeypotField = botGuard?.honeypot_field || "company_website";
    const tokenField = botGuard?.token_field || "bot_guard_token";
    const { data, setData, post, processing, errors } = useForm({
        [honeypotField]: "",
        [tokenField]: botGuard?.token || "",
    });

    const submit = (event) => {
        event.preventDefault();
        post(route("verification.send"));
    };

    return (
        <>
            <Head title="Verifikasi Email" />

            <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-md">
                        <div className="mb-8">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-3 mb-6"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                    <IconShoppingCart
                                        size={24}
                                        className="text-white"
                                    />
                                </div>
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                    POINZA
                                </span>
                            </Link>

                            <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-950/50 flex items-center justify-center mb-5">
                                <IconMailCheck
                                    size={28}
                                    className="text-primary-600 dark:text-primary-400"
                                />
                            </div>

                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                Verifikasi Email Anda
                            </h1>
                            <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
                                Sebelum masuk ke dashboard, klik link verifikasi
                                yang sudah kami kirim ke email Anda. Jika email
                                belum diterima, kirim ulang dari halaman ini.
                            </p>
                        </div>

                        {status === "verification-link-sent" && (
                            <div className="mb-6 p-4 rounded-xl bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-400 text-sm">
                                Link verifikasi baru sudah dikirim ke email
                                Anda.
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                            <div className="mb-5 rounded-xl bg-slate-50 dark:bg-slate-800/80 p-4 text-sm text-slate-600 dark:text-slate-300">
                                Pastikan juga memeriksa folder spam atau
                                promotion jika email belum terlihat di inbox.
                            </div>
                            {errors.human && (
                                <div className="mb-5 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-600 dark:bg-danger-950/40 dark:text-danger-300">
                                    {errors.human}
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-3">
                                <AuthBotGuardFields
                                    botGuard={botGuard}
                                    data={data}
                                    setData={setData}
                                />
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold hover:from-primary-600 hover:to-primary-700 focus:ring-4 focus:ring-primary-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {processing ? (
                                        <>
                                            <IconLoader2
                                                size={20}
                                                className="animate-spin"
                                            />
                                            Mengirim ulang...
                                        </>
                                    ) : (
                                        <>
                                            <IconRefresh size={18} />
                                            Kirim Ulang Email Verifikasi
                                        </>
                                    )}
                                </button>

                                <Link
                                    href={route("logout")}
                                    method="post"
                                    as="button"
                                    className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <IconLogout size={18} />
                                    Keluar
                                </Link>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center p-12">
                    <div className="max-w-md text-center text-white">
                        <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-8">
                            <IconMailCheck size={48} />
                        </div>
                        <h2 className="text-3xl font-bold mb-4">
                            Aktivasi Akun Lebih Aman
                        </h2>
                        <p className="text-lg opacity-90">
                            Verifikasi email membantu memastikan hanya akun yang
                            valid yang dapat mengakses dashboard dan data
                            operasional toko.
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            {[
                                "Akses Terverifikasi",
                                "Perlindungan Akun",
                                "Dashboard Aman",
                            ].map((item, index) => (
                                <span
                                    key={index}
                                    className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
