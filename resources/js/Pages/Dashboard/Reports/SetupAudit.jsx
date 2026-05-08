import React from "react";
import { Head, Link } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";

function AuditSection({ title, description, count, children, actionHref, actionLabel }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${count > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
                        {count > 0 ? `${count} perlu tindakan` : "Tidak ada gap"}
                    </span>
                    <Link
                        href={actionHref}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        {actionLabel}
                    </Link>
                </div>
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}

function RowList({ items, renderItem, emptyMessage }) {
    if (!items.length) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>;
    }

    return (
        <div className="space-y-3">
            {items.map(renderItem)}
        </div>
    );
}

export default function SetupAudit({
    summary = {},
    outletsWithoutUsers = [],
    outletsWithoutStations = [],
    stationsWithoutDevices = [],
    printersWithoutEndpoint = [],
    productsWithoutTenant = [],
    productsWithoutKitchenMapping = [],
}) {
    return (
        <>
            <Head title="Audit Setup" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Setup</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Halaman ini mengumpulkan seluruh gap setup penting lintas outlet, kitchen, printer, dan produk dalam satu tempat.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                        ["Outlet tanpa user", summary.outlets_without_users ?? 0],
                        ["Outlet tanpa station", summary.outlets_without_stations ?? 0],
                        ["Station tanpa device", summary.stations_without_devices ?? 0],
                        ["Printer tanpa endpoint", summary.printers_without_endpoint ?? 0],
                        ["Produk tanpa tenant", summary.products_without_tenant ?? 0],
                        ["Produk tanpa kitchen mapping", summary.products_without_kitchen_mapping ?? 0],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                        </div>
                    ))}
                </div>

                <AuditSection
                    title="Outlet tanpa user"
                    description="Outlet yang belum memiliki user terhubung akan sulit dikelola dari sisi ownership dan akses."
                    count={outletsWithoutUsers.length}
                    actionHref={route("outlets.index")}
                    actionLabel="Buka Outlet & Tenant"
                >
                    <RowList
                        items={outletsWithoutUsers}
                        emptyMessage="Semua outlet sudah punya user."
                        renderItem={(outlet) => (
                            <div key={outlet.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                {outlet.name} ({outlet.code}) • {outlet.outlet_type}
                            </div>
                        )}
                    />
                </AuditSection>

                <AuditSection
                    title="Outlet tanpa station dapur"
                    description="Outlet yang dipakai operasional tetapi belum punya station kitchen akan kesulitan routing ticket."
                    count={outletsWithoutStations.length}
                    actionHref={route("settings.kitchen-devices.index")}
                    actionLabel="Buka Kitchen Ops"
                >
                    <RowList
                        items={outletsWithoutStations}
                        emptyMessage="Semua outlet sudah punya station."
                        renderItem={(outlet) => (
                            <div key={outlet.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                {outlet.name} ({outlet.code}) • {outlet.outlet_type}
                            </div>
                        )}
                    />
                </AuditSection>

                <AuditSection
                    title="Station tanpa device"
                    description="Station tanpa screen, printer, atau tablet tidak bisa menerima output operasional."
                    count={stationsWithoutDevices.length}
                    actionHref={route("settings.kitchen-devices.index")}
                    actionLabel="Kelola Device"
                >
                    <RowList
                        items={stationsWithoutDevices}
                        emptyMessage="Semua station sudah punya device."
                        renderItem={(station) => (
                            <div key={station.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                {station.name} ({station.code || "-"}) • {station.outlet?.name || "Outlet"}
                            </div>
                        )}
                    />
                </AuditSection>

                <AuditSection
                    title="Printer tanpa endpoint"
                    description="Printer thermal tanpa endpoint biasanya belum siap untuk integrasi driver jaringan atau service pencetakan."
                    count={printersWithoutEndpoint.length}
                    actionHref={route("settings.kitchen-devices.index")}
                    actionLabel="Cek Printer"
                >
                    <RowList
                        items={printersWithoutEndpoint}
                        emptyMessage="Semua printer sudah punya endpoint."
                        renderItem={(device) => (
                            <div key={device.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                {device.name} • {device.kitchenStation?.name || "Station"} • {device.kitchenStation?.outlet?.name || "Outlet"}
                            </div>
                        )}
                    />
                </AuditSection>

                <AuditSection
                    title="Produk tanpa tenant"
                    description="Produk global tidak ideal untuk mode foodcourt bila tenant sudah aktif dan settlement perlu dipisah."
                    count={productsWithoutTenant.length}
                    actionHref={route("products.index", { mapping_status: "tenant_missing" })}
                    actionLabel="Filter Produk Tanpa Tenant"
                >
                    <RowList
                        items={productsWithoutTenant}
                        emptyMessage="Semua produk sudah punya tenant atau tenant foodcourt belum dipakai."
                        renderItem={(product) => (
                            <div key={product.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                {product.title} • {product.category?.name || "Tanpa kategori"} • {product.sku || product.barcode || "-"}
                            </div>
                        )}
                    />
                </AuditSection>

                <AuditSection
                    title="Produk tanpa kitchen mapping"
                    description="Produk yang belum terhubung ke station dapur tidak akan terpecah otomatis ke kitchen queue."
                    count={productsWithoutKitchenMapping.length}
                    actionHref={route("products.index", { mapping_status: "kitchen_missing" })}
                    actionLabel="Filter Produk Tanpa Kitchen"
                >
                    <RowList
                        items={productsWithoutKitchenMapping}
                        emptyMessage="Semua produk sudah punya mapping kitchen."
                        renderItem={(product) => (
                            <div key={product.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                                {product.title} • {product.tenantOutlet?.code || "Global"} • {product.category?.name || "Tanpa kategori"}
                            </div>
                        )}
                    />
                </AuditSection>
            </div>
        </>
    );
}

SetupAudit.layout = (page) => <DashboardLayout children={page} />;
