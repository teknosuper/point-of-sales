import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, useForm, usePage } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import useFlashToast from "@/Hooks/useFlashToast";
import { useAuthorization } from "@/Utils/authorization";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import {
    IconBuildingStore,
    IconChecklist,
    IconChevronDown,
    IconChevronRight,
    IconDeviceFloppy,
    IconPhone,
    IconMapPin,
    IconWorld,
    IconMail,
    IconPhoto,
    IconPercentage,
} from "@/Utils/icons";
import {
    IMAGE_UPLOAD_ACCEPT,
    prepareImageUpload,
} from "@/Utils/imageUpload";

export default function Store({ settings, tenantOutlets = [] }) {
    useFlashToast();
    const { can } = useAuthorization();
    const canAccessDataRepair = can("business-settings-access");
    const [showTenantCommissions, setShowTenantCommissions] = useState(false);
    const initialTenantCommissions = tenantOutlets.reduce((acc, outlet) => {
        acc[outlet.id] = outlet.commission_rate_percent ?? 0;
        return acc;
    }, {});

    const { data, setData, post, processing, errors, reset } = useForm({
        store_name: settings.store_name || "",
        store_logo: null,
        store_address: settings.store_address || "",
        store_phone: settings.store_phone || "",
        store_email: settings.store_email || "",
        store_website: settings.store_website || "",
        store_city: settings.store_city || "",
        tenant_commissions: initialTenantCommissions,
    });

    const [logoPreview, setLogoPreview] = useState(settings.store_logo || null);
    const [logoError, setLogoError] = useState("");

    useEffect(() => {
        return () => {
            if (logoPreview && logoPreview.startsWith("blob:")) {
                URL.revokeObjectURL(logoPreview);
            }
        };
    }, [logoPreview]);

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.store.update"), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Profil toko berhasil disimpan");
                reset("store_logo");
            },
            onError: () => toast.error("Gagal menyimpan profil toko. Periksa kembali isian Anda."),
        });
    };

    const setCommission = (outletId, value) => {
        setData("tenant_commissions", {
            ...data.tenant_commissions,
            [outletId]: value,
        });
    };

    return (
        <>
            <Head title="Profil Toko" />

            <div className="space-y-5">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        Profil Toko
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Identitas toko yang tampil di struk, invoice, dan laporan.
                    </p>
                </div>
                {canAccessDataRepair ? (
                    <div className="flex justify-start">
                        <Link
                            href={route("settings.data-repair")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconChecklist size={18} />
                            Buka Data Repair
                        </Link>
                    </div>
                ) : null}

                <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Logo */}
                        <div className="lg:w-1/4">
                            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <IconPhoto size={18} />
                                Logo Toko
                                <span className="text-xs font-normal text-slate-400">(opsional)</span>
                            </label>
                            <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden mb-3">
                                {logoPreview ? (
                                    <img
                                        src={logoPreview}
                                        alt="Logo"
                                        className="w-full h-full object-cover"
                                        onError={() => setLogoPreview(null)}
                                    />
                                ) : (
                                    <IconBuildingStore size={32} className="text-slate-300" />
                                )}
                            </div>
                            <input
                                type="file"
                                accept={IMAGE_UPLOAD_ACCEPT}
                                onChange={async (e) => {
                                    const file = e.target.files[0];

                                    if (!file) {
                                        setData("store_logo", null);
                                        setLogoError("");
                                        return;
                                    }

                                    const result = await prepareImageUpload(file);

                                    if (!result.ok) {
                                        setData("store_logo", null);
                                        setLogoError(result.error);
                                        toast.error(result.error);
                                        return;
                                    }

                                    setLogoError("");
                                    setData("store_logo", result.file);
                                    setLogoPreview(URL.createObjectURL(result.file));
                                }}
                                className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-primary-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-950/30 dark:file:text-primary-300"
                            />
                            <p className="mt-1.5 text-[11px] text-slate-400 flex items-start gap-1">
                                <span className="mt-0.5">*</span>
                                Format JPG/PNG, maks 2MB.
                            </p>
                            {(logoError || errors.store_logo) && (
                                <p className="text-xs text-danger-500 mt-1">
                                    {logoError || errors.store_logo}
                                </p>
                            )}
                        </div>

                        {/* Info fields */}
                        <div className="lg:flex-1 space-y-4">
                            <Input
                                label="Nama Toko"
                                required
                                value={data.store_name}
                                errors={errors.store_name}
                                onChange={(e) => setData("store_name", e.target.value)}
                                placeholder="Nama resmi toko Anda"
                                hintText="Nama ini akan muncul di setiap struk, invoice, dan laporan. Sebaiknya gunakan nama resmi usaha."
                            />

                            <Textarea
                                label="Alamat Lengkap"
                                required
                                value={data.store_address}
                                errors={errors.store_address}
                                onChange={(e) => setData("store_address", e.target.value)}
                                rows={3}
                                placeholder="Jalan, kelurahan, kecamatan, kode pos"
                                hintText="Alamat lengkap untuk keperluan invoice dan pengiriman dokumen."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Kota/Kabupaten"
                                    value={data.store_city}
                                    errors={errors.store_city}
                                    onChange={(e) => setData("store_city", e.target.value)}
                                    placeholder="contoh: Surabaya"
                                    icon={<IconMapPin size={16} />}
                                    hintText="Isi kota atau kabupaten lokasi toko."
                                />
                                <Input
                                    label="Nomor Telepon"
                                    value={data.store_phone}
                                    errors={errors.store_phone}
                                    onChange={(e) => setData("store_phone", e.target.value)}
                                    placeholder="0812xxxxxxx"
                                    icon={<IconPhone size={16} />}
                                    hintText="Nomor yang bisa dihubungi pelanggan atau mitra."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Email"
                                    type="email"
                                    value={data.store_email}
                                    errors={errors.store_email}
                                    onChange={(e) => setData("store_email", e.target.value)}
                                    placeholder="email@toko.com"
                                    icon={<IconMail size={16} />}
                                    hintText="Email untuk kontak bisnis dan notifikasi."
                                />
                                <Input
                                    label="Website / Sosial Media"
                                    value={data.store_website}
                                    errors={errors.store_website}
                                    onChange={(e) => setData("store_website", e.target.value)}
                                    placeholder="https://"
                                    icon={<IconWorld size={16} />}
                                    hintText="Link website, Instagram, atau marketplace."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tenant Commissions */}
                    {tenantOutlets.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                            <button
                                type="button"
                                onClick={() => setShowTenantCommissions((v) => !v)}
                                className="flex w-full items-center justify-between gap-3"
                            >
                                <div className="text-left">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Komisi Tenant
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Atur persentase komisi untuk tiap tenant.
                                    </p>
                                </div>
                                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                    {showTenantCommissions ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                    {showTenantCommissions ? "Sembunyikan" : "Lihat"}
                                </span>
                            </button>

                            {showTenantCommissions && (
                                <div className="mt-4 space-y-3">
                                    {tenantOutlets.map((outlet) => (
                                        <div
                                            key={outlet.id}
                                            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1.5fr,0.8fr]"
                                        >
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {outlet.name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {outlet.code || `Outlet #${outlet.id}`}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    <IconPercentage size={14} />
                                                    Komisi Pengelola
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        value={
                                                            data.tenant_commissions[
                                                                outlet.id
                                                            ] ?? 0
                                                        }
                                                        onChange={(e) =>
                                                            setCommission(
                                                                outlet.id,
                                                                e.target.value
                                                            )
                                                        }
                                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-10 text-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                    />
                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                                                        %
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[11px] text-slate-400 flex items-start gap-1">
                                                    <span className="mt-0.5">*</span>
                                                    Persentase dari omzet tenant. Range 0–100%.
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
                        >
                            <IconDeviceFloppy size={18} />
                            {processing ? "Menyimpan..." : "Simpan Profil"}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

Store.layout = (page) => <DashboardLayout children={page} />;
