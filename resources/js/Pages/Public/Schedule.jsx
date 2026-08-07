import { useState } from "react";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconArrowRight,
    IconBrandWhatsapp,
    IconCalendarEvent,
    IconCheck,
    IconClipboardCopy,
    IconUser,
    IconX,
} from "@tabler/icons-react";

const pad = (n) => String(n).padStart(2, "0");
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = toDateKey(new Date());

const shiftColors = {
    pagi: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    tengah: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    malam: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    libur: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    cuti: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    izin: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    sakit: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    empty: "bg-transparent text-slate-400 border-dashed border-slate-200 dark:border-slate-700",
};

const statusLabel = (s) => ({ cuti: "Cuti", izin: "Izin", sakit: "Sakit", libur: "Libur" }[s] || "Libur");

const shiftColor = (shift) => {
    const order = Number(shift?.sort_order ?? 0);
    if (order === 1) return "pagi";
    if (order === 2) return "tengah";
    if (order === 3) return "malam";
    return "tengah";
};

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
            monFull: d.toLocaleDateString("id-ID", { month: "long" }),
            year: d.getFullYear(),
            titleLabel: `${d.toLocaleDateString("id-ID", { weekday: "long" })}, ${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "long" })} ${d.getFullYear()}`,
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
            isToday: toDateKey(d) === todayKey,
        });
    }
    return days;
};

const shiftMap = (shifts) =>
    Object.fromEntries(shifts.map((s) => [String(s.id), s]));

export default function Schedule({ groups, shifts, view, period, storeName, token }) {
    const days = periodDays(period);
    const map = shiftMap(shifts);

    const [showExport, setShowExport] = useState(false);
    const [selected, setSelected] = useState(() => new Set(days.map((d) => d.key)));
    const [copied, setCopied] = useState(false);

    const toggleDay = (key) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const buildAll = (keys) => {
        const order = [...keys].filter((k) => days.some((d) => d.key === k));
        const dayByKey = Object.fromEntries(days.map((d) => [d.key, d]));
        const lines = [];
        lines.push(`📢 *JADWAL KERJA ${String(storeName || "").toUpperCase()}*`);
        lines.push("");

        order.forEach((k) => {
            const d = dayByKey[k];
            if (!d) return;
            lines.push(`📅 ${d.titleLabel}`);
            lines.push("");

            groups.forEach((group) => {
                lines.push(`🗂 *${group.job_type}*`);
                group.employees.forEach((employee) => {
                    const sc = employee.schedules?.[k];
                    if (!sc) return;
                    if (sc.shift_id && sc.name) {
                        const t = sc.start_time && sc.end_time ? ` (${sc.start_time} – ${sc.end_time})` : "";
                        lines.push(`   • ${employee.name} : ${sc.name}${t}`);
                    } else {
                        lines.push(`   • ${employee.name} : ${statusLabel(sc.status || "libur")}`);
                    }
                });
                lines.push("");
            });
        });

        lines.push(`— Dikirim via sistem jadwal ${String(storeName || "").trim()}`.trimEnd());
        return lines.join("\n");
    };

    const text = buildAll([...selected]);

    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        }
    };

    const hrefFor = (v, p) =>
        route("public.schedule.show", {
            token,
            view: v,
            period: p,
        });

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <Head title="Jadwal Kerja" />

            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
                            <IconCalendarEvent size={18} />
                        </span>
                        <div>
                            <h1 className="text-sm font-bold leading-tight">{storeName}</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Jadwal Kerja Karyawan
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSelected(new Set(days.map((d) => d.key)));
                                setShowExport(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <IconBrandWhatsapp size={16} className="text-green-600" />
                            Export WhatsApp
                        </button>
                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                            <Link
                                href={hrefFor("week", period.start)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                                    view === "week"
                                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                            >
                                Minggu
                            </Link>
                            <Link
                                href={hrefFor("month", period.start)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                                    view === "month"
                                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                            >
                                Bulan
                            </Link>
                        </div>
                        <Link
                            href={hrefFor(view, period.prev)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={view === "month" ? "Bulan sebelumnya" : "Minggu sebelumnya"}
                        >
                            <IconArrowLeft size={16} />
                        </Link>
                        <span className="min-w-[9rem] text-center text-sm font-medium">
                            {period.label}
                        </span>
                        <Link
                            href={hrefFor(view, period.next)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={view === "month" ? "Bulan berikutnya" : "Minggu berikutnya"}
                        >
                            <IconArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
                {view === "week" && (
                    <div className="grid grid-cols-7 gap-2">
                        {days.map((d) => (
                            <div key={d.key} className="text-center">
                                <div className="mb-1 flex items-baseline justify-center gap-1">
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                                        d.isToday
                                            ? "bg-primary-500 text-white"
                                            : d.isWeekend
                                                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                    }`} title={d.titleLabel}>
                                        {d.day}
                                    </span>
                                </div>
                                <div className="text-[11px] font-medium capitalize text-slate-600 dark:text-slate-300">
                                    {d.wdLong}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {d.monFull} {d.year}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {groups.map((group) => (
                    <div key={group.job_type} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                            <IconUser size={16} className="text-primary-500" />
                            <h3 className="text-sm font-bold">{group.job_type}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {group.employees.length} karyawan
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" style={{ minWidth: Math.max(720, days.length * (view === "month" ? 130 : 120)) }}>
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                                        <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                            Karyawan
                                        </th>
                                        {days.map((d) => (
                                            <th key={d.key} title={d.titleLabel}
                                                className={`px-2 py-2.5 text-center text-xs font-semibold ${
                                                    d.isToday
                                                        ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                                                        : d.isWeekend
                                                            ? "bg-rose-50/60 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300"
                                                            : "text-slate-500 dark:text-slate-400"
                                                }`}>
                                                <div className="capitalize">{d.wdLong}</div>
                                                <div className={`text-[10px] font-normal ${d.isToday || d.isWeekend ? "opacity-80" : "opacity-70"}`}>
                                                    {d.day} {d.monFull} {d.year}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {group.employees.map((employee) => (
                                        <tr key={employee.id}>
                                            <td className="sticky left-0 z-10 bg-white px-4 py-2 dark:bg-slate-900">
                                                <span className="whitespace-nowrap font-medium">{employee.name}</span>
                                            </td>
                                            {days.map((d) => {
                                                const schedule = employee.schedules?.[d.key];
                                                const hasShift = schedule?.shift_id;
                                                const status = !hasShift && schedule ? (schedule.status || "libur") : null;
                                                const style = hasShift
                                                    ? shiftColors[shiftColor(map[String(schedule.shift_id)])]
                                                    : status
                                                        ? shiftColors[status] || shiftColors.libur
                                                        : shiftColors.empty;
                                                return (
                                                    <td key={d.key} className={`px-2 py-1.5 text-center ${d.isToday ? "bg-primary-50/60 dark:bg-primary-950/20" : ""}`}>
                                                        {schedule?.name ? (
                                                            <span className={`inline-block w-24 rounded-lg border px-2 py-1 leading-tight ${style}`}>
                                                                <span className="block text-xs font-bold">{schedule.name}</span>
                                                                <span className="block text-[10px] opacity-75">
                                                                    {schedule.start_time}–{schedule.end_time}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-block w-16 rounded-lg border px-2 py-1 text-xs font-medium ${style}`}>
                                                                {schedule ? statusLabel(status) : "-"}
                                                            </span>
                                                        )}
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
            </main>

            {showExport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowExport(false)}>
                    <div
                        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <IconBrandWhatsapp size={20} className="text-green-600" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Export Jadwal ke WhatsApp</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExport(false)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Pilih hari yang akan dibagikan
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {days.map((d) => {
                                    const on = selected.has(d.key);
                                    return (
                                        <button
                                            key={d.key}
                                            type="button"
                                            onClick={() => toggleFor(d.key)}
                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                                                on
                                                    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
                                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                            }`}
                                        >
                                            {on && <IconCheck size={14} />}
                                            <span className="capitalize">{d.wd3}</span> {d.day} {d.monFull}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <textarea
                                readOnly
                                value={text}
                                rows={Math.min(16, text.split("\n").length)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={copyText}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                {copied ? <IconCheck size={16} /> : <IconClipboardCopy size={16} />}
                                {copied ? "Tersalin" : "Salin Teks"}
                            </button>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                            >
                                <IconBrandWhatsapp size={16} />
                                Kirim ke WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}