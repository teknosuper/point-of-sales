import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage } from "@inertiajs/react";
import { IconDeviceFloppy, IconStar, IconAlertTriangle } from "@/Utils/icons";
import toast from "react-hot-toast";

export default function MenuReviews({ settings }) {
    const { activeOutlet } = usePage().props;
    const { data, setData, post, processing, errors, isDirty } = useForm({
        shadow_ban_auto_penalty_enabled: Boolean(settings.shadow_ban_auto_penalty_enabled),
        shadow_ban_one_star_threshold: String(settings.shadow_ban_one_star_threshold ?? 6),
    });

    const submit = (event) => {
        event.preventDefault();
        post(route("settings.menu-reviews.update"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Pengaturan menu review disimpan"),
            onError: () => toast.error("Gagal menyimpan pengaturan menu review"),
        });
    };

    return (
        <>
            <Head title="Pengaturan Menu Review" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Pengaturan Menu Review
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Atur rules otomatis untuk mengevaluasi menu berdasarkan rating pelanggan.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                    <IconStar size={22} strokeWidth={1.5} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Auto-Penalty Shadow Ban
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Ketika produk terlalu banyak menerima review 1 bintang, produk akan otomatis masuk
                                        shadow ban dan perlu dievaluasi manajemen.
                                    </p>
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={data.shadow_ban_auto_penalty_enabled}
                                        onChange={(e) => setData("shadow_ban_auto_penalty_enabled", e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-500 peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Threshold review bintang 1
                                    </label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Produk akan di-<span className="font-semibold">shadow ban</span> otomatis jika total
                                        review bintang 1 melebihi angka ini.
                                    </p>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={data.shadow_ban_one_star_threshold}
                                        onChange={(e) => setData("shadow_ban_one_star_threshold", e.target.value)}
                                        className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm dark:bg-slate-800 dark:text-white ${
                                            errors.shadow_ban_one_star_threshold
                                                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                                                : "border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                                        }`}
                                    />
                                    {errors.shadow_ban_one_star_threshold && (
                                        <p className="mt-1 text-xs text-rose-600">{errors.shadow_ban_one_star_threshold}</p>
                                    )}
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                                    <div className="flex items-start gap-2">
                                        <IconAlertTriangle size={18} className="mt-0.5 text-amber-600 dark:text-amber-400" />
                                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                            <p className="font-semibold">Informasi</p>
                                            <p>
                                                Produk yang terkena auto-penalty akan masuk status&nbsp;
                                                <span className="font-semibold">Under Review</span> dan
                                                disembunyikan dari daftar menu publik.
                                            </p>
                                            <p>
                                                Manajemen dapat meninjau dan memutuskan apakah produk&nbsp;
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">diterima (unban)</span>&nbsp;
                                                atau&nbsp;
                                                <span className="font-semibold text-rose-600 dark:text-rose-400">ditolak (tetap banned)</span>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:opacity-60"
                        >
                            <IconDeviceFloppy size={18} />
                            {isDirty ? "Simpan Perubahan" : "Simpan Pengaturan"}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

MenuReviews.layout = (page) => <DashboardLayout children={page} />;
