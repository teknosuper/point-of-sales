import React from "react";
import { Head, Link } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { IconChecklist, IconCircleCheck, IconPlayerPlay, IconBooks } from "@/Utils/icons";

export default function SetupWizard({
    steps = [],
    summary = {},
    mainOutlets = [],
    tenantOutlets = [],
}) {
    return (
        <>
            <Head title="Wizard Setup Outlet & Dapur" />

            <div className="space-y-6">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                        <IconChecklist size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Wizard Setup Outlet & Dapur
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Jalankan langkah awal satu per satu sampai outlet, tenant, dapur, perangkat, dan transaksi pertama siap dipakai.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Progres: {summary.completed ?? 0} / {summary.total ?? 0} selesai
                    </div>
                    <Link
                        href={route("guides.outlet-kitchen")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        <IconBooks size={16} />
                        Baca Panduan Lengkap
                    </Link>
                </div>

                <div className="grid gap-4">
                    {steps.map((step, index) => (
                        <div
                            key={step.key}
                            className={`rounded-2xl border p-5 ${
                                step.done
                                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                            }`}
                        >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                            step.done
                                                ? "bg-emerald-500 text-white"
                                                : "bg-primary-500 text-white"
                                        }`}
                                    >
                                        {step.done ? <IconCircleCheck size={18} /> : index + 1}
                                    </div>
                                    <div>
                                        <p className="text-base font-semibold text-slate-900 dark:text-white">
                                            {step.title}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            step.done
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                        }`}
                                    >
                                        {step.done ? "Selesai" : "Belum"}
                                    </span>
                                    <Link
                                        href={step.href}
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-sm font-medium text-white"
                                    >
                                        <IconPlayerPlay size={16} />
                                        {step.action_label}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Main Outlet Tersedia
                        </h2>
                        <div className="mt-4 space-y-3">
                            {mainOutlets.length ? (
                                mainOutlets.map((outlet) => (
                                    <div
                                        key={outlet.id}
                                        className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200"
                                    >
                                        {outlet.name} ({outlet.code})
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada main outlet.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Tenant Tersedia
                        </h2>
                        <div className="mt-4 space-y-3">
                            {tenantOutlets.length ? (
                                tenantOutlets.map((outlet) => (
                                    <div
                                        key={outlet.id}
                                        className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200"
                                    >
                                        {outlet.name} ({outlet.code})
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Belum ada tenant foodcourt.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

SetupWizard.layout = (page) => <DashboardLayout children={page} />;
