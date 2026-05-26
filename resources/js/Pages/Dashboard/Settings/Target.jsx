import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
    IconTarget,
    IconDeviceFloppy,
    IconCoin,
    IconChartBar,
    IconSearch,
    IconPackage,
    IconSparkles,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const formatNumber = (value = 0, maximumFractionDigits = 0) =>
    new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    }).format(Number(value || 0));

export default function Target({ settings, products = [], targetMeta = {} }) {
    const { activeOutlet } = usePage().props;
    const daysInMonth = Number(targetMeta?.days_in_month || 30);
    const [search, setSearch] = useState("");
    const { data, setData, post, processing, errors } = useForm({
        monthly_sales_target: settings?.monthly_sales_target || "",
        monthly_profit_target: settings?.monthly_profit_target || "",
        daily_global_item_target: settings?.daily_global_item_target || "",
        product_targets: products.map((product) => ({
            product_id: product.id,
            monthly_target: product.monthly_target || "",
        })),
    });

    const indexedProducts = useMemo(
        () =>
            products.map((product, index) => ({
                ...product,
                form_index: index,
                monthly_target:
                    data.product_targets?.[index]?.monthly_target ?? "",
            })),
        [products, data.product_targets]
    );

    const visibleProducts = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return indexedProducts.filter((product) => {
            if (!keyword) {
                return true;
            }

            return (
                product.title?.toLowerCase().includes(keyword) ||
                product.tenant_outlet?.name?.toLowerCase().includes(keyword) ||
                product.tenant_outlet?.code?.toLowerCase().includes(keyword)
            );
        });
    }, [indexedProducts, search]);

    const targetedProductsCount = useMemo(
        () =>
            indexedProducts.filter(
                (product) => Number(product.monthly_target || 0) > 0
            ).length,
        [indexedProducts]
    );
    const totalMonthlyItems = useMemo(
        () =>
            indexedProducts.reduce(
                (sum, product) => sum + Number(product.monthly_target || 0),
                0
            ),
        [indexedProducts]
    );
    const totalDailyItems = totalMonthlyItems / (daysInMonth || 1);
    const globalDailyItemTarget = Number(data.daily_global_item_target || 0);
    const globalMonthlyItemTarget = globalDailyItemTarget * (daysInMonth || 1);

    const setProductTarget = (index, value) => {
        const nextTargets = [...data.product_targets];
        nextTargets[index] = {
            ...nextTargets[index],
            monthly_target: value,
        };
        setData("product_targets", nextTargets);
    };

    const applyGlobalDailyTarget = () => {
        if (!indexedProducts.length) {
            toast.error("Belum ada produk untuk diisi target.");
            return;
        }

        const totalMonthlyTarget = Math.max(
            0,
            Math.round(Number(data.daily_global_item_target || 0) * daysInMonth)
        );
        const productCount = indexedProducts.length;
        const baseTarget = Math.floor(totalMonthlyTarget / productCount);
        const remainder = totalMonthlyTarget % productCount;
        const nextTargets = indexedProducts.map((product, index) => ({
            product_id: product.id,
            monthly_target:
                totalMonthlyTarget <= 0
                    ? ""
                    : String(baseTarget + (index < remainder ? 1 : 0)),
        }));

        setData("product_targets", nextTargets);
        toast.success("Target item semua produk berhasil diisi.");
    };

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
                        Fokuskan target utama pada jumlah item terjual per produk
                        setiap bulan, lalu turunkan otomatis menjadi target harian.
                    </p>
                    {activeOutlet?.name && (
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                            Outlet aktif: {activeOutlet.name}
                        </p>
                    )}
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Produk terbaca untuk target item:{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {formatNumber(products.length)}
                        </span>
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-primary-100 p-3 dark:bg-primary-900/30">
                                <IconPackage
                                    size={22}
                                    className="text-primary-600 dark:text-primary-400"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    Produk Bertarget
                                </p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatNumber(targetedProductsCount)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-emerald-100 p-3 dark:bg-emerald-900/30">
                                <IconTarget
                                    size={22}
                                    className="text-emerald-600 dark:text-emerald-400"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    Target Item Bulanan
                                </p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatNumber(totalMonthlyItems)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-amber-100 p-3 dark:bg-amber-900/30">
                                <IconChartBar
                                    size={22}
                                    className="text-amber-600 dark:text-amber-400"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    Rata-rata Target Harian
                                </p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatNumber(totalDailyItems, 2)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Berdasarkan {daysInMonth} hari di{" "}
                                    {targetMeta?.month_label || "bulan aktif"}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-violet-100 p-3 dark:bg-violet-900/30">
                                <IconSparkles
                                    size={22}
                                    className="text-violet-600 dark:text-violet-400"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    Target Harian Global
                                </p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {formatNumber(globalDailyItemTarget)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Setara {formatNumber(globalMonthlyItemTarget)} item/bulan
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <form
                    onSubmit={submit}
                    className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="mb-4 flex items-start gap-4">
                                <div className="rounded-xl bg-primary-100 p-3 dark:bg-primary-900/30">
                                    <IconTarget
                                        size={24}
                                        className="text-primary-600 dark:text-primary-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Target Penjualan Item per Bulan
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Isi jumlah item yang ingin terjual untuk
                                        setiap produk. Sistem akan menampilkan
                                        konversi target harian secara otomatis.
                                    </p>
                                </div>
                            </div>

                            <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                                    <div className="flex-1">
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Target Harian Global
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={data.daily_global_item_target}
                                            onChange={(event) =>
                                                setData(
                                                    "daily_global_item_target",
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Contoh: 100"
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Target ini akan dikonversi menjadi{" "}
                                            <span className="font-semibold">
                                                {formatNumber(globalMonthlyItemTarget)}
                                            </span>{" "}
                                            item per bulan, lalu dibagi merata-minimal ke semua produk.
                                        </p>
                                        {errors.daily_global_item_target && (
                                            <p className="mt-1 text-sm text-danger-500">
                                                {errors.daily_global_item_target}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={applyGlobalDailyTarget}
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700"
                                    >
                                        <IconSparkles size={18} />
                                        Isi Minimal Semua Produk
                                    </button>
                                </div>
                            </div>

                            <div className="relative mb-4">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <IconSearch size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Cari produk atau tenant..."
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </div>

                            <div className="mb-4 rounded-2xl border border-dashed border-primary-200 bg-white p-4 dark:border-primary-900 dark:bg-slate-900">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Input Target Item
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Isi kolom <span className="font-semibold">Target/Bulan</span> pada produk yang ingin dikejar. Target harian akan muncul otomatis di kolom sebelahnya.
                                </p>
                            </div>

                            <div className="max-h-[640px] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Produk
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Target/Bulan
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Target/Hari
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {visibleProducts.length > 0 ? visibleProducts.map((product) => {
                                            const monthlyTarget = Number(
                                                product.monthly_target || 0
                                            );
                                            const dailyTarget =
                                                monthlyTarget / (daysInMonth || 1);

                                            return (
                                                <tr key={product.id}>
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="font-medium text-slate-900 dark:text-white">
                                                            {product.title}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Harga beli{" "}
                                                            {formatCurrency(
                                                                product.buy_price
                                                            )}{" "}
                                                            • Harga jual{" "}
                                                            {formatCurrency(
                                                                product.sell_price
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            Stok referensi{" "}
                                                            {formatNumber(
                                                                product.stock
                                                            )}
                                                            {product.tenant_outlet
                                                                ? ` • Tenant ${product.tenant_outlet.name}`
                                                                : ""}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={
                                                                product.monthly_target
                                                            }
                                                            onChange={(event) =>
                                                                setProductTarget(
                                                                    product.form_index,
                                                                    event.target
                                                                        .value
                                                                )
                                                            }
                                                            className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-right text-slate-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                        />
                                                        {errors[
                                                            `product_targets.${product.form_index}.monthly_target`
                                                        ] && (
                                                            <p className="mt-1 text-xs text-danger-500">
                                                                {
                                                                    errors[
                                                                        `product_targets.${product.form_index}.monthly_target`
                                                                    ]
                                                                }
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right align-top font-medium text-slate-700 dark:text-slate-300">
                                                        {monthlyTarget > 0
                                                            ? formatNumber(
                                                                  dailyTarget,
                                                                  2
                                                              )
                                                            : "0"}
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                                                >
                                                    Tidak ada produk yang cocok
                                                    dengan filter ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="mb-4 flex items-start gap-4">
                                    <div className="rounded-xl bg-cyan-100 p-3 dark:bg-cyan-900/30">
                                        <IconCoin
                                            size={24}
                                            className="text-cyan-600 dark:text-cyan-400"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Target Nilai Bulanan
                                        </h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Tetap dipertahankan untuk kompatibilitas
                                            laporan omzet dan profit.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Target Penjualan Bulanan
                                        </label>
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
                                            className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-slate-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                        {data.monthly_sales_target > 0 && (
                                            <p className="mt-2 text-sm text-slate-500">
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

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Target Keuntungan Bulanan
                                        </label>
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
                                            className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                        {data.monthly_profit_target > 0 && (
                                            <p className="mt-2 text-sm text-slate-500">
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

                            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-900 dark:bg-primary-950/30">
                                <p className="text-sm text-primary-700 dark:text-primary-300">
                                    <strong>Catatan:</strong> target item harian
                                    dihitung otomatis dari target bulanan dibagi{" "}
                                    {daysInMonth} hari di{" "}
                                    {targetMeta?.month_label || "bulan aktif"}.
                                    Ini lebih relevan untuk owner outlet yang
                                    mengejar volume item, bukan hanya markup nominal.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:opacity-60"
                        >
                            <IconDeviceFloppy size={18} />
                            {processing ? "Menyimpan..." : "Simpan Target"}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

Target.layout = (page) => <DashboardLayout children={page} />;
