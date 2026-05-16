import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import toast from "react-hot-toast";
import {
    IconTarget,
    IconDeviceFloppy,
    IconCoin,
    IconChartBar,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

export default function Target({ settings }) {
    const { activeOutlet } = usePage().props;
    const { data, setData, post, processing, errors } = useForm({
        monthly_sales_target: settings?.monthly_sales_target || "",
        monthly_profit_target: settings?.monthly_profit_target || "",
    });

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.target.update"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Target berhasil disimpan"),
            onError: () => toast.error("Gagal menyimpan target"),
        });
    };

    return (
        <>
            <Head title="Target Bisnis" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Target Bisnis
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Atur target penjualan dan target keuntungan bulanan untuk bisnis Anda.
                    </p>
                    {activeOutlet?.name && (
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                            Outlet aktif: {activeOutlet.name}
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <form onSubmit={submit} className="space-y-6">
                        <div className="grid gap-5 lg:grid-cols-2">
                            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="rounded-xl bg-primary-100 p-3 dark:bg-primary-900/30">
                                    <IconTarget
                                        size={24}
                                        className="text-primary-600 dark:text-primary-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Target Penjualan Bulanan
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            <IconCoin size={20} />
                                        </div>
                                        <input
                                            type="number"
                                            value={data.monthly_sales_target}
                                            onChange={(e) =>
                                                setData(
                                                    "monthly_sales_target",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Contoh: 50000000"
                                            className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white pl-12 pr-4 text-slate-900 placeholder-slate-400 transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>
                                    {data.monthly_sales_target > 0 && (
                                        <p className="mt-2 text-sm text-slate-500">
                                            Target:{" "}
                                            {formatCurrency(
                                                data.monthly_sales_target
                                            )}
                                        </p>
                                    )}
                                    {errors.monthly_sales_target && (
                                        <p className="mt-1 text-sm text-danger-500">
                                            {errors.monthly_sales_target}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="rounded-xl bg-emerald-100 p-3 dark:bg-emerald-900/30">
                                    <IconChartBar
                                        size={24}
                                        className="text-emerald-600 dark:text-emerald-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Target Keuntungan Bulanan
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            <IconCoin size={20} />
                                        </div>
                                        <input
                                            type="number"
                                            value={data.monthly_profit_target}
                                            onChange={(e) =>
                                                setData(
                                                    "monthly_profit_target",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Contoh: 15000000"
                                            className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white pl-12 pr-4 text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>
                                    {data.monthly_profit_target > 0 && (
                                        <p className="mt-2 text-sm text-slate-500">
                                            Target:{" "}
                                            {formatCurrency(
                                                data.monthly_profit_target
                                            )}
                                        </p>
                                    )}
                                    {errors.monthly_profit_target && (
                                        <p className="mt-1 text-sm text-danger-500">
                                            {errors.monthly_profit_target}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={processing}
                                className="flex items-center gap-2"
                            >
                                <IconDeviceFloppy size={18} />
                                {processing ? "Menyimpan..." : "Simpan Target"}
                            </Button>
                        </div>
                    </form>
                </div>

                <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-900 dark:bg-primary-950/30">
                    <p className="text-sm text-primary-700 dark:text-primary-300">
                        <strong>Tip:</strong> Target penjualan akan ditampilkan di dashboard
                        sebagai progress pencapaian omzet bulanan. Target keuntungan membantu
                        memantau apakah margin bisnis sudah sesuai sasaran.
                    </p>
                </div>
            </div>
        </>
    );
}

Target.layout = (page) => <DashboardLayout children={page} />;
