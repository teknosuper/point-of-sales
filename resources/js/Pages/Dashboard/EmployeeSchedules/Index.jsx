import React, { useMemo, useState } from "react";
import Swal from "sweetalert2";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, useForm } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Modal from "@/Components/Dashboard/Modal";
import Input from "@/Components/Dashboard/Input";
import FormLabel from "@/Components/Dashboard/FormLabel";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconArrowLeft,
    IconArrowRight,
    IconCalendarStats,
    IconChartBar,
    IconCheck,
    IconCopy,
    IconExternalLink,
    IconLayoutGrid,
    IconPencil,
    IconPlus,
    IconRefresh,
    IconTrash,
    IconUsers,
} from "@/Utils/icons";

const pad = (n) => String(n).padStart(2, "0");
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = toDateKey(new Date());

const periodDays = (period) => {
    const start = new Date(`${period.start}T00:00:00`);
    const end = new Date(`${period.end}T00:00:00`);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push({
            key: toDateKey(d),
            day: d.getDate(),
            wd3: d.toLocaleDateString("id-ID", { weekday: "short" }),
            wdLong: d.toLocaleDateString("id-ID", { weekday: "long" }),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
            isToday: toDateKey(d) === todayKey,
        });
    }
    return days;
};
const shiftColors = {
    pagi: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    tengah: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    malam: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    libur: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    empty: "bg-transparent text-slate-400 border-dashed border-slate-200 dark:border-slate-700",
};

const statusColors = {
    libur: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    cuti: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    izin: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    sakit: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

const shiftColor = (shift) => {
    const order = Number(shift?.sort_order ?? 0);
    if (order === 1) return "pagi";
    if (order === 2) return "tengah";
    if (order === 3) return "malam";
    return "tengah";
};

const emptyGenerate = { start_date: "", end_date: "", job_type: "", overwrite: false };
const emptyShift = { name: "", start_time: "09:00", end_time: "17:00", sort_order: 0, is_active: true };

const WEEKDAYS = [
    { value: 1, label: "Senin" },
    { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" },
    { value: 4, label: "Kamis" },
    { value: 5, label: "Jumat" },
    { value: 6, label: "Sabtu" },
    { value: 7, label: "Minggu" },
];

export default function Index({ groups = [], shifts = [], jobTypes = [], view = "week", period = {}, share = null, config = {} }) {
    const { can } = useAuthorization();
    const canGenerate = can("employee-schedules-generate");
    const canManageShift = can("employees-update");
    const canShare = can("employee-schedules-access");

    const days = useMemo(() => (period?.start && period?.end ? periodDays(period) : []), [period]);
    const shiftMap = useMemo(
        () => Object.fromEntries(shifts.map((shift) => [String(shift.id), shift])),
        [shifts]
    );

    const [showGenerate, setShowGenerate] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [showShare, setShowShare] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [copied, setCopied] = useState(false);
    const [configForm, setConfigForm] = useState(() => ({
        day_off_per_week: config?.day_off_per_week ?? 1,
        blocked_weekdays: config?.blocked_weekdays?.length ? config.blocked_weekdays : [5, 6, 7],
    }));

    const submitConfig = (e) => {
        e.preventDefault();
        router.post(
            route("employee-schedules.config"),
            {
                day_off_per_week: configForm.day_off_per_week,
                blocked_weekdays: configForm.blocked_weekdays,
            },
            { preserveScroll: true, onSuccess: () => setShowConfig(false) }
        );
    };

    const toggleBlockedDay = (value) => {
        setConfigForm((prev) => {
            const exists = prev.blocked_weekdays.includes(value);
            return {
                ...prev,
                blocked_weekdays: exists
                    ? prev.blocked_weekdays.filter((d) => d !== value)
                    : [...prev.blocked_weekdays, value],
            };
        });
    };

    const toggleShared = (enabled) => {
        router.post(
            route("employee-schedules.share"),
            { enabled },
            { preserveScroll: true, onSuccess: () => setShowShare(true) }
        );
    };

    const copyLink = async () => {
        if (!share?.url) return;
        try {
            await navigator.clipboard.writeText(share.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard tidak tersedia */
        }
    };

    const deleteShift = (shift) => {
        Swal.fire({
            title: "Hapus Shift?",
            text: `Shift "${shift.name}" akan dihapus permanen.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus!",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route("employee-shifts.destroy", shift.id), { preserveScroll: true });
            }
        });
    };

    const generateForm = useForm({
        ...emptyGenerate,
        start_date: period?.start || "",
        end_date: period?.end || "",
    });
    const shiftForm = useForm(emptyShift);

    const openCreateShift = () => {
        setEditingShift(null);
        shiftForm.reset();
        shiftForm.clearErrors();
        setShowShiftModal(true);
    };

    const openEditShift = (shift) => {
        setEditingShift(shift);
        shiftForm.setData({
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            sort_order: shift.sort_order,
            is_active: shift.is_active,
        });
        shiftForm.clearErrors();
        setShowShiftModal(true);
    };

    const submitShift = (e) => {
        e.preventDefault();
        if (editingShift) {
            shiftForm.put(route("employee-shifts.update", editingShift.id), {
                preserveScroll: true,
                onSuccess: () => setShowShiftModal(false),
            });
            return;
        }
        shiftForm.post(route("employee-shifts.store"), {
            preserveScroll: true,
            onSuccess: () => setShowShiftModal(false),
        });
    };

    const submitGenerate = (e) => {
        e.preventDefault();
        generateForm.post(route("employee-schedules.generate"), {
            preserveScroll: true,
            onSuccess: () => setShowGenerate(false),
        });
    };

    const navigatePeriod = (nextStart) => {
        router.get(
            route("employee-schedules.index"),
            { view, period: nextStart },
            { preserveState: true }
        );
    };

    const switchView = (nextView) => {
        router.get(route("employee-schedules.index"), { view: nextView, period: period?.start }, {
            preserveState: true,
        });
    };

    const setCell = (employee, dateKey, value) => {
        const schedule = employee.schedules?.[dateKey];

        if (value === "") {
            if (schedule?.id) {
                router.delete(route("employee-schedules.destroy", schedule.id), { preserveScroll: true });
            }
            return;
        }

        const nonWorking = ["libur", "cuti", "izin", "sakit"];

        router.post(
            route("employee-schedules.set"),
            {
                schedule_date: dateKey,
                employee_id: employee.id,
                status: nonWorking.includes(value) ? value : "masuk",
                shift_id: nonWorking.includes(value) ? null : Number(value),
            },
            { preserveScroll: true }
        );
    };

    const currentValue = (schedule) => {
        if (!schedule) return "";
        if (schedule.shift_id) return String(schedule.shift_id);
        return schedule.status && schedule.status !== "masuk" ? schedule.status : "libur";
    };

    return (
        <DashboardLayout>
            <Head title="Jadwal Kerja" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Jadwal Kerja Karyawan
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Lihat dan generate penjadwalan shift karyawan per minggu.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("employees.index")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconUsers size={18} />
                            Karyawan
                        </Link>

                        <Link
                            href={route("employee-schedules.report")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconChartBar size={18} />
                            Laporan
                        </Link>

                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                                <button
                                    type="button"
                                    onClick={() => switchView("week")}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                        view === "week"
                                            ? "bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    }`}
                                >
                                    Minggu
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchView("month")}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                        view === "month"
                                            ? "bg-white text-primary-700 shadow-sm dark:bg-slate-900 dark:text-primary-300"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    }`}
                                >
                                    Bulan
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigatePeriod(period.prev)}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                title={view === "month" ? "Bulan sebelumnya" : "Minggu sebelumnya"}
                            >
                                <IconArrowLeft size={16} />
                            </button>
                            <span className="min-w-[9rem] text-center text-sm font-medium text-slate-700 dark:text-slate-200">
                                {period.label}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigatePeriod(period.next)}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                title={view === "month" ? "Bulan berikutnya" : "Minggu berikutnya"}
                            >
                                <IconArrowRight size={16} />
                            </button>
                        </div>

                        {canGenerate && (
                            <Button
                                type="button"
                                icon={<IconCalendarStats size={18} strokeWidth={1.5} />}
                                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                label="Atur Libur"
                                onClick={() => setShowConfig(true)}
                            />
                        )}

                        {canGenerate && (
                            <Button
                                type="button"
                                icon={<IconRefresh size={18} strokeWidth={1.5} />}
                                className="bg-primary-500 text-white shadow-lg shadow-primary-500/30 hover:bg-primary-600"
                                label="Generate Jadwal"
                                onClick={() => setShowGenerate(true)}
                            />
                        )}

                        {canShare && (
                            <Button
                                type="button"
                                icon={<IconExternalLink size={18} strokeWidth={1.5} />}
                                className={`border px-4 py-2.5 text-sm font-medium ${
                                    share?.is_active
                                        ? "border-success-300 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300"
                                        : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                }`}
                                label={share?.is_active ? "Tautan Aktif" : "Bagikan Jadwal"}
                                onClick={() => setShowShare(true)}
                            />
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Legenda:</span>
                    {shifts.map((shift) => (
                        <span key={shift.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${shiftColors[shiftColor(shift)]}`}>
                            {shift.name}
                        </span>
                    ))}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${shiftColors.libur}`}>
                        Libur
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${statusColors.cuti}`}>
                        Cuti
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${statusColors.izin}`}>
                        Izin
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${statusColors.sakit}`}>
                        Sakit
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                        Hari ini
                    </span>
                </div>

                {canManageShift && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Daftar Shift:
                            </span>
                            {shifts.map((shift) => (
                                <div
                                    key={shift.id}
                                    className="inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-xs font-medium"
                                    style={{ background: "transparent" }}
                                >
                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${shiftColors[shiftColor(shift)]}`}>
                                        <span className="font-semibold">{shift.name}</span>
                                        <span className="ml-2 opacity-70">
                                            {shift.start_time}-{shift.end_time}
                                        </span>
                                        {!shift.is_active && <span className="ml-1 opacity-60">(off)</span>}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => openEditShift(shift)}
                                        title="Edit shift"
                                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
                                    >
                                        <IconPencil size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteShift(shift)}
                                        title="Hapus shift"
                                        className="rounded-full p-1 text-slate-400 transition hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-950/40"
                                    >
                                        <IconTrash size={14} />
                                    </button>
                                </div>
                            ))}
                            {shifts.length === 0 && (
                                <span className="text-sm text-slate-400 dark:text-slate-500">
                                    Belum ada shift.
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={openCreateShift}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300"
                        >
                            <IconPlus size={16} />
                            Tambah Shift
                        </button>
                    </div>
                )}

                {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
                        <IconUsers size={48} className="text-slate-300 dark:text-slate-600" />
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                Belum ada karyawan aktif.
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Tambahkan karyawan dulu di halaman Karyawan, lalu generate jadwal.
                            </p>
                        </div>
                        <Link
                            href={route("employees.index")}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                        >
                            <IconUsers size={18} />
                            Buka Halaman Karyawan
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {view === "week" && (
                            <div className="grid grid-cols-7 gap-2 px-2">
                                {days.map((d) => (
                                    <div key={d.key} className="text-center">
                                        <div
                                            className={`mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                                                d.isToday
                                                    ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                                                    : d.isWeekend
                                                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                            }`}
                                            title={d.wdLong}
                                        >
                                            {d.day}
                                        </div>
                                        <div className="text-[11px] font-medium capitalize tracking-wide text-slate-500 dark:text-slate-400">
                                            {d.wdLong}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {groups.map((group) => (
                            <div key={group.job_type} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                                    <IconLayoutGrid size={16} className="text-primary-500" />
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        {group.job_type}
                                    </h3>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        {group.employees.length} karyawan
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table
                                        className="w-full text-sm"
                                        style={{ minWidth: Math.max(720, days.length * (view === "month" ? 76 : 96)) }}
                                    >
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                                                <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                    Karyawan
                                                </th>
                                                {days.map((d) => (
                                                    <th
                                                        key={d.key}
                                                        title={d.wdLong}
                                                        className={`px-2 py-2.5 text-center text-xs font-semibold ${
                                                            d.isToday
                                                                ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                                                                : d.isWeekend
                                                                    ? "bg-rose-50/60 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300"
                                                                    : "text-slate-500 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        {d.wd3} {d.day}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {group.employees.map((employee) => (
                                                <tr key={employee.id}>
                                                    <td className="sticky left-0 z-10 bg-white px-4 py-2 dark:bg-slate-900">
                                                        <p className="whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">
                                                            {employee.name}
                                                        </p>
                                                    </td>
                                                    {days.map((d) => {
                                                        const schedule = employee.schedules?.[d.key];
                                                        const value = currentValue(schedule);
                                                        const shift = schedule?.shift_id
                                                            ? shiftMap[String(schedule.shift_id)]
                                                            : null;
                                                        const statusValue = !shift && statusColors[value] ? value : null;
                                                        const style = shift
                                                            ? shiftColors[shiftColor(shift)]
                                                            : statusValue
                                                            ? statusColors[statusValue]
                                                            : value === "libur"
                                                            ? shiftColors.libur
                                                            : shiftColors.empty;
                                                        return (
                                                            <td
                                                                key={d.key}
                                                                className={`px-2 py-1.5 text-center ${
                                                                    d.isToday ? "bg-primary-50/60 dark:bg-primary-950/20" : ""
                                                                }`}
                                                            >
                                                                <select
                                                                    value={value}
                                                                    disabled={!canGenerate}
                                                                    onChange={(e) => setCell(employee, d.key, e.target.value)}
                                                                    className={`w-full cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${style}`}
                                                                >
                                                                    <option value="">-</option>
                                                                    {shifts.map((shift) => (
                                                                        <option key={shift.id} value={String(shift.id)}>
                                                                            {shift.name}
                                                                        </option>
                                                                    ))}
                                                                    <option value="cuti">Cuti</option>
                                                                    <option value="izin">Izin</option>
                                                                    <option value="sakit">Sakit</option>
                                                                    <option value="libur">Libur</option>
                                                                </select>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                show={showGenerate}
                onClose={() => setShowGenerate(false)}
                title="Generate Jadwal"
                maxWidth="lg"
            >
                <form onSubmit={submitGenerate} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Dari Tanggal"
                            type="date"
                            required
                            value={generateForm.data.start_date}
                            onChange={(e) => generateForm.setData("start_date", e.target.value)}
                            errors={generateForm.errors.start_date}
                        />
                        <Input
                            label="Sampai Tanggal"
                            type="date"
                            required
                            value={generateForm.data.end_date}
                            onChange={(e) => generateForm.setData("end_date", e.target.value)}
                            errors={generateForm.errors.end_date}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <FormLabel label="Jenis Pekerjaan" />
                        <select
                            value={generateForm.data.job_type}
                            onChange={(e) => generateForm.setData("job_type", e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="">Semua jenis pekerjaan</option>
                            {jobTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                        <p>
                            Jadwal otomatis dibuat dengan rotasi adil: satu karyawan per shift, dan
                            sisa karyawan mendapat <strong>libur</strong>. Hari yang sudah punya jadwal
                            tidak akan ditimpa agar tidak mengubah jadwal manual.
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={Boolean(generateForm.data.overwrite)}
                            onChange={(e) => generateForm.setData("overwrite", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                        />
                        Timpa jadwal yang sudah ada di rentang tanggal ini
                    </label>

                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setShowGenerate(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={generateForm.processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
                        >
                            {generateForm.processing ? "Membuat..." : "Generate"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                show={showShiftModal}
                onClose={() => setShowShiftModal(false)}
                title={editingShift ? "Edit Shift" : "Tambah Shift"}
                maxWidth="md"
            >
                <form onSubmit={submitShift} className="space-y-4">
                    <Input
                        label="Nama Shift"
                        type="text"
                        required
                        value={shiftForm.data.name}
                        onChange={(e) => shiftForm.setData("name", e.target.value)}
                        errors={shiftForm.errors.name}
                        placeholder="Contoh: Pagi"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Jam Mulai"
                            type="time"
                            required
                            value={shiftForm.data.start_time}
                            onChange={(e) => shiftForm.setData("start_time", e.target.value)}
                            errors={shiftForm.errors.start_time}
                        />
                        <Input
                            label="Jam Selesai"
                            type="time"
                            required
                            value={shiftForm.data.end_time}
                            onChange={(e) => shiftForm.setData("end_time", e.target.value)}
                            errors={shiftForm.errors.end_time}
                        />
                    </div>
                    <Input
                        label="Urutan"
                        type="number"
                        min={0}
                        value={shiftForm.data.sort_order}
                        onChange={(e) => shiftForm.setData("sort_order", e.target.value)}
                        errors={shiftForm.errors.sort_order}
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={Boolean(shiftForm.data.is_active)}
                            onChange={(e) => shiftForm.setData("is_active", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                        />
                        Shift aktif (ikut dipakai saat generate)
                    </label>

                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setShowShiftModal(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={shiftForm.processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
                        >
                            {shiftForm.processing ? "Menyimpan..." : "Simpan"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                show={showShare}
                onClose={() => setShowShare(false)}
                title="Bagikan Jadwal ke Publik"
                subtitle="Bagikan tautan jadwal tanpa perlu login. Siapa pun yang membuka tautan ini bisa melihat jadwal shift."
            >
                {share?.is_active ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm text-success-700 dark:bg-success-950/40 dark:text-success-300">
                            <IconCheck size={18} />
                            Tautan publik aktif.
                        </div>

                        <div>
                            <FormLabel>Tautan Jadwal</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    readOnly
                                    value={share.url}
                                    onFocus={(e) => e.target.select()}
                                    className="flex-1 font-mono text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={copyLink}
                                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                    {copied ? "Tersalin" : "Salin"}
                                </button>
                                <a
                                    href={share.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <IconExternalLink size={16} />
                                    Buka
                                </a>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                label="Matikan Tautan"
                                className="border border-danger-200 bg-white text-danger-600 hover:bg-danger-50 dark:border-danger-800 dark:bg-slate-900 dark:text-danger-300"
                                onClick={() => toggleBus(false)}
                            />
                            <Button
                                type="button"
                                label="Tutup"
                                className="bg-slate-100 text-slate-600 hover:bg-slate-200"
                                onClick={() => setShowShare(false)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            {share
                                ? "Tautan publik saat ini nonaktif. Aktifkan untuk membagikan jadwal."
                                : "Jadwal belum dibagikan ke publik. Aktifkan untuk membuat tautan baru."}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                label="Batal"
                                className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                onClick={() => setShowShare(false)}
                            />
                            <Button
                                type="button"
                                label="Aktifkan Tautan"
                                className="bg-primary-500 text-white hover:bg-primary-600"
                                onClick={() => toggleBus(true)}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                show={showConfig}
                onClose={() => setShowConfig(false)}
                title="Atur Peraturan Libur"
                subtitle="Jatah libur per pekan dan hari yang melarang libur untuk generate jadwal otomatis."
            >
                <form onSubmit={submitConfig} className="space-y-4">
                    <div>
                        <FormLabel>Jatah libur per karyawan (per pekan)</FormLabel>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min="0"
                                max="7"
                                value={configForm.day_off_per_week}
                                onChange={(e) =>
                                    setConfigForm((prev) => ({
                                        ...prev,
                                        day_off_per_week: Math.max(0, Math.min(7, Number(e.target.value))),
                                    }))
                                }
                                className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900"
                            />
                            <span className="text-sm text-slate-500 dark:text-slate-400">hari libur setiap karyawan</span>
                        </div>
                    </div>

                    <div>
                        <FormLabel>Hari yang melarang libur</FormLabel>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Karyawan tidak dijadwalkan libur pada hari berikut.
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {WEEKDAYS.map((day) => {
                                const blocked = configForm.blocked_weekdays.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleBlockedDay(day.value)}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                            blocked
                                                ? "border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-300"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        }`}
                                    >
                                        {blocked && <IconCheck size={16} />}
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setShowConfig(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600"
                        >
                            Simpan Peraturan
                        </button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}