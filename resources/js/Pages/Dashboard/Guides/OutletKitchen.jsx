import React from "react";
import { Head, Link, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconBooks,
    IconBuildingStore,
    IconChecklist,
    IconToolsKitchen2,
} from "@/Utils/icons";

function ActionCard({ href, title, description, icon: Icon }) {
    return (
        <Link
            href={href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-800"
        >
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                    <Icon size={20} />
                </div>
                <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>
            </div>
        </Link>
    );
}

export default function OutletKitchen() {
    const { activeOutlet, auth } = usePage().props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const isTenantOutlet = activeOutlet?.outlet_type === "tenant";

    const modeLabel = isKitchenWorkspace
        ? "Dapur"
        : isTenantOutlet
          ? "Tenant"
          : "Owner / Outlet";

    const introText = isKitchenWorkspace
        ? "Halaman ini membantu tim dapur tahu harus buka menu yang mana untuk station, device, dan antrian pesanan."
        : isTenantOutlet
          ? "Halaman ini membantu tenant fokus ke produk miliknya, stok harian, target, dan bila perlu operasional dapur."
          : "Halaman ini membantu owner tahu urutan kerja paling sederhana: buat outlet, atur produk, lalu siapkan dapur.";

    const steps = isKitchenWorkspace
        ? [
              "Cek station dan device dapur.",
              "Pastikan produk sudah masuk ke station yang benar.",
              "Pantau ticket di kitchen queue.",
          ]
        : isTenantOutlet
          ? [
                "Cek produk tenant yang aktif.",
                "Update stok harian bila perlu.",
                "Pantau target dan settlement tenant.",
            ]
          : [
                "Atur outlet dan tenant dulu.",
                "Pastikan produk sudah dipetakan dengan benar.",
                "Siapkan station dapur dan printer bila dipakai.",
            ];

    const actions = isKitchenWorkspace
        ? [
              {
                  title: "Operasional Dapur",
                  description: "Untuk station, printer, dan device dapur.",
                  href: route("settings.kitchen-devices.index"),
                  icon: IconToolsKitchen2,
              },
              {
                  title: "Produk",
                  description: "Untuk cek produk yang masuk ke station Anda.",
                  href: route("products.index"),
                  icon: IconBuildingStore,
              },
              {
                  title: "Kitchen Queue",
                  description: "Untuk melihat dan menyelesaikan ticket dapur.",
                  href: route("kitchen.index"),
                  icon: IconChecklist,
              },
          ]
        : isTenantOutlet
          ? [
              {
                  title: "Produk Tenant",
                  description: "Untuk melihat produk tenant dan stok hariannya.",
                  href: route("products.index"),
                  icon: IconBuildingStore,
              },
              {
                  title: "Target Tenant",
                  description: "Untuk mengatur target penjualan tenant.",
                  href: route("settings.target"),
                  icon: IconChecklist,
              },
              {
                  title: "Operasional Dapur",
                  description: "Buka ini jika tenant punya station dapur sendiri.",
                  href: route("settings.kitchen-devices.index"),
                  icon: IconToolsKitchen2,
              },
          ]
        : [
              {
                  title: "Outlet & Tenant",
                  description: "Mulai dari sini untuk menata struktur bisnis.",
                  href: route("outlets.index"),
                  icon: IconBuildingStore,
              },
              {
                  title: "Produk",
                  description: "Untuk mapping produk ke tenant dan dapur.",
                  href: route("products.index"),
                  icon: IconChecklist,
              },
              {
                  title: "Operasional Dapur",
                  description: "Untuk station dapur, printer, dan device.",
                  href: route("settings.kitchen-devices.index"),
                  icon: IconToolsKitchen2,
              },
          ];

    return (
        <>
            <Head title="Panduan Outlet, Tenant & Dapur" />

            <div className="space-y-6">
                {/* Aplikasi GTC Printer Thermal */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <IconToolsKitchen2 size={20} />
                        </div>
                        <div className="w-full space-y-3 text-sm text-emerald-900 dark:text-emerald-100">
                            <div>
                                <p className="font-semibold">📱 Aplikasi GTC Printer Thermal</p>
                                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                                    Download dan install aplikasi Android <strong>GTC Printer</strong> untuk menghubungkan printer thermal Bluetooth/USB ke dapur atau kasir.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <a
                                    href="/media/printer/gtcprinter.apk"
                                    download
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                                >
                                    <IconToolsKitchen2 size={16} />
                                    Download APK (~6.2 MB)
                                </a>
                                <span className="text-xs text-emerald-600 dark:text-emerald-300">
                                    Support ESC/POS 58mm & 80mm • Bluetooth / USB OTG
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                            <IconBooks size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Panduan Singkat
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {introText}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Mode Saat Ini
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {modeLabel}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {activeOutlet?.name || "Belum ada outlet aktif"}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Lakukan Ini Dulu
                    </h2>
                    <div className="mt-4 grid gap-3">
                        {steps.map((step, index) => (
                            <div
                                key={step}
                                className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60"
                            >
                                <div className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white">
                                    {index + 1}
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200">
                                    {step}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {actions.map((item) => (
                        <ActionCard
                            key={item.title}
                            href={item.href}
                            title={item.title}
                            description={item.description}
                            icon={item.icon}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}

OutletKitchen.layout = (page) => <DashboardLayout children={page} />;
