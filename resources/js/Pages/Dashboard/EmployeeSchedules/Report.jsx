import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import FormLabel from "@/Components/Dashboard/FormLabel";
import {
    IconCalendarStats,
    IconFilter,
    IconRotateClockwise2,
} from "@/Utils/icons";

const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtHours = (minutes) => {
    if (!minutes) return "0 jam";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} mnt`;
    return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`;
};

const Metric = ({ label, value, color }) => (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="ml-auto text-sm font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
);

export default function Report(props) {
    const { summary, totals, totalDaysInRange, breakdown, interval, period, jobTypes, employees } = props;

    const [form, setForm] = useState({
        start_date: period.start,
        end_date: period.end,
        interval,
        job_type: "",
        employee_id: "",
    });

    const apply = (e) => {
        e.preventDefault();
        router.get(route("employee-schedules.report"), form, { preserveState: false, replace: true });
    };

    const reset = () => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const clean = { start_date: toDateInput(start), end_date: toDateInput(end), interval: "all", job_type: "", employee_id: "" };
        setForm(clean);
        router.get(route("employee-schedules.report"), clean, { preserveState: false, replace: true });
    };

    const hasData = summary.length > 0;

    return (
        <DashboardLayout>
            <Head title="Laporan Jam Kerja" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Laporan Jam Kerja</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Rekap jam kerja, jumlah masuk, libur, cuti, izin, dan sakit per karyawan dalam rentang tanggal.
                        </p>
                    </div>
                    <Link
                        href={route("employee-schedules.index")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <IconCalendarStats size={18} />
                        Lihat Jadwal
                    </Link>
                </div>

                <form onSubmit={apply} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                        <div>
                            <FormLabel label="Dari Tanggal" />
                            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                        </div>
                        <div>
                            <FormLabel label="Sampai Tanggal" />
                            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                        <div>
                            <FormLabel label="Jabatan" />
                            <select
                                value={form.job_type}
                                onChange={(e) => setForm({ ...form, job_type: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                <option value="">Semua Jabatan</option>
                                {jobTypes.map((j) => (
                                    <option key={j} value={j}>{j}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <FormLabel>Karyawan</FormLabel>
                            <select
                                value={form.employee_id}
                                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                <option value="">Semua Karyawan</option>
                                {employees.map((em) => (
                                    <option key={em.id} value={em.id}>{em.job_type} - {em.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <FormLabel>Interval Rincian</FormLabel>
                            <select
                                value={form.interval}
                                onChange={(e) => setForm({ ...form, interval: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                <option value="all">Keseluruhan</option>
                                <option value="day">Per Hari</option>
                                <option value="weekly">Per Minggu</option>
                                <option value="monthly">Per Bulan</option>
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <Button type="submit" label="Tampilkan" icon={<IconFilter size={16} />} />
                            <Button type="button" label="Reset" onClick={reset} icon={<IconRotateClockwise2 size={16} />} className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" />
                        </div>
                    </div>
                </form>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Metric label="Jam Kerja" value={fmtHours(totals.work_minutes)} color="bg-primary-500" />
                    <Metric label="Hari Masuk" value={totals.working_days} color="bg-success-500" />
                    <Metric label="Libur" value={totals.libur} color="bg-slate-400" />
                    <Metric label="Cuti" value={totals.cuti} color="bg-emerald-500" />
                    <Metric label="Izin" value={totals.izin} color="bg-warning-500" />
                    <Metric label="Sakit" value={totals.sakit} color="bg-danger-500" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Ringkasan per Karyawan
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Periode {period.start} s/d {period.end} · {totalDaysInRange} hari
                        </span>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[820px]">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Karyawan</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Jabatan</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Jam Kerja</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hari Masuk</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Libur</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Cuti</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Izin</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Sakit</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Tanpa Jadwal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {summary.map((em) => (
                                    <tr key={em.id} className="text-sm text-slate-700 dark:text-slate-300">
                                        <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{em.name}</td>
                                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{em.job_type}</td>
                                        <td className="px-3 py-2.5 text-right font-semibold text-primary-700 dark:text-primary-300">{fmtHours(em.work_minutes)}</td>
                                        <td className="px-3 py-2.5 text-right">{em.working_days}</td>
                                        <td className="px-3 py-2.5 text-right">{em.libur}</td>
                                        <td className="px-3 py-2.5 text-right">{em.cuti}</td>
                                        <td className="px-3 py-2.5 text-right">{em.izin}</td>
                                        <td className="px-3 py-2.5 text-right">{em.sakit}</td>
                                        <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">{em.not_scheduled_days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!hasData && (
                            <div className="py-10 text-center text-sm text-slate-400">Tidak ada data untuk periode ini.</div>
                        )}
                    </div>
                </div>

                {interval !== "all" && breakdown.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rincian per Interval</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Rekap per {interval === "day" ? "hari" : interval === "weekly" ? "minggu" : "bulan"} untuk seluruh karyawan terpilih.
                        </p>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[760px]">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Period</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Jam Kerja</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Hari Masuk</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Libur</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Cuti</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Izin</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Sakit</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Tanpa Jadwal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {breakdown.map((b) => (
                                        <tr key={b.period_start} className="text-sm text-slate-700 dark:text-slate-300">
                                            <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{b.label}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-primary-700 dark:text-primary-300">{fmtHours(b.totals.work_minutes)}</td>
                                            <td className="px-3 py-2.5 text-right">{b.totals.working_days}</td>
                                            <td className="px-3 py-2.5 text-right">{b.totals.libur}</td>
                                            <td className="px-3 py-2.5 text-right">{b.totals.cuti}</td>
                                            <td className="px-3 py-2.5 text-right">{b.totals.izin}</td>
                                            <td className="px-3 py-2.5 text-right">{b.totals.sakit}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">{b.totals.not_scheduled_days}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}