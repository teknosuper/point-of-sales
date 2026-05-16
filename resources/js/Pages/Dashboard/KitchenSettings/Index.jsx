import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import toast from "react-hot-toast";

const defaultStation = {
    outlet_id: "",
    name: "",
    code: "",
    station_type: "kitchen",
    display_mode: "screen",
    sort_order: 0,
    is_active: true,
};

const defaultDevice = {
    name: "",
    device_type: "screen",
    connection_driver: "browser",
    endpoint: "",
    print_profile: "browser_manual",
    dispatch_mode: "manual",
    fallback_device_id: "",
    rawbt_intent_url: "",
    qz_printer_name: "",
    bridge_device_key: "",
    paper_width: "80mm",
    template_style: "standard",
    print_copies: 1,
    is_primary: false,
    is_active: true,
};

const formatDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "-";

const printProfileDescriptions = {
    browser_manual: "Cetak lewat dialog print browser biasa.",
    rawbt_android: "Browser Android meneruskan print ke aplikasi RawBT dan printer thermal Bluetooth.",
    qz_tray: "Browser desktop meneruskan print langsung ke QZ Tray.",
    local_bridge: "Laravel queue dan printer agent lokal yang mengeksekusi cetak.",
};

export default function Index({ stations = [], filters = {}, outlets = [], printProfiles = {}, setupStatus = {}, ui = {}, recentPrintJobs = [], operationalSettings = {} }) {
    const { flash, auth, activeOutlet } = usePage().props;
    const isKitchenWorkspace = auth?.user?.preferred_workspace === "kitchen";
    const [selectedOutlet, setSelectedOutlet] = useState(filters?.outlet_id || "");
    const [issuesOnly, setIssuesOnly] = useState(false);
    const [editingStation, setEditingStation] = useState(null);
    const [editingDevice, setEditingDevice] = useState(null);
    const stationForm = useForm(defaultStation);
    const deviceForm = useForm(defaultDevice);
    const operationsForm = useForm({
        outlet_id: operationalSettings?.outlet_id ? String(operationalSettings.outlet_id) : "",
        is_open: Boolean(operationalSettings?.is_open ?? true),
        open_time: operationalSettings?.open_time || "08:00",
        close_time: operationalSettings?.close_time || "22:00",
        notes: operationalSettings?.notes || "",
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    useEffect(() => {
        if (ui?.preset_outlet_id) {
            setSelectedOutlet(String(ui.preset_outlet_id));
            stationForm.setData("outlet_id", String(ui.preset_outlet_id));
        }
    }, [ui?.preset_outlet_id]);

    useEffect(() => {
        operationsForm.setData({
            outlet_id: operationalSettings?.outlet_id ? String(operationalSettings.outlet_id) : "",
            is_open: Boolean(operationalSettings?.is_open ?? true),
            open_time: operationalSettings?.open_time || "08:00",
            close_time: operationalSettings?.close_time || "22:00",
            notes: operationalSettings?.notes || "",
        });
    }, [
        operationalSettings?.outlet_id,
        operationalSettings?.is_open,
        operationalSettings?.open_time,
        operationalSettings?.close_time,
        operationalSettings?.notes,
    ]);

    const filteredStations = useMemo(
        () =>
            stations
                .filter((station) =>
                    selectedOutlet ? String(station.outlet_id) === String(selectedOutlet) : true
                )
                .map((station) => ({
                    ...station,
                    devices: issuesOnly
                        ? (station.devices || []).filter((device) => device.operational_status?.is_issue)
                        : station.devices || [],
                }))
                .filter((station) => (issuesOnly ? (station.devices || []).length > 0 : true)),
        [stations, selectedOutlet, issuesOnly]
    );
    const selectedOutletRecord = useMemo(
        () => outlets.find((outlet) => String(outlet.id) === String(selectedOutlet)) || null,
        [outlets, selectedOutlet]
    );

    const startStationEdit = (station) => {
        setEditingStation(station.id);
        stationForm.setData({
            outlet_id: String(station.outlet_id),
            name: station.name || "",
            code: station.code || "",
            station_type: station.station_type || "kitchen",
            display_mode: station.display_mode || "screen",
            sort_order: Number(station.sort_order ?? 0),
            is_active: Boolean(station.is_active),
        });
    };

    const resetStation = () => {
        setEditingStation(null);
        stationForm.setData(defaultStation);
    };

    const submitStation = (event) => {
        event.preventDefault();
        if (editingStation) {
            stationForm.put(route("settings.kitchen-stations.update", editingStation), {
                preserveScroll: true,
                onSuccess: () => resetStation(),
            });
            return;
        }

        stationForm.post(route("settings.kitchen-stations.store"), {
            preserveScroll: true,
            onSuccess: () => resetStation(),
        });
    };

    const startDeviceEdit = (station, device) => {
        setEditingDevice({ stationId: station.id, deviceId: device.id });
        deviceForm.setData({
            name: device.name || "",
            device_type: device.device_type || "screen",
            connection_driver: device.connection_driver || "browser",
            endpoint: device.endpoint || "",
            print_profile: device.meta?.print_profile || "browser_manual",
            dispatch_mode: device.meta?.dispatch_mode || "manual",
            fallback_device_id: device.meta?.fallback_device_id ? String(device.meta.fallback_device_id) : "",
            rawbt_intent_url: device.meta?.rawbt_intent_url || "",
            qz_printer_name: device.meta?.qz_printer_name || "",
            bridge_device_key: device.meta?.bridge_device_key || "",
            paper_width: device.meta?.paper_width || "80mm",
            template_style: device.meta?.template_style || "standard",
            print_copies: Number(device.meta?.print_copies ?? 1),
            is_primary: Boolean(device.is_primary),
            is_active: Boolean(device.is_active),
        });
    };

    const resetDevice = () => {
        setEditingDevice(null);
        deviceForm.setData(defaultDevice);
    };

    const showStationForm = editingStation !== null || Boolean(ui?.show_station_form);
    const showDeviceForm = Boolean(ui?.show_device_form);

    const submitDevice = (event, stationId) => {
        event.preventDefault();

        if (editingDevice?.deviceId) {
            deviceForm.put(route("settings.kitchen-devices.update", editingDevice.deviceId), {
                preserveScroll: true,
                onSuccess: () => resetDevice(),
            });
            return;
        }

        deviceForm.post(route("settings.kitchen-devices.store", stationId), {
            preserveScroll: true,
            onSuccess: () => resetDevice(),
        });
    };

    const runDeviceAction = (routeName, deviceId) => {
        router.post(
            route(routeName, deviceId),
            {},
            {
                preserveScroll: true,
            }
        );
    };

    const copyShortcut = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} berhasil disalin.`);
        } catch {
            toast.error("Gagal menyalin link.");
        }
    };

    const toggleDevice = (deviceId) => {
        router.patch(
            route("settings.kitchen-devices.toggle", deviceId),
            {},
            {
                preserveScroll: true,
            }
        );
    };

    const submitOperations = (event) => {
        event.preventDefault();
        operationsForm.post(route("settings.kitchen-operations.update"), {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title="Operasional Dapur & Printer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Operasional Dapur & Printer
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Kelola operasional dapur di dalam outlet: stasiun dapur, layar antrean, dan printer thermal per stasiun.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Operasional Outlet Hari Ini
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Atur status buka toko, jam operasional, dan catatan harian untuk outlet dapur ini.
                        </p>
                        {activeOutlet?.name ? (
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                                Outlet aktif: {activeOutlet.name}
                            </p>
                        ) : null}
                    </div>

                    <form onSubmit={submitOperations} className="grid gap-4 lg:grid-cols-4">
                        {!isKitchenWorkspace ? (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Outlet
                                </label>
                                <select
                                    value={operationsForm.data.outlet_id}
                                    onChange={(event) => operationsForm.setData("outlet_id", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Pilih outlet</option>
                                    {outlets.map((outlet) => (
                                        <option key={outlet.id} value={String(outlet.id)}>
                                            {outlet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Status toko
                            </label>
                            <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800">
                                <input
                                    id="daily_store_open"
                                    type="checkbox"
                                    checked={operationsForm.data.is_open}
                                    onChange={(event) => operationsForm.setData("is_open", event.target.checked)}
                                />
                                <label htmlFor="daily_store_open" className="text-slate-700 dark:text-slate-200">
                                    {operationsForm.data.is_open ? "Toko buka hari ini" : "Toko ditutup hari ini"}
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Jam buka
                            </label>
                            <input
                                type="time"
                                value={operationsForm.data.open_time}
                                onChange={(event) => operationsForm.setData("open_time", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Jam tutup
                            </label>
                            <input
                                type="time"
                                value={operationsForm.data.close_time}
                                onChange={(event) => operationsForm.setData("close_time", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>

                        <div className="lg:col-span-3">
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Catatan hari ini
                            </label>
                            <input
                                value={operationsForm.data.notes}
                                onChange={(event) => operationsForm.setData("notes", event.target.value)}
                                placeholder="Contoh: Tutup lebih awal karena stok habis / maintenance"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={operationsForm.processing}
                                className="w-full rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                            >
                                {operationsForm.processing ? "Menyimpan..." : "Simpan Operasional"}
                            </button>
                        </div>
                    </form>
                </div>

                <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <summary className="cursor-pointer list-none">
                        <p className="font-semibold text-slate-900 dark:text-white">
                            Panduan halaman operasional dapur
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Buka untuk melihat fungsi halaman ini dan batas penggunaannya.
                        </p>
                    </summary>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                            <p className="font-semibold">Halaman ini untuk operasional dapur</p>
                            <p className="mt-1 text-blue-800 dark:text-blue-200">
                                Gunakan halaman ini untuk membuat stasiun seperti minuman, ayam, salad, lalu hubungkan ke layar atau printer yang dipakai dapur.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                            <p className="font-semibold">Bukan untuk membuat tenant atau outlet</p>
                            <p className="mt-1 text-amber-800 dark:text-amber-200">
                                Untuk membuat outlet utama, tenant foodcourt, gudang, atau menetapkan user ke outlet, gunakan menu <span className="font-semibold">Outlet & Tenant</span>.
                            </p>
                        </div>
                    </div>
                </details>

                <div className="grid gap-4 lg:grid-cols-4">
                    {[
                        {
                            label: "Stasiun",
                            value: setupStatus.stations_count ?? 0,
                            done: setupStatus.has_station,
                        },
                        {
                            label: "Perangkat",
                            value: setupStatus.devices_count ?? 0,
                            done: setupStatus.has_device,
                        },
                        {
                            label: "Printer / Layar",
                            value: (setupStatus.printer_count ?? 0) + (setupStatus.screen_count ?? 0),
                            done: setupStatus.has_printer_or_screen,
                        },
                        {
                            label: "Produk ke Stasiun",
                            value: setupStatus.mapped_products_count ?? 0,
                            done: setupStatus.has_product_mapping,
                        },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-2xl border p-4 ${
                                item.done
                                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                    : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                            }`}
                        >
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{item.value}</p>
                            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                {item.done ? "Siap" : "Perlu tindakan"}
                            </p>
                        </div>
                    ))}
                </div>

                {!setupStatus.has_station || !setupStatus.has_device || !setupStatus.has_product_mapping ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        <p className="font-semibold">Status setup dapur masih belum lengkap</p>
                        <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
                            {!setupStatus.has_station ? <p>• Belum ada stasiun dapur yang dibuat untuk outlet ini.</p> : null}
                            {!setupStatus.has_device ? <p>• Belum ada layar, printer, atau tablet yang terhubung ke stasiun.</p> : null}
                            {!setupStatus.has_product_mapping ? <p>• Produk belum dipetakan ke stasiun dapur, jadi tiket belum akan terpecah otomatis.</p> : null}
                        </div>
                    </div>
                ) : null}

                {!isKitchenWorkspace ? (
                    <div>
                        <Link
                            href={route("guides.outlet-kitchen")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Buka Panduan Lengkap Outlet, Tenant & Dapur
                        </Link>
                    </div>
                ) : null}

                {selectedOutletRecord && !isKitchenWorkspace ? (
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={route("outlets.show", selectedOutletRecord.id)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Lihat Outlet {selectedOutletRecord.name}
                        </Link>
                        <Link
                            href={route("reports.outlet-analytics.index", { outlet_id: selectedOutletRecord.id })}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                            Statistik Outlet Ini
                        </Link>
                    </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        {!isKitchenWorkspace ? (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Filter outlet
                            </label>
                            <select
                                value={selectedOutlet}
                                onChange={(event) => setSelectedOutlet(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm md:w-80 dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="">Semua outlet</option>
                                {outlets.map((outlet) => (
                                    <option key={outlet.id} value={String(outlet.id)}>
                                        {outlet.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        ) : (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Outlet operasional
                            </label>
                            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {selectedOutletRecord?.name || activeOutlet?.name || "Outlet aktif"}
                            </div>
                        </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIssuesOnly((value) => !value)}
                            className={`rounded-xl px-4 py-2 text-sm font-medium ${
                                issuesOnly
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                    : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            }`}
                        >
                            {issuesOnly ? "Menampilkan Hanya Device Bermasalah" : "Tampilkan Hanya Device Bermasalah"}
                        </button>
                    </div>

                    {showStationForm ? (
                    <form onSubmit={submitStation} className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Outlet</label>
                            <select
                                value={stationForm.data.outlet_id}
                                onChange={(event) => stationForm.setData("outlet_id", event.target.value)}
                                disabled={isKitchenWorkspace}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="">Pilih outlet</option>
                                {outlets.map((outlet) => (
                                    <option key={outlet.id} value={String(outlet.id)}>
                                        {outlet.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Station</label>
                            <input
                                value={stationForm.data.name}
                                onChange={(event) => stationForm.setData("name", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Kode</label>
                            <input
                                value={stationForm.data.code}
                                onChange={(event) => stationForm.setData("code", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipe Station</label>
                            <select
                                value={stationForm.data.station_type}
                                onChange={(event) => stationForm.setData("station_type", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="kitchen">Kitchen</option>
                                <option value="bar">Bar</option>
                                <option value="service">Service</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Display Mode</label>
                            <select
                                value={stationForm.data.display_mode}
                                onChange={(event) => stationForm.setData("display_mode", event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <option value="screen">Screen</option>
                                <option value="printer">Printer</option>
                            </select>
                        </div>
                        <div className="flex items-end gap-3">
                            <button
                                type="submit"
                                className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                            >
                                {editingStation ? "Update Station" : "Tambah Station"}
                            </button>
                            {editingStation ? (
                                <button type="button" onClick={resetStation} className="text-sm text-slate-500">
                                    Batal
                                </button>
                            ) : null}
                        </div>
                    </form>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                            Klik langkah <span className="font-semibold">Buat Station</span> dari wizard atau pilih <span className="font-semibold">Edit Station</span> untuk membuka form station.
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {filteredStations.map((station) => (
                        <div key={station.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {station.name} • {station.outlet?.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {station.code || "-"} • {station.station_type} • {station.display_mode}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Device sehat: {station.operational_summary?.healthy_count || 0} • Bermasalah: {station.operational_summary?.issue_count || 0}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => window.open(station.shortcut_urls?.entry_url, "_blank")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Buka Link Station
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyShortcut(station.shortcut_urls?.entry_url, "Link station")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Salin Link Station
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyShortcut(station.shortcut_urls?.kiosk_url, "Link kiosk")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Salin Link Kiosk
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => window.open(station.shortcut_urls?.access_sheet_url, "_blank")}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Buka Lembar Akses
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => startStationEdit(station)}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Edit Station
                                    </button>
                                </div>
                            </div>

                            <div className="mb-4 grid gap-2 md:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-950/30">
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        Link Masuk Station
                                    </p>
                                    <p className="mt-1 break-all text-slate-500 dark:text-slate-400">
                                        {station.shortcut_urls?.entry_url}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-950/30">
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        Link Queue Langsung
                                    </p>
                                    <p className="mt-1 break-all text-slate-500 dark:text-slate-400">
                                        {station.shortcut_urls?.queue_url}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-950/30">
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        Link Tablet / Kiosk
                                    </p>
                                    <p className="mt-1 break-all text-slate-500 dark:text-slate-400">
                                        {station.shortcut_urls?.kiosk_url}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-950/30">
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        Link Login Dapur
                                    </p>
                                    <p className="mt-1 break-all text-slate-500 dark:text-slate-400">
                                        {station.shortcut_urls?.login_url}
                                    </p>
                                </div>
                            </div>

                            {showDeviceForm || editingDevice?.stationId === station.id ? (
                            <form onSubmit={(event) => submitDevice(event, station.id)} className="mb-4 grid gap-4 md:grid-cols-4">
                                <input
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.name : ""}
                                    onChange={(event) => deviceForm.setData("name", event.target.value)}
                                    placeholder="Nama device"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.device_type : "screen"}
                                    onChange={(event) => deviceForm.setData("device_type", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="screen">Screen</option>
                                    <option value="printer">Printer</option>
                                    <option value="tablet">Tablet</option>
                                </select>
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.connection_driver : "browser"}
                                    onChange={(event) => deviceForm.setData("connection_driver", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="browser">Browser</option>
                                    <option value="network">Network</option>
                                    <option value="cloud">Cloud</option>
                                    <option value="usb">USB</option>
                                </select>
                                <input
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.endpoint : ""}
                                    onChange={(event) => deviceForm.setData("endpoint", event.target.value)}
                                    placeholder="Endpoint / IP / Queue"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.print_profile : "browser_manual"}
                                    onChange={(event) => deviceForm.setData("print_profile", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    {Object.entries(printProfiles).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.paper_width : "80mm"}
                                    onChange={(event) => deviceForm.setData("paper_width", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="58mm">58mm</option>
                                    <option value="80mm">80mm</option>
                                </select>
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.template_style : "standard"}
                                    onChange={(event) => deviceForm.setData("template_style", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="standard">Template Standard</option>
                                    <option value="compact">Template Compact</option>
                                    <option value="kitchen">Template Kitchen</option>
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.print_copies : 1}
                                    onChange={(event) => deviceForm.setData("print_copies", event.target.value)}
                                    placeholder="Copies"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.dispatch_mode : "manual"}
                                    onChange={(event) => deviceForm.setData("dispatch_mode", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="manual">Dispatch Manual</option>
                                    <option value="auto">Dispatch Otomatis</option>
                                </select>
                                <select
                                    value={editingDevice?.stationId === station.id ? deviceForm.data.fallback_device_id : ""}
                                    onChange={(event) => deviceForm.setData("fallback_device_id", event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <option value="">Tanpa fallback device</option>
                                    {station.devices
                                        ?.filter((candidate) => !editingDevice?.deviceId || candidate.id !== editingDevice.deviceId)
                                        .map((candidate) => (
                                            <option key={candidate.id} value={String(candidate.id)}>
                                                {candidate.name}
                                            </option>
                                        ))}
                                </select>
                                {editingDevice?.stationId === station.id && deviceForm.data.print_profile === "rawbt_android" ? (
                                    <input
                                        value={deviceForm.data.rawbt_intent_url}
                                        onChange={(event) => deviceForm.setData("rawbt_intent_url", event.target.value)}
                                        placeholder="RawBT intent / URL scheme"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                ) : null}
                                {editingDevice?.stationId === station.id && deviceForm.data.print_profile === "qz_tray" ? (
                                    <input
                                        value={deviceForm.data.qz_printer_name}
                                        onChange={(event) => deviceForm.setData("qz_printer_name", event.target.value)}
                                        placeholder="Nama printer di QZ Tray"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                ) : null}
                                {editingDevice?.stationId === station.id && deviceForm.data.print_profile === "local_bridge" ? (
                                    <input
                                        value={deviceForm.data.bridge_device_key}
                                        onChange={(event) => deviceForm.setData("bridge_device_key", event.target.value)}
                                        placeholder="Bridge device key / queue key"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm md:col-span-2 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                ) : null}
                                <div className="md:col-span-4 flex items-center gap-4">
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={editingDevice?.stationId === station.id ? deviceForm.data.is_primary : false}
                                            onChange={(event) => deviceForm.setData("is_primary", event.target.checked)}
                                        />
                                        Primary
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={editingDevice?.stationId === station.id ? deviceForm.data.is_active : true}
                                            onChange={(event) => deviceForm.setData("is_active", event.target.checked)}
                                        />
                                        Aktif
                                    </label>
                                    <button
                                        type="submit"
                                        className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white"
                                    >
                                        {editingDevice?.stationId === station.id ? "Update Device" : "Tambah Device"}
                                    </button>
                                    {editingDevice?.stationId === station.id ? (
                                        <button type="button" onClick={resetDevice} className="text-sm text-slate-500">
                                            Batal
                                        </button>
                                    ) : null}
                                </div>
                                <div className="md:col-span-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                                    {printProfileDescriptions[editingDevice?.stationId === station.id ? deviceForm.data.print_profile : "browser_manual"]}
                                    <div className="mt-1">
                                        {editingDevice?.stationId === station.id && deviceForm.data.print_profile === "rawbt_android"
                                            ? "Untuk RawBT, browser Android tetap jadi UI. Printer Bluetooth ditangani aplikasi RawBT di device Android."
                                            : null}
                                        {editingDevice?.stationId === station.id && deviceForm.data.print_profile === "qz_tray"
                                            ? "Untuk QZ Tray, buka aplikasi dari desktop atau mini PC yang sudah memasang QZ Tray."
                                            : null}
                                        {editingDevice?.stationId === station.id && deviceForm.data.print_profile === "local_bridge"
                                            ? "Untuk Local Bridge, gunakan endpoint/queue yang akan dibaca agent printer lokal."
                                            : null}
                                    </div>
                                </div>
                            </form>
                            ) : (
                                <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                                    Klik <span className="font-semibold">Tambah Device</span> dari wizard atau pilih <span className="font-semibold">Edit Device</span> pada salah satu device untuk membuka form.
                                </div>
                            )}

                            <div className="space-y-3">
                                {station.devices?.map((device) => (
                                    <div key={device.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                {device.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {device.device_type} • {device.connection_driver} • {device.endpoint || "-"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {printProfiles[device.meta?.print_profile || "browser_manual"] || "Browser Manual"} •{" "}
                                                {device.meta?.paper_width || "80mm"} •{" "}
                                                {device.meta?.template_style || "standard"} •{" "}
                                                {device.meta?.print_copies || 1} copy
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Dispatch: {device.meta?.dispatch_mode || "manual"} •{" "}
                                                Fallback: {station.devices?.find((candidate) => candidate.id === device.meta?.fallback_device_id)?.name || "-"}
                                            </p>
                                            {device.meta?.rawbt_intent_url ? (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    RawBT: {device.meta.rawbt_intent_url}
                                                </p>
                                            ) : null}
                                            {device.meta?.qz_printer_name ? (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    QZ Printer: {device.meta.qz_printer_name}
                                                </p>
                                            ) : null}
                                            {device.meta?.bridge_device_key ? (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Bridge Key: {device.meta.bridge_device_key}
                                                </p>
                                            ) : null}
                                            {device.meta?.dispatch_mode === "auto" ? (
                                                <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                                                    Auto dispatch aktif. Device ini diprioritaskan untuk antrian print otomatis.
                                                </p>
                                            ) : null}
                                            {device.meta?.last_health_check ? (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Health: {device.meta.last_health_check.status} •{" "}
                                                    {device.meta.last_health_check.message}
                                                </p>
                                            ) : null}
                                            {device.meta?.last_test ? (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Test: {device.meta.last_test.message}
                                                </p>
                                            ) : null}
                                            {device.device_type === "printer" ? (
                                                <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 font-mono text-[11px] leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                                    POINZA
                                                    <br />
                                                    {device.meta?.template_style || "standard"} •{" "}
                                                    {device.meta?.paper_width || "80mm"}
                                                    <br />
                                                    --------------------
                                                    <br />
                                                    Ayam Bakar x2
                                                    <br />
                                                    Es Teh x1
                                                    <br />
                                                    --------------------
                                                    <br />
                                                    Cetak: {device.meta?.print_copies || 1}x
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {device.is_primary ? (
                                                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                    Primary
                                                </span>
                                            ) : null}
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${device.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                                                {device.is_active ? "Aktif" : "Nonaktif"}
                                            </span>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    device.operational_status?.tone === "rose"
                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                                        : device.operational_status?.tone === "amber"
                                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                          : device.operational_status?.tone === "blue"
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                }`}
                                            >
                                                {device.operational_status?.label || "Siap"}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => startDeviceEdit(station, device)}
                                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                            >
                                                Edit Device
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleDevice(device.id)}
                                                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                                                    device.is_active
                                                        ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                                                        : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                                                }`}
                                            >
                                                {device.is_active ? "Matikan" : "Aktifkan"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    runDeviceAction("settings.kitchen-devices.health-check", device.id)
                                                }
                                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                            >
                                                Health Check
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    runDeviceAction("settings.kitchen-devices.test", device.id)
                                                }
                                                className="rounded-xl bg-primary-500 px-3 py-2 text-sm font-medium text-white"
                                            >
                                                Test Device
                                            </button>
                                        </div>
                                        {device.operational_status?.message ? (
                                            <div className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                                {device.operational_status.message}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Riwayat Print Job Terbaru
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Queue formal untuk printer kitchen. Gunakan ini untuk melihat job mana yang masih queued, sudah berhasil, atau gagal.
                        </p>
                    </div>

                    {recentPrintJobs.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                            Belum ada print job yang tercatat untuk filter outlet ini.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentPrintJobs.map((job) => (
                                <div
                                    key={job.id}
                                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/30 lg:flex-row lg:items-start lg:justify-between"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                            {job.ticket_number || "Ticket"} • {job.invoice || "Tanpa nota"}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {job.outlet_code || "OUT"} • {job.station_name || "-"} • {job.device_name || "-"} • {job.copies} copy
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Queue: {formatDateTime(job.queued_at)} • Selesai: {formatDateTime(job.processed_at)} • Gagal: {formatDateTime(job.failed_at)}
                                        </p>
                                        {job.failure_reason ? (
                                            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                                {job.failure_reason}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                job.status === "success"
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                    : job.status === "failed"
                                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                            }`}
                                        >
                                            {job.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
