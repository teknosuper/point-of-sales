import React, { useState } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Input from "@/Components/Dashboard/Input";
import Checkbox from "@/Components/Dashboard/Checkbox";
import PasswordGate from "@/Components/Dashboard/PasswordGate";
import useFlashToast from "@/Hooks/useFlashToast";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconCreditCard,
    IconDeviceFloppy,
    IconBrandStripe,
    IconCash,
    IconQrcode,
    IconTrash,
} from "@/Utils/icons";
import toast from "react-hot-toast";

export default function Payment({
    setting,
    paymentSettingSources = {},
    supportedGateways = [],
    webhookUrls = {},
    webhookWarnings = [],
}) {
    useFlashToast();
    const { activeOutlet } = usePage().props;
    const { can } = useAuthorization();
    const canUpdatePaymentSettings = can("payment-settings-update");

    const { data, setData, post, processing, errors, transform } = useForm({
        default_gateway: setting?.default_gateway ?? "cash",
        bank_transfer_enabled: setting?.bank_transfer_enabled ?? false,
        midtrans_enabled: setting?.midtrans_enabled ?? false,
        midtrans_server_key: "",
        midtrans_client_key: setting?.midtrans_client_key ?? "",
        midtrans_production: setting?.midtrans_production ?? false,
        xendit_enabled: setting?.xendit_enabled ?? false,
        xendit_secret_key: "",
        xendit_public_key: setting?.xendit_public_key ?? "",
        xendit_callback_token: "",
        xendit_production: setting?.xendit_production ?? false,
        qris_enabled: setting?.qris_enabled ?? false,
        qris_static_image: null,
        remove_qris_image: false,
    });

    const [qrisPreview, setQrisPreview] = useState(setting?.qris_static_image || null);

    const handleSubmit = (e) => {
        e.preventDefault();
        transform((payload) => ({
            ...payload,
            _method: "put",
        }));
        post(route("settings.payments.update"), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => toast.success("Konfigurasi payment gateway berhasil disimpan"),
            onError: () => toast.error("Gagal menyimpan. Periksa kembali isian Anda."),
        });
    };

    const isGatewaySelectable = (gateway) => {
        if (gateway === "cash") return true;
        if (gateway === "midtrans") return data.midtrans_enabled;
        if (gateway === "xendit") return data.xendit_enabled;
        if (gateway === "bank_transfer") return data.bank_transfer_enabled;
        if (gateway === "qris") return data.qris_enabled;
        return false;
    };

    const renderSecretHint = (field, keepMessage) => {
        const source = paymentSettingSources?.[field];
        if (!source) return null;
        if (source.managed_by_environment) {
            return (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    Secret dikelola oleh environment dan tidak bisa diubah dari dashboard.
                </p>
            );
        }
        if (source.configured) {
            return (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tersimpan: <span className="font-medium">{source.masked}</span>. {keepMessage}
                </p>
            );
        }
        return null;
    };

    const content = (
        <>
            <Head title="Pengaturan Payment" />

            <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconCreditCard size={24} className="text-primary-500" />
                    Pengaturan Payment Gateway
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Konfigurasi metode pembayaran dan gateway untuk kasir
                </p>
                {activeOutlet?.name && (
                    <p className="mt-2 text-xs font-medium uppercase tracking-wider text-primary-600 dark:text-primary-300">
                        Outlet aktif: {activeOutlet.name}
                    </p>
                )}
            </div>

            <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
                {/* Default Gateway */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <IconCash size={18} />
                        Gateway Default
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                        Gateway yang langsung terpilih saat kasir membuka halaman transaksi.
                    </p>
                    {!canUpdatePaymentSettings && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                            Anda hanya memiliki akses lihat. Perubahan payment settings memerlukan permission update dan konfirmasi password ulang.
                        </div>
                    )}
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Pilih Gateway Default
                        </label>
                        <select
                            value={data.default_gateway}
                            onChange={(e) => setData("default_gateway", e.target.value)}
                            disabled={!canUpdatePaymentSettings}
                            className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        >
                            {supportedGateways.map((gw) => (
                                <option key={gw.value} value={gw.value} disabled={!isGatewaySelectable(gw.value)}>
                                    {gw.label}
                                    {!isGatewaySelectable(gw.value) && " (nonaktif)"}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                            <span className="mt-0.5 shrink-0">*</span>
                            Kasir tetap bisa mengganti metode saat checkout. Gateway yang nonaktif tidak bisa dipilih sebagai default.
                        </p>
                        {errors?.default_gateway && (
                            <small className="text-xs text-danger-500 mt-1">{errors.default_gateway}</small>
                        )}
                    </div>
                </div>

                {/* Bank Transfer */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">🏦 Transfer Bank</h3>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${data.bank_transfer_enabled ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                            <Checkbox checked={data.bank_transfer_enabled} onChange={(e) => setData("bank_transfer_enabled", e.target.checked)} disabled={!canUpdatePaymentSettings} />
                            {data.bank_transfer_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                        Pembayaran manual via transfer bank. Kasir mencatat transaksi pending, lalu admin mengkonfirmasi setelah dana diterima.
                    </p>
                    <a href={route("settings.bank-accounts.index")} className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600 font-medium">
                        Kelola Rekening Bank →
                    </a>
                </div>

                {/* Midtrans */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><IconBrandStripe size={18} /> Midtrans Snap</h3>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${data.midtrans_enabled ? "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                            <Checkbox checked={data.midtrans_enabled} onChange={(e) => setData("midtrans_enabled", e.target.checked)} disabled={!canUpdatePaymentSettings} />
                            {data.midtrans_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <div className={`space-y-4 ${!data.midtrans_enabled ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input label="Server Key" type="password" value={data.midtrans_server_key} onChange={(e) => setData("midtrans_server_key", e.target.value)} errors={errors?.midtrans_server_key}
                                placeholder={paymentSettingSources?.midtrans_server_key?.configured ? "Kosongkan untuk mempertahankan nilai saat ini" : "SB-Mid-server-xxx"}
                                disabled={!canUpdatePaymentSettings || paymentSettingSources?.midtrans_server_key?.managed_by_environment}
                                hintText="Server Key dari dashboard Midtrans." />
                            <Input label="Client Key" type="text" value={data.midtrans_client_key} onChange={(e) => setData("midtrans_client_key", e.target.value)} errors={errors?.midtrans_client_key} placeholder="SB-Mid-client-xxx" disabled={!canUpdatePaymentSettings} hintText="Client Key dari dashboard Midtrans." />
                        </div>
                        {renderSecretHint("midtrans_server_key", "Isi ulang hanya jika ingin mengganti secret.")}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={data.midtrans_production} onChange={(e) => setData("midtrans_production", e.target.checked)} disabled={!canUpdatePaymentSettings} />
                            <span className="text-sm text-slate-600 dark:text-slate-400">Mode Produksi</span>
                        </label>
                    </div>
                </div>

                {/* Xendit */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"><IconCreditCard size={18} /> Xendit Invoice</h3>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${data.xendit_enabled ? "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                            <Checkbox checked={data.xendit_enabled} onChange={(e) => setData("xendit_enabled", e.target.checked)} disabled={!canUpdatePaymentSettings} />
                            {data.xendit_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <div className={`space-y-4 ${!data.xendit_enabled ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input label="Secret Key" type="password" value={data.xendit_secret_key} onChange={(e) => setData("xendit_secret_key", e.target.value)} errors={errors?.xendit_secret_key}
                                placeholder={paymentSettingSources?.xendit_secret_key?.configured ? "Kosongkan untuk mempertahankan nilai saat ini" : "xnd_development_xxx"}
                                disabled={!canUpdatePaymentSettings || paymentSettingSources?.xendit_secret_key?.managed_by_environment}
                                hintText="Secret Key dari dashboard Xendit." />
                            <Input label="Public Key" type="text" value={data.xendit_public_key} onChange={(e) => setData("xendit_public_key", e.target.value)} errors={errors?.xendit_public_key} placeholder="xnd_public_development_xxx" disabled={!canUpdatePaymentSettings} hintText="Public Key dari dashboard Xendit." />
                        </div>
                        {renderSecretHint("xendit_secret_key", "Isi ulang hanya jika ingin mengganti secret.")}
                        <Input label="Callback Token" type="password" value={data.xendit_callback_token} onChange={(e) => setData("xendit_callback_token", e.target.value)} errors={errors?.xendit_callback_token}
                            placeholder={paymentSettingSources?.xendit_callback_token?.configured ? "Kosongkan untuk mempertahankan nilai saat ini" : "xendit-callback-token"}
                            disabled={!canUpdatePaymentSettings || paymentSettingSources?.xendit_callback_token?.managed_by_environment}
                            hintText="Callback Token untuk verifikasi webhook Xendit." />
                        {renderSecretHint("xendit_callback_token", "Isi ulang hanya jika ingin mengganti token.")}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={data.xendit_production} onChange={(e) => setData("xendit_production", e.target.checked)} disabled={!canUpdatePaymentSettings} />
                            <span className="text-sm text-slate-600 dark:text-slate-400">Mode Produksi</span>
                        </label>
                    </div>
                </div>

                {/* QRIS */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconQrcode size={18} className="text-slate-600" />
                            QRIS Static
                        </h3>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${data.qris_enabled ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                            <Checkbox checked={data.qris_enabled} onChange={(e) => setData("qris_enabled", e.target.checked)} disabled={!canUpdatePaymentSettings} />
                            {data.qris_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                        Pembayaran manual via scan QRIS static. Kasir menampilkan QR code, pelanggan scan via aplikasi pembayaran, kasir mengkonfirmasi setelah pembayaran diterima.
                    </p>
                    <div className={`space-y-4 ${!data.qris_enabled ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="flex items-start gap-4">
                            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                {qrisPreview ? (
                                    <img src={qrisPreview} alt="QRIS" className="w-full h-full object-contain" onError={() => setQrisPreview(null)} />
                                ) : (
                                    <IconQrcode size={48} className="text-slate-300" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <input type="file" accept="image/*" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setData("qris_static_image", file);
                                        setData("remove_qris_image", false);
                                        setQrisPreview(URL.createObjectURL(file));
                                    }
                                }} className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-primary-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-950/30 dark:file:text-primary-300" disabled={!canUpdatePaymentSettings} />
                                {qrisPreview && (
                                    <button type="button" onClick={() => {
                                        setQrisPreview(null);
                                        setData("qris_static_image", null);
                                        setData("remove_qris_image", true);
                                    }} className="inline-flex items-center gap-1 text-xs text-danger-500 hover:text-danger-600" disabled={!canUpdatePaymentSettings}>
                                        <IconTrash size={12} /> Hapus gambar QRIS
                                    </button>
                                )}
                            </div>
                        </div>
                        {errors?.qris_static_image && (
                            <p className="text-xs text-danger-500">{errors.qris_static_image}</p>
                        )}
                    </div>
                </div>

                {/* Webhook URLs Info */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">🔗 Webhook URLs</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Salin dan tempel URL berikut ke dashboard Midtrans/Xendit sebagai Notification/Callback URL.
                    </p>
                    {webhookWarnings.length > 0 && (
                        <div className="mb-4 space-y-2">
                            {webhookWarnings.map((warning) => (
                                <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">{warning}</div>
                            ))}
                        </div>
                    )}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Midtrans Notification URL</label>
                            <div className="flex items-center gap-2">
                                <input type="text" readOnly value={webhookUrls.midtrans || ""} className="flex-1 h-10 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400" />
                                <button type="button" onClick={() => { navigator.clipboard.writeText(webhookUrls.midtrans || ""); toast.success("URL disalin!"); }} className="px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Salin</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Xendit Callback URL</label>
                            <div className="flex items-center gap-2">
                                <input type="text" readOnly value={webhookUrls.xendit || ""} className="flex-1 h-10 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400" />
                                <button type="button" onClick={() => { navigator.clipboard.writeText(webhookUrls.xendit || ""); toast.success("URL disalin!"); }} className="px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Salin</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                    <button type="submit" disabled={processing || !canUpdatePaymentSettings} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                        <IconDeviceFloppy size={18} />
                        {processing ? "Menyimpan..." : "Simpan Konfigurasi"}
                    </button>
                </div>
            </form>
        </>
    );

    return (
        <PasswordGate label="pengaturan payment gateway">
            {content}
        </PasswordGate>
    );
}

Payment.layout = (page) => <DashboardLayout children={page} />;
