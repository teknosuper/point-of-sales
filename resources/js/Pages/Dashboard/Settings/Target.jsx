import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import useFlashToast from "@/Hooks/useFlashToast";
import {
    IconTarget,
    IconDeviceFloppy,
    IconCoin,
    IconChartBar,
    IconSearch,
    IconPackage,
    IconSparkles,
    IconChevronDown,
    IconChevronRight,
    IconBuildingStore,
} from "@/Utils/icons";

const fmtCurrency = (v = 0) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(v || 0));

const fmtNum = (v = 0, d = 0) =>
    new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: d }).format(Number(v || 0));

export default function Target({ settings, products = [], targetMeta = {} }) {
    useFlashToast();
    const { activeOutlet } = usePage().props;
    const daysInMonth = Number(targetMeta?.days_in_month || 30);
    const daysElapsed = Number(targetMeta?.days_elapsed || 1);
    const isTenant = targetMeta?.mode === "tenant";
    const [search, setSearch] = useState("");
    const [showValueTargets, setShowValueTargets] = useState(false);
    const [expandedTenants, setExpandedTenants] = useState({});
    const { data, setData, post, processing, errors } = useForm({
        monthly_sales_target: settings?.monthly_sales_target || "",
        monthly_profit_target: settings?.monthly_profit_target || "",
        daily_global_item_target: settings?.daily_global_item_target || "",
        product_targets: products.map((p) => ({
            product_id: p.id,
            monthly_target: p.monthly_target || "",
        })),
    });

    const indexedProducts = useMemo(
        () => products.map((p, i) => ({ ...p, form_index: i, monthly_target: data.product_targets?.[i]?.monthly_target ?? "" })),
        [products, data.product_targets]
    );

    const visibleProducts = useMemo(() => {
        const kw = search.trim().toLowerCase();
        return kw
            ? indexedProducts.filter((p) =>
                  [p.title, p.tenant_outlet?.name, p.tenant_outlet?.code].some((v) => v?.toLowerCase().includes(kw))
              )
            : indexedProducts;
    }, [indexedProducts, search]);

    // === Global aggregation ===
    const targetedCount = useMemo(() => indexedProducts.filter((p) => Number(p.monthly_target || 0) > 0).length, [indexedProducts]);
    const totalMonthly = useMemo(() => indexedProducts.reduce((s, p) => s + Number(p.monthly_target || 0), 0), [indexedProducts]);
    const totalDaily = totalMonthly / (daysInMonth || 1);
    const totalActual = useMemo(() => indexedProducts.reduce((s, p) => s + Number(p.actual_monthly_qty || 0), 0), [indexedProducts]);
    const globalDaily = Number(data.daily_global_item_target || 0);
    const globalMonthly = globalDaily * daysInMonth;

    // === Per-tenant breakdown ===
    const tenantGroups = useMemo(() => {
        const byTenant = { _unassigned: { tenant_name: "Tanpa Tenant", tenant_code: null, products: [] } };

        indexedProducts.forEach((p) => {
            const key = p.tenant_outlet ? `tenant_${p.tenant_outlet.id}` : "_unassigned";
            if (!byTenant[key]) {
                byTenant[key] = {
                    tenant_name: p.tenant_outlet.name,
                    tenant_code: p.tenant_outlet.code,
                    tenant_id: p.tenant_outlet.id,
                    products: [],
                };
            }
            byTenant[key].products.push(p);
        });

        return Object.values(byTenant).sort((a, b) => {
            if (a.tenant_name === "Tanpa Tenant") return 1;
            if (b.tenant_name === "Tanpa Tenant") return -1;
            return a.tenant_name.localeCompare(b.tenant_name);
        });
    }, [indexedProducts]);

    const totalMargin = useMemo(
        () =>
            tenantGroups.reduce((sum, tg) => {
                return (
                    sum +
                    tg.products.reduce((s, p) => {
                        const mt = Number(p.monthly_target || 0);
                        const margin = Math.max(0, Number(p.buy_price || 0) - Number(p.tenant_hpp_price || p.buy_price || 0));
                        const markup = Math.max(0, Number(p.sell_price || 0) - Number(p.buy_price || 0));
                        return s + mt * (isTenant ? margin : markup);
                    }, 0)
                );
            }, 0),
        [tenantGroups, isTenant]
    );

    const setProductTarget = (index, value) => {
        const next = [...data.product_targets];
        next[index] = { ...next[index], monthly_target: value };
        setData("product_targets", next);
    };

    const applyGlobal = () => {
        if (!indexedProducts.length) { toast.error("Belum ada produk."); return; }
        const totalM = Math.max(0, Math.round(globalDaily * daysInMonth));
        const base = Math.floor(totalM / indexedProducts.length);
        const rem = totalM % indexedProducts.length;
        setData("product_targets", indexedProducts.map((_, i) => ({ product_id: indexedProducts[i].id, monthly_target: totalM <= 0 ? "" : String(base + (i < rem ? 1 : 0)) })));
        toast.success("Target terisi ke semua produk.");
    };

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.target.update"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Target disimpan"),
            onError: () => toast.error("Gagal menyimpan"),
        });
    };

    const toggleTenant = (key) => {
        setExpandedTenants((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const AchievementBadge = ({ pct }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight whitespace-nowrap ${
            pct >= 100
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                : pct >= 60
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
        }`}>{fmtNum(pct, 1)}%</span>
    );

    return (
        <>
            <Head title="Target Bisnis" />
            <div className="max-w-full space-y-4 px-0">
                {/* Header */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate sm:text-xl">Target Bisnis</h1>
                        {activeOutlet?.name && (
                            <p className="text-[11px] font-medium uppercase tracking-wider text-primary-600 dark:text-primary-300 truncate">{activeOutlet.name}</p>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500 shrink-0">{fmtNum(products.length)} produk</p>
                </div>

                {/* Stat cards — responsive grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-primary-100 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 shrink-0">
                                <IconPackage size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Produk Bertarget</p>
                                <p className="text-base font-bold text-slate-900 dark:text-white">{fmtNum(targetedCount)}</p>
                                <p className="text-[10px] text-slate-400 truncate">dari {fmtNum(products.length)} produk</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                                <IconTarget size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Target Bulanan</p>
                                <p className="text-base font-bold text-slate-900 dark:text-white">{fmtNum(totalMonthly)}</p>
                                <p className="text-[10px] text-slate-400 truncate">{fmtNum(totalDaily, 2)}/hari</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                                <IconChartBar size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Global Harian</p>
                                <p className="text-base font-bold text-slate-900 dark:text-white">{fmtNum(globalDaily)}</p>
                                <p className="text-[10px] text-slate-400 truncate">{fmtNum(globalMonthly)}/bulan</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-cyan-100 p-2 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 shrink-0">
                                <IconCoin size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Realisasi</p>
                                <p className="text-base font-bold text-slate-900 dark:text-white">{fmtNum(totalActual)}</p>
                                <p className="text-[10px] text-slate-400 truncate">{fmtNum(totalActual / Math.max(1, daysElapsed), 2)}/hari</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 col-span-2 sm:col-span-1">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-violet-100 p-2 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 shrink-0">
                                <IconSparkles size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{isTenant ? "Estimasi Margin" : "Estimasi Markup"}</p>
                                <p className="text-base font-bold text-slate-900 dark:text-white truncate">{fmtCurrency(totalMargin)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main form */}
                <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
                    {/* Quick fill bar — stacks on mobile */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                        <div className="flex-1 min-w-0">
                            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-300">Isi Cepat Target Harian</label>
                            <input type="number" min="0" value={data.daily_global_item_target} onChange={(e) => setData("daily_global_item_target", e.target.value)} placeholder="cth: 100" className="h-9 w-full max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                            {errors.daily_global_item_target && <p className="mt-1 text-[11px] text-danger-500">{errors.daily_global_item_target}</p>}
                        </div>
                        <button type="button" onClick={applyGlobal} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 shrink-0 sm:self-end">
                            <IconSparkles size={14} /> Terapkan
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk atau tenant..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>

                    {/* === BREAKDOWN PER TENANT === */}
                    <div className="space-y-3">
                        {tenantGroups.map((tg) => {
                            const tenantKey = tg.tenant_code || "unassigned";
                            const tgMonthly = tg.products.reduce((s, p) => s + Number(p.monthly_target || 0), 0);
                            const tgActual = tg.products.reduce((s, p) => s + Number(p.actual_monthly_qty || 0), 0);
                            const tgAch = tgMonthly > 0 ? Math.min(100, (tgActual / tgMonthly) * 100) : 0;
                            const tgCount = tg.products.length;
                            const tgTargeted = tg.products.filter((p) => Number(p.monthly_target || 0) > 0).length;
                            const tgMargin = tg.products.reduce((s, p) => {
                                const mt = Number(p.monthly_target || 0);
                                const margin = Math.max(0, Number(p.buy_price || 0) - Number(p.tenant_hpp_price || p.buy_price || 0));
                                const markup = Math.max(0, Number(p.sell_price || 0) - Number(p.buy_price || 0));
                                return s + mt * (isTenant ? margin : markup);
                            }, 0);
                            const isExpanded = expandedTenants[tenantKey] ?? true;

                            return (
                                <div key={tenantKey} className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    {/* Tenant header — stacks on mobile */}
                                    <button type="button" onClick={() => toggleTenant(tenantKey)} className="flex w-full items-start gap-2 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 transition-colors sm:items-center">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="rounded-lg bg-primary-100 p-1.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 shrink-0">
                                                <IconBuildingStore size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                                    {tg.tenant_name}
                                                    {tg.tenant_code && <span className="ml-1 font-normal text-slate-400">({tg.tenant_code})</span>}
                                                </p>
                                                <p className="text-[10px] text-slate-500 truncate">
                                                    {fmtNum(tgCount)} produk · {fmtNum(tgTargeted)} bertarget · {fmtNum(tgMonthly)} item
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="hidden sm:block text-right text-[11px]">
                                                <p className="font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(tgMargin)}</p>
                                                <p className="text-slate-400">Realisasi {fmtNum(tgActual)}</p>
                                            </div>
                                            <AchievementBadge pct={tgAch} />
                                            {isExpanded ? <IconChevronDown size={14} className="text-slate-400 shrink-0" /> : <IconChevronRight size={14} className="text-slate-400 shrink-0" />}
                                        </div>
                                    </button>

                                    {/* Tenant product table — scrollable horizontally on mobile */}
                                    {isExpanded && (
                                        <div className="overflow-x-auto -mx-0">
                                            <div className="inline-block min-w-full align-middle">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-100/60 dark:bg-slate-800/60">
                                                        <tr>
                                                            <th className="sticky left-0 z-10 bg-slate-100/60 dark:bg-slate-800/60 px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Produk</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Harga</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Target/Bln</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">/Hari</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Aktual</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Gap</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Achv</th>
                                                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500 whitespace-nowrap">Estimasi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {tg.products.map((p) => {
                                                            const mt = Number(p.monthly_target || 0);
                                                            const dt = mt / (daysInMonth || 1);
                                                            const ach = Number(p.achievement_percentage || 0);
                                                            const gap = Number(p.target_gap_qty || 0);
                                                            const marginVal = Math.max(0, Number(p.buy_price || 0) - Number(p.tenant_hpp_price || p.buy_price || 0));
                                                            const markupVal = Math.max(0, Number(p.sell_price || 0) - Number(p.buy_price || 0));
                                                            const unitVal = isTenant ? marginVal : markupVal;
                                                            const estMonthly = mt * unitVal;
                                                            const estDaily = dt * unitVal;

                                                            return (
                                                                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-2 py-2 min-w-[120px] max-w-[180px]">
                                                                        <p className="text-[11px] font-medium text-slate-900 dark:text-white truncate">{p.title}</p>
                                                                        <p className="text-[10px] text-slate-400 truncate">
                                                                            {p.category_name}
                                                                            {p.kitchen_station_name !== "Belum Dipetakan" && ` · ${p.kitchen_station_name}`}
                                                                        </p>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right text-[10px] text-slate-500 whitespace-nowrap">
                                                                        <div>{fmtCurrency(p.sell_price)}</div>
                                                                        <div>{fmtCurrency(p.buy_price)}</div>
                                                                    </td>
                                                                    <td className="px-2 py-2 whitespace-nowrap">
                                                                        <input type="number" min="0" value={p.monthly_target} onChange={(e) => setProductTarget(p.form_index, e.target.value)} className="h-7 w-20 rounded-md border border-slate-200 bg-white px-1.5 text-right text-[11px] focus:border-primary-500 focus:ring-1.5 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                                                        {errors[`product_targets.${p.form_index}.monthly_target`] && (
                                                                            <p className="text-[10px] text-danger-500">{errors[`product_targets.${p.form_index}.monthly_target`]}</p>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right text-[11px] font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                                        {mt > 0 ? fmtNum(dt, 1) : "0"}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                        <div className="text-[11px] text-slate-700 dark:text-slate-300">{fmtNum(p.actual_monthly_qty || 0)}</div>
                                                                        <div className="text-[10px] text-slate-400">{fmtNum(p.actual_daily_avg || 0, 1)}/hari</div>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right text-[11px] font-medium text-amber-600 whitespace-nowrap">
                                                                        {gap > 0 ? fmtNum(gap) : "0"}
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                        <AchievementBadge pct={ach} />
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right whitespace-nowrap">
                                                                        <div className="text-[11px] font-medium text-emerald-600">{fmtCurrency(estMonthly)}</div>
                                                                        <div className="text-[10px] text-slate-400">{fmtCurrency(estDaily)}/hari</div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Bottom bar — stacks on mobile */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                        {/* Target Nilai */}
                        <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                            <button type="button" onClick={() => setShowValueTargets((v) => !v)} className="flex w-full items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                                <span>Target Nilai Bulanan</span>
                                {showValueTargets ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                            </button>
                            <p className="text-[10px] text-slate-400 mt-0.5">Opsional — omzet & profit</p>
                            {showValueTargets && (
                                <div className="mt-3 space-y-2">
                                    <div>
                                        <label className="mb-0.5 block text-[10px] font-medium text-slate-600">Target Penjualan</label>
                                        <input type="number" value={data.monthly_sales_target} onChange={(e) => setData("monthly_sales_target", e.target.value)} placeholder="cth: 50000000" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                        {data.monthly_sales_target > 0 && <p className="mt-0.5 text-[10px] text-slate-500">{fmtCurrency(data.monthly_sales_target)}</p>}
                                        {errors.monthly_sales_target && <p className="mt-0.5 text-[10px] text-danger-500">{errors.monthly_sales_target}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-0.5 block text-[10px] font-medium text-slate-600">Target Keuntungan</label>
                                        <input type="number" value={data.monthly_profit_target} onChange={(e) => setData("monthly_profit_target", e.target.value)} placeholder="cth: 15000000" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                        {data.monthly_profit_target > 0 && <p className="mt-0.5 text-[10px] text-slate-500">{fmtCurrency(data.monthly_profit_target)}</p>}
                                        {errors.monthly_profit_target && <p className="mt-0.5 text-[10px] text-danger-500">{errors.monthly_profit_target}</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info note */}
                        <div className="flex-1 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 dark:border-primary-900 dark:bg-primary-950/20 flex items-center">
                            <p className="text-[10px] text-primary-700 dark:text-primary-300 leading-relaxed">
                                Target harian = target bulanan ÷ {daysInMonth} hari ({targetMeta?.month_label || "bulan aktif"}).
                            </p>
                        </div>

                        {/* Save */}
                        <div className="flex items-end sm:items-center">
                            <button type="submit" disabled={processing} className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                                <IconDeviceFloppy size={15} />
                                {processing ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

Target.layout = (page) => <DashboardLayout children={page} />;