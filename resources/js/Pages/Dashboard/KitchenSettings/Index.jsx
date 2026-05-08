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
    paper_width: "80mm",
    template_style: "standard",
    print_copies: 1,
    is_primary: false,
    is_active: true,
};

export default function Index({ stations = [], filters = {}, outlets = [], setupStatus = {}, ui = {} }) {
    const { flash } = usePage().props;
    const [selectedOutlet, setSelectedOutlet] = useState(filters?.outlet_id || "");
    const [editingStation, setEditingStation] = useState(null);
    const [editingDevice, setEditingDevice] = useState(null);
    const stationForm = useForm(defaultStation);
    const deviceForm = useForm(defaultDevice);

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

    const filteredStations = useMemo(
        () =>
            stations.filter((station) =>
                selectedOutlet ? String(station.outlet_id) === String(selectedOutlet) : true
            ),
        [stations, selectedOutlet]
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

    return (
        <>
            <Head title="Kitchen Ops & Printer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Kitchen Ops & Printer
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Kelola operasional dapur di dalam outlet: station kitchen, layar antrian, dan printer thermal per station.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                        <p className="font-semibold">Halaman ini untuk operasional dapur</p>
                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                            Gunakan halaman ini untuk membuat station seperti minuman, ayam, salad, lalu hubungkan ke screen atau printer yang dipakai dapur.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        <p className="font-semibold">Bukan untuk membuat tenant atau outlet</p>
                        <p className="mt-1 text-amber-800 dark:text-amber-200">
                            Untuk membuat outlet utama, tenant foodcourt, warehouse, atau assign user outlet, gunakan menu <span className="font-semibold">Outlet & Tenant</span>.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    {[
                        {
                            label: "Station",
                            value: setupStatus.stations_count ?? 0,
                            done: setupStatus.has_station,
                        },
                        {
                            label: "Device",
                            value: setupStatus.devices_count ?? 0,
                            done: setupStatus.has_device,
                        },
                        {
                            label: "Printer / Screen",
                            value: (setupStatus.printer_count ?? 0) + (setupStatus.screen_count ?? 0),
                            done: setupStatus.has_printer_or_screen,
                        },
                        {
                            label: "Produk ke Station",
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
                        <p className="font-semibold">Status setup kitchen masih belum lengkap</p>
                        <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
                            {!setupStatus.has_station ? <p>• Belum ada station dapur yang dibuat untuk outlet ini.</p> : null}
                            {!setupStatus.has_device ? <p>• Belum ada screen, printer, atau tablet yang terhubung ke station.</p> : null}
                            {!setupStatus.has_product_mapping ? <p>• Produk belum dipetakan ke station dapur, jadi ticket belum akan terpecah otomatis.</p> : null}
                        </div>
                    </div>
                ) : null}

                <div>
                    <Link
                        href={route("guides.outlet-kitchen")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                        Buka Panduan Lengkap Outlet, Tenant & Kitchen
                    </Link>
                </div>

                {selectedOutletRecord ? (
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
                    <div className="mb-4">
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

                    {showStationForm ? (
                    <form onSubmit={submitStation} className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Outlet</label>
                            <select
                                value={stationForm.data.outlet_id}
                                onChange={(event) => stationForm.setData("outlet_id", event.target.value)}
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
                                </div>
                                <button
                                    type="button"
                                    onClick={() => startStationEdit(station)}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Edit Station
                                </button>
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
                                                {device.meta?.paper_width || "80mm"} •{" "}
                                                {device.meta?.template_style || "standard"} •{" "}
                                                {device.meta?.print_copies || 1} copy
                                            </p>
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
                                            <button
                                                type="button"
                                                onClick={() => startDeviceEdit(station, device)}
                                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                            >
                                                Edit Device
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
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
