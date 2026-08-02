// Modal Operasional Dapur (form edit station + device langsung di modal).
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
    IconCheck,
    IconClock,
    IconDevices,
    IconEdit,
    IconExternalLink,
    IconLoader2,
    IconPlus,
    IconPrinter,
    IconX,
} from "@/Utils/icons";

const inputClass = (hasError = false) =>
    `h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition focus:ring-2 ${
        hasError
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20 dark:border-rose-700"
            : "border-slate-200 focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-700"
    } dark:bg-slate-950 dark:text-slate-100`;

const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

const DEVICE_TYPES = [
    ["screen", "Layar Dapur"],
    ["printer", "Printer"],
    ["receipt_printer", "Printer Kasir"],
    ["tablet", "Tablet"],
];

const deviceTypeLabel = (type) => {
    const found = DEVICE_TYPES.find(([value]) => value === type);
    return found ? found[1] : type || "Device";
};

/**
 * Mask input waktu ke format 24 jam (HH:MM) tanpa AM/PM.
 * - Hanya menerima digit.
 * - Otomatis menyisipkan titik dua setelah 2 digit.
 * - Membatasi jam 00-23 dan menit 00-59 saat disisipkan.
 */
const maskTimeInput = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);

    let hour = digits.slice(0, 2);
    let minute = digits.slice(2, 4);

    // Batasi angka pertama jam (0-2)
    if (hour.length === 1 && Number(hour) > 2) {
        hour = "";
    }

    // Cegah jam > 23 saat digit pertama 2
    if (hour.length === 2 && Number(hour) > 23) {
        hour = hour[0] === "2" ? "2" : hour.slice(0, 1);
    }

    if (minute.length === 2 && Number(minute) > 59) {
        minute = minute[0] === "0" || minute[0] === "1" || minute[0] === "2" || minute[0] === "3" || minute[0] === "4" || minute[0] === "5"
            ? minute
            : minute.slice(0, 1);
    }

    if (!hour) {
        return "";
    }

    return minute ? `${hour}:${minute}` : hour;
};

/**
 * Normalisasi nilai waktu saat blur: pastikan format HH:MM lengkap.
 */
const normalizeTimeInput = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 4).padEnd(4, "0");
    const hour = Math.min(23, Number(digits.slice(0, 2)) || 0);
    const minute = Math.min(59, Number(digits.slice(2, 4)) || 0);

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export default function OutletKitchenModal({ outlet, onClose, onOpenFullPage }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Edit states
    const [editingStationId, setEditingStationId] = useState(null);
    const [stationForm, setStationForm] = useState({ name: "", code: "", processing_mode: "auto", is_active: true });
    const [addingDeviceStationId, setAddingDeviceStationId] = useState(null);
    const [editingDeviceId, setEditingDeviceId] = useState(null);
    const [deviceForm, setDeviceForm] = useState({
        name: "",
        device_type: "printer",
        connection_driver: "browser",
        paper_width: "80mm",
        dispatch_mode: "auto",
        is_active: true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [togglingDeviceId, setTogglingDeviceId] = useState(null);
    const [operational, setOperational] = useState({
        outlet_is_active: true,
        is_open: true,
        open_time: "08:00",
        close_time: "22:00",
        notes: "",
    });
    const [isSavingOperational, setIsSavingOperational] = useState(false);

    const loadData = useCallback(async () => {
        if (!outlet) return;

        setIsLoading(true);
        try {
            const response = await axios.get(
                route("settings.kitchen-devices.summary", outlet.id)
            );
            const payload = response.data?.data || null;
            setData(payload);
            if (payload?.operational) {
                setOperational({
                    outlet_is_active:
                        payload.operational.outlet_is_active !== false,
                    is_open: payload.operational.is_open !== false,
                    open_time: payload.operational.open_time || "08:00",
                    close_time: payload.operational.close_time || "22:00",
                    notes: payload.operational.notes || "",
                });
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Gagal memuat data dapur.");
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [outlet]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!outlet) {
        return null;
    }

    const stations = data?.stations || [];
    const outletInfo = data?.outlet || {};

    const resetStationForm = (station) => {
        setStationForm({
            name: station?.name || "",
            code: station?.code || "",
            processing_mode: station?.processing_mode || "auto",
            is_active: station?.is_active !== false,
        });
    };

    const resetDeviceForm = (device) => {
        setDeviceForm({
            name: device?.name || "",
            device_type: device?.device_type || "printer",
            connection_driver: device?.connection_driver || "browser",
            paper_width: device?.paper_width || "80mm",
            dispatch_mode: device?.dispatch_mode || "auto",
            is_active: device?.is_active !== false,
        });
    };

    const startEditStation = (station) => {
        setEditingStationId(station.id);
        setAddingDeviceStationId(null);
        setEditingDeviceId(null);
        resetStationForm(station);
    };

    const startAddDevice = (station) => {
        setEditingStationId(null);
        setEditingDeviceId(null);
        setAddingDeviceStationId(station.id);
        resetDeviceForm(null);
    };

    const startEditDevice = (device) => {
        setEditingStationId(null);
        setAddingDeviceStationId(null);
        setEditingDeviceId(device.id);
        resetDeviceForm(device);
    };

    const cancelAll = () => {
        setEditingStationId(null);
        setAddingDeviceStationId(null);
        setEditingDeviceId(null);
    };

    const saveStation = async (station) => {
        setIsSaving(true);
        try {
            await axios.put(route("settings.kitchen-stations.update", station.id), stationForm);
            toast.success("Station dapur berhasil diperbarui.");
            cancelAll();
            await loadData();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Gagal memperbarui station.");
        } finally {
            setIsSaving(false);
        }
    };

    const saveDevice = async (stationId, deviceId) => {
        setIsSaving(true);
        try {
            if (deviceId) {
                await axios.put(route("settings.kitchen-devices.update", deviceId), deviceForm);
                toast.success("Device berhasil diperbarui.");
            } else {
                await axios.post(route("settings.kitchen-devices.store", stationId), deviceForm);
                toast.success("Device berhasil ditambahkan.");
            }
            cancelAll();
            await loadData();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Gagal menyimpan device.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDevice = async (device) => {
        setTogglingDeviceId(device.id);
        try {
            await axios.patch(route("settings.kitchen-devices.toggle", device.id));
            toast.success(device.is_active ? "Device dinonaktifkan." : "Device diaktifkan.");
            await loadData();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Gagal mengubah status device.");
        } finally {
            setTogglingDeviceId(null);
        }
    };

    const saveOperational = async () => {
        setIsSavingOperational(true);
        try {
            const response = await axios.post(
                route("settings.kitchen-operations.update"),
                {
                    outlet_id: outlet.id,
                    outlet_is_active: operational.outlet_is_active,
                    is_open: operational.is_open,
                    open_time: operational.open_time,
                    close_time: operational.close_time,
                    notes: operational.notes,
                }
            );
            toast.success(response.data?.message || "Operasional outlet berhasil diperbarui.");
            if (response.data?.data) {
                setOperational({
                    outlet_is_active: response.data.data.outlet_is_active !== false,
                    is_open: response.data.data.is_open !== false,
                    open_time: response.data.data.open_time || "08:00",
                    close_time: response.data.data.close_time || "22:00",
                    notes: response.data.data.notes || "",
                });
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Gagal memperbarui operasional outlet.");
        } finally {
            setIsSavingOperational(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[87] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Operasional Dapur
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                            {outlet.name} ({outlet.code})
                            {outletInfo.stations_count !== undefined
                                ? ` • ${outletInfo.stations_count} station`
                                : ""}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    {/* ===== Operasional Outlet Hari Ini ===== */}
                    {!isLoading && data?.operational ? (
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Operasional Outlet Hari Ini
                                    </h4>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        Atur status buka toko, jam operasional, dan catatan harian.
                                    </p>
                                </div>
                            </div>

                            {/* Status toko */}
                            <div className="mb-4">
                                <label className={labelClass}>Status Toko Hari Ini</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOperational((p) => ({ ...p, is_open: true }))}
                                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                            operational.is_open
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                                        }`}
                                    >
                                        <IconCheck size={16} />
                                        BUKA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOperational((p) => ({ ...p, is_open: false }))}
                                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                            !operational.is_open
                                                ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                                : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                                        }`}
                                    >
                                        <IconX size={16} />
                                        TUTUP
                                    </button>
                                </div>
                                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                                    {operational.is_open
                                        ? "POS dan self-order meja aktif. Transaksi bisa diproses."
                                        : "Toko ditutup hari ini. POS dan self-order tidak menerima transaksi baru."}
                                </p>
                            </div>

                            {/* Jam buka / tutup (format 24 jam) */}
                            <div className="mb-4 grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Jam Buka</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="07:00"
                                        value={operational.open_time}
                                        onChange={(e) =>
                                            setOperational((p) => ({
                                                ...p,
                                                open_time: maskTimeInput(e.target.value),
                                            }))
                                        }
                                        onBlur={() =>
                                            setOperational((p) => ({
                                                ...p,
                                                open_time: normalizeTimeInput(p.open_time),
                                            }))
                                        }
                                        className={inputClass()}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Jam Tutup</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="22:00"
                                        value={operational.close_time}
                                        onChange={(e) =>
                                            setOperational((p) => ({
                                                ...p,
                                                close_time: maskTimeInput(e.target.value),
                                            }))
                                        }
                                        onBlur={() =>
                                            setOperational((p) => ({
                                                ...p,
                                                close_time: normalizeTimeInput(p.close_time),
                                            }))
                                        }
                                        className={inputClass()}
                                    />
                                </div>
                            </div>

                            {/* Catatan */}
                            <div className="mb-4">
                                <label className={labelClass}>Catatan Hari Ini</label>
                                <textarea
                                    rows={2}
                                    value={operational.notes}
                                    onChange={(e) => setOperational((p) => ({ ...p, notes: e.target.value }))}
                                    placeholder="Contoh: Tutup lebih awal karena stok habis / maintenance"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={operational.outlet_is_active}
                                        onChange={(e) => setOperational((p) => ({ ...p, outlet_is_active: e.target.checked }))}
                                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                    />
                                    Outlet aktif (terima operasional)
                                </label>
                                <button
                                    type="button"
                                    onClick={saveOperational}
                                    disabled={isSavingOperational}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                                >
                                    {isSavingOperational ? (
                                        <IconLoader2 size={14} className="animate-spin" />
                                    ) : (
                                        <IconCheck size={14} />
                                    )}
                                    Simpan Operasional
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <IconLoader2 size={28} className="animate-spin text-primary-500" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data dapur...</p>
                        </div>
                    ) : stations.length ? (
                        <div className="space-y-4">
                            {stations.map((station) => (
                                <div
                                    key={station.id}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                                >
                                    {editingStationId === station.id ? (
                                        /* ===== Edit station form ===== */
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    Edit Station
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={cancelAll}
                                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <label className={labelClass}>Nama Station</label>
                                                    <input
                                                        value={stationForm.name}
                                                        onChange={(e) => setStationForm((p) => ({ ...p, name: e.target.value }))}
                                                        className={inputClass()}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Kode</label>
                                                    <input
                                                        value={stationForm.code}
                                                        onChange={(e) => setStationForm((p) => ({ ...p, code: e.target.value }))}
                                                        className={inputClass()}
                                                        placeholder="ST-XXX"
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Mode Proses</label>
                                                    <select
                                                        value={stationForm.processing_mode}
                                                        onChange={(e) => setStationForm((p) => ({ ...p, processing_mode: e.target.value }))}
                                                        className={inputClass()}
                                                    >
                                                        <option value="auto">Otomatis</option>
                                                        <option value="manual">Manual</option>
                                                    </select>
                                                </div>
                                                <label className="inline-flex items-end gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={stationForm.is_active}
                                                        onChange={(e) => setStationForm((p) => ({ ...p, is_active: e.target.checked }))}
                                                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                                    />
                                                    Aktif
                                                </label>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => saveStation(station)}
                                                    disabled={isSaving}
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                                                >
                                                    {isSaving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
                                                    Simpan Station
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ===== Station summary ===== */
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <IconDevices size={16} className="shrink-0 text-primary-500" />
                                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                    {station.name}
                                                </p>
                                                <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {station.code}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {station.is_active ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                        Nonaktif
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    <IconClock size={11} />
                                                    {station.processing_mode === "auto" ? "Proses otomatis" : "Proses manual"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditStation(station)}
                                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                >
                                                    <IconEdit size={12} />
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ===== Devices ===== */}
                                    <div className="mt-3 space-y-2">
                                        {station.devices.map((device) => (
                                            <div
                                                key={device.id}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
                                            >
                                                {editingDeviceId === device.id ? (
                                                    /* ===== Edit device form ===== */
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                                Edit Device
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={cancelAll}
                                                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                            >
                                                                Batal
                                                            </button>
                                                        </div>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            <div>
                                                                <label className={labelClass}>Nama Device</label>
                                                                <input
                                                                    value={deviceForm.name}
                                                                    onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))}
                                                                    className={inputClass()}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className={labelClass}>Tipe Device</label>
                                                                <select
                                                                    value={deviceForm.device_type}
                                                                    onChange={(e) => setDeviceForm((p) => ({ ...p, device_type: e.target.value }))}
                                                                    className={inputClass()}
                                                                >
                                                                    {DEVICE_TYPES.map(([value, label]) => (
                                                                        <option key={value} value={value}>
                                                                            {label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className={labelClass}>Lebar Kertas</label>
                                                                <select
                                                                    value={deviceForm.paper_width}
                                                                    onChange={(e) => setDeviceForm((p) => ({ ...p, paper_width: e.target.value }))}
                                                                    className={inputClass()}
                                                                >
                                                                    <option value="80mm">80mm</option>
                                                                    <option value="58mm">58mm</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className={labelClass}>Dispatch Mode</label>
                                                                <select
                                                                    value={deviceForm.dispatch_mode}
                                                                    onChange={(e) => setDeviceForm((p) => ({ ...p, dispatch_mode: e.target.value }))}
                                                                    className={inputClass()}
                                                                >
                                                                    <option value="auto">Otomatis</option>
                                                                    <option value="manual">Manual</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <input
                                                                type="checkbox"
                                                                checked={deviceForm.is_active}
                                                                onChange={(e) => setDeviceForm((p) => ({ ...p, is_active: e.target.checked }))}
                                                                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                                            />
                                                            Aktif
                                                        </label>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => saveDevice(station.id, device.id)}
                                                                disabled={isSaving}
                                                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                                                            >
                                                                {isSaving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
                                                                Simpan Device
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* ===== Device summary ===== */
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <IconPrinter size={14} className="shrink-0 text-slate-400" />
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                                                    {device.name}
                                                                </p>
                                                                <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                                                    {deviceTypeLabel(device.device_type)} • {device.paper_width}
                                                                    {device.is_primary ? " • Primary" : ""}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                                    device.health?.is_issue
                                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                                        device.health?.is_issue ? "bg-amber-500" : "bg-emerald-500"
                                                                    }`}
                                                                />
                                                                {device.health?.label || (device.is_active ? "Siap" : "Nonaktif")}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditDevice(device)}
                                                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                            >
                                                                <IconEdit size={12} />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleDevice(device)}
                                                                disabled={togglingDeviceId === device.id}
                                                                className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition disabled:opacity-60 ${
                                                                    device.is_active
                                                                        ? "border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                                                                        : "border-emerald-200 text-emerald-600 hover:border-emerald-300 dark:border-emerald-900/50 dark:text-emerald-400"
                                                                }`}
                                                            >
                                                                {togglingDeviceId === device.id ? (
                                                                    <IconLoader2 size={12} className="animate-spin" />
                                                                ) : device.is_active ? (
                                                                    <IconX size={12} />
                                                                ) : (
                                                                    <IconCheck size={12} />
                                                                )}
                                                                {device.is_active ? "Nonaktifkan" : "Aktifkan"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* ===== Add device form ===== */}
                                    {addingDeviceStationId === station.id ? (
                                        <div className="mt-3 rounded-xl border border-dashed border-primary-300 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950/20">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                                                    Tambah Device Baru
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={cancelAll}
                                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <label className={labelClass}>Nama Device</label>
                                                    <input
                                                        value={deviceForm.name}
                                                        onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))}
                                                        className={inputClass()}
                                                        placeholder="Printer / Screen ..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Tipe Device</label>
                                                    <select
                                                        value={deviceForm.device_type}
                                                        onChange={(e) => setDeviceForm((p) => ({ ...p, device_type: e.target.value }))}
                                                        className={inputClass()}
                                                    >
                                                        {DEVICE_TYPES.map(([value, label]) => (
                                                            <option key={value} value={value}>
                                                                {label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Lebar Kertas</label>
                                                    <select
                                                        value={deviceForm.paper_width}
                                                        onChange={(e) => setDeviceForm((p) => ({ ...p, paper_width: e.target.value }))}
                                                        className={inputClass()}
                                                    >
                                                        <option value="80mm">80mm</option>
                                                        <option value="58mm">58mm</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Dispatch Mode</label>
                                                    <select
                                                        value={deviceForm.dispatch_mode}
                                                        onChange={(e) => setDeviceForm((p) => ({ ...p, dispatch_mode: e.target.value }))}
                                                        className={inputClass()}
                                                    >
                                                        <option value="auto">Otomatis</option>
                                                        <option value="manual">Manual</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={deviceForm.is_active}
                                                    onChange={(e) => setDeviceForm((p) => ({ ...p, is_active: e.target.checked }))}
                                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                                                />
                                                Aktif
                                            </label>
                                            <div className="mt-3 flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => saveDevice(station.id, null)}
                                                    disabled={isSaving}
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                                                >
                                                    {isSaving ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
                                                    Tambah Device
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => startAddDevice(station)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:border-primary-300 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300"
                                            >
                                                <IconPlus size={13} />
                                                Tambah Device
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <IconDevices size={28} className="text-slate-300 dark:text-slate-600" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Belum ada station dapur untuk outlet ini.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                        Tutup
                    </button>
                    <button
                        type="button"
                        onClick={onOpenFullPage}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                    >
                        <IconExternalLink size={16} />
                        Buka halaman lengkap
                    </button>
                </div>
            </div>
        </div>
    );
}
