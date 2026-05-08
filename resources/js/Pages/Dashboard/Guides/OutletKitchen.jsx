import React from "react";
import { Head, Link } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { IconBooks, IconBuildingStore, IconClipboardCheck, IconChartBar } from "@tabler/icons-react";

const sections = [
    {
        title: "Kapan pakai Outlet & Tenant",
        icon: <IconBuildingStore size={20} className="text-primary-500" />,
        points: [
            "Saat membuat outlet utama, tenant foodcourt, atau warehouse.",
            "Saat assign user ke outlet, memilih outlet default, dan mengatur komisi tenant.",
            "Saat ingin melihat ownership dan performa satu outlet atau tenant.",
        ],
    },
    {
        title: "Kapan pakai Kitchen Ops & Printer",
        icon: <IconClipboardCheck size={20} className="text-primary-500" />,
        points: [
            "Saat membuat station dapur seperti minuman, ayam, salad, atau grill.",
            "Saat menghubungkan station ke layar kitchen, printer thermal, atau tablet.",
            "Saat mengatur driver, endpoint, paper width, template print, dan health check device.",
        ],
    },
    {
        title: "Kapan pakai Statistik Outlet & Tenant",
        icon: <IconChartBar size={20} className="text-primary-500" />,
        points: [
            "Saat ingin melihat angka transaksi, revenue, payout tenant, dan performa outlet.",
            "Saat ingin fokus ke satu outlet atau tenant lewat filter outlet.",
            "Saat ingin lompat ke detail outlet atau kitchen ops dari konteks angka bisnis.",
        ],
    },
];

const setupSteps = [
    "Buat outlet utama lebih dulu di menu Outlet & Tenant.",
    "Jika model bisnis foodcourt, buat tenant-tenant sebagai outlet bertipe tenant.",
    "Assign user yang boleh mengelola outlet tersebut.",
    "Masuk ke Kitchen Ops & Printer lalu buat station dapur untuk outlet yang dipilih.",
    "Tambahkan device screen atau printer untuk tiap station.",
    "Atur produk agar tenant outlet dan kitchen station-nya sesuai.",
    "Uji transaksi dari POS, lalu cek Kitchen Queue dan Settlement Tenant.",
];

const useCases = [
    {
        title: "Toko biasa dengan banyak dapur",
        body: "Gunakan satu main outlet, lalu buat banyak kitchen station di dalam outlet itu. Contoh: minuman, ayam, salad.",
    },
    {
        title: "Foodcourt 1 kasir, banyak tenant",
        body: "Buat satu outlet utama untuk kasir, lalu buat tenant-tenant foodcourt sebagai outlet tipe tenant. Pendapatan tenant dipisah lewat tenant allocation.",
    },
    {
        title: "Gudang / lokasi support",
        body: "Gunakan outlet tipe warehouse bila lokasi itu dipakai untuk stok atau support, bukan untuk penjualan tenant langsung.",
    },
];

export default function OutletKitchen({ outletTypes = [], outlets = [] }) {
    return (
        <>
            <Head title="Panduan Outlet, Tenant & Kitchen" />

            <div className="space-y-6">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                        <IconBooks size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Panduan Outlet, Tenant & Kitchen
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Panduan operasional untuk membedakan struktur bisnis, operasional dapur, dan statistik agar admin tidak bingung.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {sections.map((section) => (
                        <div
                            key={section.title}
                            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="mb-3 flex items-center gap-2">
                                {section.icon}
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {section.title}
                                </h2>
                            </div>
                            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                {section.points.map((point) => (
                                    <p key={point}>• {point}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Urutan Setup yang Disarankan
                    </h2>
                    <div className="mt-4 grid gap-3">
                        {setupSteps.map((step, index) => (
                            <div
                                key={step}
                                className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200"
                            >
                                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white">
                                    {index + 1}
                                </span>
                                {step}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Arti Tipe Outlet
                        </h2>
                        <div className="mt-4 space-y-3">
                            {outletTypes.map((type) => (
                                <div
                                    key={type.value}
                                    className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                                >
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {type.label}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        {type.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Contoh Penggunaan
                        </h2>
                        <div className="mt-4 space-y-3">
                            {useCases.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                                >
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {item.title}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        {item.body}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Quick Links
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={route("guides.setup-wizard")}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Buka Wizard Setup
                        </Link>
                        <Link
                            href={route("outlets.index")}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Buka Outlet & Tenant
                        </Link>
                        <Link
                            href={route("settings.kitchen-devices.index")}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Buka Kitchen Ops & Printer
                        </Link>
                        <Link
                            href={route("reports.outlet-analytics.index")}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Buka Statistik Outlet & Tenant
                        </Link>
                    </div>
                    {outlets.length ? (
                        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
                            Outlet yang sudah terdaftar:{" "}
                            <span className="font-semibold">
                                {outlets.map((outlet) => `${outlet.name} (${outlet.code})`).join(", ")}
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );
}

OutletKitchen.layout = (page) => <DashboardLayout children={page} />;
