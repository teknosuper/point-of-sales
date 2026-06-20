import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm } from "@inertiajs/react";
import useFlashToast from "@/Hooks/useFlashToast";
import {
    IconBuildingStore,
    IconChecklist,
    IconChefHat,
    IconDatabaseOff,
    IconDeviceFloppy,
    IconPackage,
    IconRefresh,
    IconRotateClockwise2,
    IconStack2,
} from "@/Utils/icons";

const formatNumber = (value) => new Intl.NumberFormat("id-ID").format(Number(value || 0));

export default function DataRepair({ target, summary, tenantsPreview = [], orphanAudit = [] }) {
    useFlashToast();

    const targetForm = useForm({
        main_outlet_id: String(target?.main_outlet_id || ""),
    });

    const syncTenantParentsForm = useForm({
        main_outlet_id: String(target?.main_outlet_id || ""),
    });

    const syncStocksForm = useForm({
        main_outlet_id: String(target?.main_outlet_id || ""),
    });

    const autoMapKitchenForm = useForm({
        main_outlet_id: String(target?.main_outlet_id || ""),
    });

    const rebuildMemberMetricsForm = useForm({
        main_outlet_id: String(target?.main_outlet_id || ""),
    });

    const syncTenantCategoriesForm = useForm({
        main_outlet_id: String(target?.main_outlet_id || ""),
    });

    const submitTargetOutlet = (event) => {
        event.preventDefault();
        targetForm.get(route("settings.data-repair"), {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const syncTenantParents = () => {
        syncTenantParentsForm.post(route("settings.data-repair.sync-tenant-parents"), {
            preserveScroll: true,
        });
    };

    const syncStocks = () => {
        syncStocksForm.post(route("settings.data-repair.sync-stocks"), {
            preserveScroll: true,
        });
    };

    const autoMapKitchen = () => {
        autoMapKitchenForm.post(route("settings.data-repair.auto-map-kitchen"), {
            preserveScroll: true,
        });
    };

    const rebuildMemberMetrics = () => {
        rebuildMemberMetricsForm.post(route("settings.data-repair.rebuild-member-metrics"), {
            preserveScroll: true,
        });
    };

    const syncTenantCategories = () => {
        syncTenantCategoriesForm.post(route("settings.data-repair.sync-tenant-categories"), {
            preserveScroll: true,
        });
    };

    const cards = [
        {
            label: "Tenant Anak",
            value: summary?.tenant_children_count,
            icon: IconStack2,
            helper: "Tenant aktif yang sudah berada di bawah outlet utama target.",
        },
        {
            label: "Tenant Orphan",
            value: summary?.orphan_tenants_count,
            icon: IconBuildingStore,
            helper: "Tenant aktif yang belum punya parent outlet yang jelas.",
        },
        {
            label: "Produk Tenant",
            value: summary?.tenant_products_count,
            icon: IconPackage,
            helper: "Produk tenant di bawah outlet utama target.",
        },
        {
            label: "Belum Mapping Dapur",
            value: summary?.tenant_products_without_station_count,
            icon: IconChefHat,
            helper: "Produk tenant yang belum punya station dapur aktif.",
        },
        {
            label: "Mismatch Stok",
            value: summary?.stock_mismatch_count,
            icon: IconRefresh,
            helper: "Produk tenant yang mirror stok outlet-nya belum sama dengan stok pusat.",
        },
        {
            label: "Station Tenant",
            value: summary?.tenant_stations_count,
            icon: IconChecklist,
            helper: "Station dapur aktif milik tenant anak.",
        },
        {
            label: "Kategori Tidak Cocok",
            value: summary?.tenant_category_mismatch_count,
            icon: IconRotateClockwise2,
            helper: "Produk tenant yang kategorinya belum cocok dengan tenant pemiliknya.",
        },
        {
            label: "Customer Scope",
            value: summary?.member_metrics_scope_count,
            icon: IconBuildingStore,
            helper: "Customer unik yang punya transaksi pada outlet utama target dan tenant anaknya.",
        },
    ];

    return (
        <>
            <Head title="Data Repair" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        Data Repair
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Rapikan parent tenant, stok terpusat, dan auto-mapping dapur tanpa SQL manual.
                    </p>
                </div>

                <form
                    onSubmit={submitTargetOutlet}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                Outlet Utama Target
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Semua aksi repair akan dibatasi ke outlet utama ini dan tenant anaknya.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 lg:w-[460px] lg:flex-row">
                            <select
                                value={targetForm.data.main_outlet_id}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    targetForm.setData("main_outlet_id", value);
                                    syncTenantParentsForm.setData("main_outlet_id", value);
                                    syncStocksForm.setData("main_outlet_id", value);
                                    autoMapKitchenForm.setData("main_outlet_id", value);
                                    rebuildMemberMetricsForm.setData("main_outlet_id", value);
                                    syncTenantCategoriesForm.setData("main_outlet_id", value);
                                }}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                {(target?.main_outlets || []).map((outlet) => (
                                    <option key={outlet.id} value={String(outlet.id)}>
                                        {outlet.code} - {outlet.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white"
                            >
                                <IconRotateClockwise2 size={18} />
                                Muat Ulang Preview
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Target aktif:
                        {" "}
                        <span className="font-semibold">
                            {target?.main_outlet?.code} - {target?.main_outlet?.name}
                        </span>
                    </div>
                </form>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {cards.map((card) => {
                        const Icon = card.icon;

                        return (
                            <div
                                key={card.label}
                                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                            {card.label}
                                        </p>
                                        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                                            {formatNumber(card.value)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                                        <Icon size={22} />
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                    {card.helper}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <IconStack2 size={20} />
                            <h2 className="text-base font-semibold">Sync Parent Tenant</h2>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Tetapkan semua tenant orphan yang masih bisa Anda akses ke outlet utama target.
                        </p>
                        <button
                            type="button"
                            onClick={syncTenantParents}
                            disabled={syncTenantParentsForm.processing}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white disabled:opacity-60"
                        >
                            <IconDeviceFloppy size={18} />
                            {syncTenantParentsForm.processing ? "Memproses..." : "Jalankan Sync Parent"}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <IconRefresh size={20} />
                            <h2 className="text-base font-semibold">Sync Stok Terpusat</h2>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Samakan semua row `product_outlet_stocks` tenant ke angka stok pusat produk.
                        </p>
                        <button
                            type="button"
                            onClick={syncStocks}
                            disabled={syncStocksForm.processing}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white disabled:opacity-60"
                        >
                            <IconDatabaseOff size={18} />
                            {syncStocksForm.processing ? "Memproses..." : "Jalankan Sync Stok"}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <IconChefHat size={20} />
                            <h2 className="text-base font-semibold">Auto-map Dapur</h2>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Pasang station dapur pertama milik tenant untuk produk tenant yang masih belum punya mapping aktif.
                        </p>
                        <button
                            type="button"
                            onClick={autoMapKitchen}
                            disabled={autoMapKitchenForm.processing}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white disabled:opacity-60"
                        >
                            <IconChefHat size={18} />
                            {autoMapKitchenForm.processing ? "Memproses..." : "Jalankan Auto-map"}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <IconChecklist size={20} />
                            <h2 className="text-base font-semibold">Rebuild Member Metrics</h2>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Hitung ulang `customer_outlet_metrics` dan agregat loyalty customer pada scope outlet target.
                        </p>
                        <button
                            type="button"
                            onClick={rebuildMemberMetrics}
                            disabled={rebuildMemberMetricsForm.processing}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white disabled:opacity-60"
                        >
                            <IconChecklist size={18} />
                            {rebuildMemberMetricsForm.processing ? "Memproses..." : "Jalankan Rebuild Metrics"}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <IconRotateClockwise2 size={20} />
                            <h2 className="text-base font-semibold">Sync Kategori Tenant</h2>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Luruskan kategori produk tenant agar memakai kategori tenant miliknya sendiri, bukan kategori global atau tenant lain.
                        </p>
                        <button
                            type="button"
                            onClick={syncTenantCategories}
                            disabled={syncTenantCategoriesForm.processing}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-medium text-white disabled:opacity-60"
                        >
                            <IconRotateClockwise2 size={18} />
                            {syncTenantCategoriesForm.processing ? "Memproses..." : "Jalankan Sync Kategori"}
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <IconDatabaseOff size={20} />
                        <h2 className="text-base font-semibold">Audit Orphan Data</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Ringkasan titik data yang masih rawan bikin angka CRM, laporan, atau mapping tenant terlihat salah.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {orphanAudit.map((item) => (
                            <div
                                key={item.label}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {item.label}
                                    </p>
                                    <span className="text-lg font-bold text-primary-600 dark:text-primary-300">
                                        {formatNumber(item.count)}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    {item.helper}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <IconBuildingStore size={20} />
                        <h2 className="text-base font-semibold">Preview Tenant Anak</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Daftar tenant aktif yang saat ini berada di bawah outlet utama target.
                    </p>
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead>
                                <tr className="text-left text-slate-500 dark:text-slate-400">
                                    <th className="py-2 pr-4">Kode</th>
                                    <th className="py-2 pr-4">Nama</th>
                                    <th className="py-2 pr-4">Parent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {tenantsPreview.length > 0 ? (
                                    tenantsPreview.map((tenant) => (
                                        <tr key={tenant.id} className="text-slate-700 dark:text-slate-200">
                                            <td className="py-3 pr-4 font-medium">{tenant.code}</td>
                                            <td className="py-3 pr-4">{tenant.name}</td>
                                            <td className="py-3 pr-4">
                                                {tenant.parent_outlet_id ? `#${tenant.parent_outlet_id}` : "-"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="py-6 text-center text-slate-500 dark:text-slate-400">
                                            Belum ada tenant anak di outlet utama target ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

DataRepair.layout = (page) => <DashboardLayout children={page} />;
