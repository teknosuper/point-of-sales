import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import InputSelect from "@/Components/Dashboard/InputSelect";
import toast from "react-hot-toast";
import {
    IMAGE_UPLOAD_ACCEPT,
    prepareImageUpload,
} from "@/Utils/imageUpload";
import {
    IconPackage,
    IconDeviceFloppy,
    IconArrowLeft,
    IconArrowRight,
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconToolsKitchen2,
    IconSparkles,
    IconCheck,
    IconAlertCircle,
    IconX,
    IconBuildingStore,
    IconCategory,
    IconInfoCircle,
} from "@/Utils/icons";
import ModifierBuilder from "./Partials/ModifierBuilder";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const previewAutoSku = (sku, barcode, title) => {
    const source = String(sku || barcode || title || "SKU")
        .toUpperCase()
        .normalize("NFKD")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

    return source || "SKU";
};

export default function Create({
    categories = [],
    tenantOutlets = [],
    autoKitchenStations = [],
    workspace = {},
    tenantDefaultMarkup = 3000,
    toppingMarkupSettings = {},
}) {
    const { errors } = usePage().props;
    const isTenantWorkspace = workspace?.is_tenant === true;
    const defaultTenantOutletId = workspace?.active_outlet_id || "";

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedImageName, setSelectedImageName] = useState("");
    const [localErrors, setLocalErrors] = useState({});
    const [showAdvancedCodes, setShowAdvancedCodes] = useState(false);

    const { data, setData, post, processing } = useForm({
        image: "",
        barcode: "",
        sku: "",
        title: "",
        category_id: "",
        tenant_outlet_id: "",
        description: "",
        tenant_hpp_price: "",
        buy_price: "",
        sell_price: "",
        stock: "",
        supports_modifiers: false,
        requires_modifier_selection: false,
        modifier_options: [],
    });

    const effectiveOutletSellPrice = useMemo(
        () => Math.max(0, Number(data.buy_price || 0) + Number(tenantDefaultMarkup || 0)),
        [data.buy_price, tenantDefaultMarkup]
    );

    const autoProductCodePreview = useMemo(
        () => previewAutoSku("", "", data.title || "FC-PRODUCT"),
        [data.title]
    );

    const autoSkuPreview = previewAutoSku(data.sku, data.barcode, data.title);

    const selectedTenantOutlet = useMemo(
        () =>
            tenantOutlets.find(
                (outlet) => String(outlet.id) === String(data.tenant_outlet_id)
            ) || null,
        [data.tenant_outlet_id, tenantOutlets]
    );

    const availableCategories = useMemo(
        () =>
            categories.filter(
                (category) =>
                    String(category.tenant_outlet_id || "") ===
                    String(data.tenant_outlet_id || "")
            ),
        [categories, data.tenant_outlet_id]
    );

    const autoKitchenStation = useMemo(() => {
        const selectedOutletId = Number(data.tenant_outlet_id || 0);

        if (selectedOutletId > 0) {
            return (
                autoKitchenStations.find(
                    (item) => Number(item.outlet_id) === selectedOutletId
                ) || null
            );
        }

        return autoKitchenStations[0] || null;
    }, [autoKitchenStations, data.tenant_outlet_id]);

    const setSelectedCategoryHandler = (value) => {
        setSelectedCategory(value);
        setData("category_id", value?.id || "");
    };

    useEffect(() => {
        if (!data.category_id) {
            setSelectedCategory(null);
            return;
        }

        const matchedCategory =
            availableCategories.find(
                (category) => String(category.id) === String(data.category_id)
            ) || null;

        setSelectedCategory(matchedCategory);

        if (!matchedCategory) {
            setData("category_id", "");
        }
    }, [availableCategories, data.category_id, setData]);

    useEffect(() => {
        if (!isTenantWorkspace) {
            return;
        }

        if (String(data.tenant_outlet_id || "") !== String(defaultTenantOutletId || "")) {
            setData("tenant_outlet_id", String(defaultTenantOutletId || ""));
        }

        if (String(data.sell_price || "") !== String(effectiveOutletSellPrice)) {
            setData("sell_price", String(effectiveOutletSellPrice));
        }
    }, [
        data.sell_price,
        data.tenant_outlet_id,
        defaultTenantOutletId,
        effectiveOutletSellPrice,
        isTenantWorkspace,
        setData,
    ]);

    const handleImageChange = async (e) => {
        const file = e.target.files[0];

        if (!file) {
            setData("image", "");
            setSelectedImageName("");
            setImagePreview(null);
            setLocalErrors((current) => ({ ...current, image: "" }));
            return;
        }

        const result = await prepareImageUpload(file);

        if (!result.ok) {
            setData("image", "");
            setSelectedImageName("");
            setImagePreview(null);
            setLocalErrors((current) => ({ ...current, image: result.error }));
            toast.error(result.error);
            return;
        }

        setLocalErrors((current) => ({ ...current, image: "" }));
        setSelectedImageName(result.file.name);
        setData("image", result.file);
        setImagePreview(URL.createObjectURL(result.file));
    };

    const handleRemoveImage = () => {
        setData("image", "");
        setSelectedImageName("");
        setImagePreview(null);
        setLocalErrors((current) => ({ ...current, image: "" }));
    };

    // Deteksi Error per Step untuk Badge Merah
    const stepErrors = useMemo(() => {
        const allKeys = Object.keys(errors || {});
        const step1Keys = ["image", "title", "category_id", "tenant_outlet_id", "description", "barcode", "sku"];
        const step2Keys = ["tenant_hpp_price", "buy_price", "sell_price", "stock"];
        const step4Keys = ["supports_modifiers", "requires_modifier_selection", "modifier_options"];

        return {
            step1: allKeys.filter((k) => step1Keys.includes(k) || localErrors.image).length,
            step2: allKeys.filter((k) => step2Keys.includes(k)).length,
            step3: 0,
            step4: allKeys.filter((k) => step4Keys.includes(k) || k.startsWith("modifier_options.")).length,
        };
    }, [errors, localErrors]);

    // Deteksi Status Selesai per Step
    const stepCompleted = useMemo(() => {
        return {
            step1: Boolean(data.title && data.category_id),
            step2: Boolean(data.buy_price !== "" && (isTenantWorkspace || data.sell_price !== "") && data.stock !== ""),
            step3: true,
            step4: data.supports_modifiers ? (data.modifier_options?.length || 0) > 0 : true,
        };
    }, [data, isTenantWorkspace]);

    const submit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        if (localErrors.image) {
            toast.error(localErrors.image);
            setCurrentStep(1);
            return;
        }

        if (!data.title) {
            toast.error("Nama produk wajib diisi");
            setCurrentStep(1);
            return;
        }

        if (!data.category_id) {
            toast.error("Kategori produk wajib dipilih");
            setCurrentStep(1);
            return;
        }

        post(route("products.store"), {
            forceFormData: true,
            onSuccess: () => toast.success("Produk berhasil ditambahkan!"),
            onError: () => {
                toast.error("Gagal menyimpan produk. Periksa kembali form yang bertanda merah.");
                if (stepErrors.step1 > 0) setCurrentStep(1);
                else if (stepErrors.step2 > 0) setCurrentStep(2);
                else if (stepErrors.step4 > 0) setCurrentStep(4);
            },
        });
    };

    const STEPS = [
        { id: 1, title: "Info & Kategori", subtitle: "Nama, foto & kategori", icon: IconPackage },
        { id: 2, title: "Harga & Stok", subtitle: "Modal, jual & stok", icon: IconCurrencyDollar },
        { id: 3, title: "Dapur & Station", subtitle: "Aliran pesanan", icon: IconToolsKitchen2 },
        { id: 4, title: "Topping & Varian", subtitle: "Add-on & pilihan rasa", icon: IconSparkles },
    ];

    return (
        <DashboardLayout>
            <Head title="Tambah Produk Baru" />

            <div className="mx-auto max-w-7xl pb-16">
                {/* Header Atas */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Link
                            href={route("products.index")}
                            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-primary-600 transition mb-2"
                        >
                            <IconArrowLeft size={16} />
                            Kembali ke Daftar Menu
                        </Link>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md shadow-primary-500/20">
                                <IconPackage size={20} />
                            </span>
                            Tambah Menu Baru
                        </h1>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Lengkapi informasi menu langkah demi langkah atau langsung simpan kapan saja.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Button
                            type="button"
                            onClick={submit}
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-primary-600/25 transition hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60"
                        >
                            <IconDeviceFloppy size={18} />
                            <span>{processing ? "Menyimpan..." : "Simpan Produk"}</span>
                        </Button>
                    </div>
                </div>

                {/* Modern Stepper Header */}
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {STEPS.map((step) => {
                            const IconComponent = step.icon;
                            const isActive = currentStep === step.id;
                            const isDone = stepCompleted[`step${step.id}`];
                            const errorCount = stepErrors[`step${step.id}`] || 0;

                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setCurrentStep(step.id)}
                                    className={`relative flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                                        isActive
                                            ? "bg-primary-50 border border-primary-200 shadow-sm dark:bg-primary-950/40 dark:border-primary-900/60"
                                            : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                    }`}
                                >
                                    <div
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                                            errorCount > 0
                                                ? "bg-red-500 text-white"
                                                : isActive
                                                ? "bg-primary-600 text-white shadow-md shadow-primary-500/25"
                                                : isDone
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        }`}
                                    >
                                        {errorCount > 0 ? (
                                            <IconAlertCircle size={20} />
                                        ) : isDone && !isActive ? (
                                            <IconCheck size={20} />
                                        ) : (
                                            <IconComponent size={20} />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p
                                                className={`text-xs font-bold truncate ${
                                                    isActive
                                                        ? "text-primary-700 dark:text-primary-300"
                                                        : "text-slate-800 dark:text-slate-200"
                                                }`}
                                            >
                                                Langkah {step.id}: {step.title}
                                            </p>
                                            {errorCount > 0 && (
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                                    {errorCount}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {step.subtitle}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Grid Form Utama & Live Preview */}
                <form onSubmit={submit}>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Kolom Kiri: Form Wizard Sesuai Step Aktif (8 Kolom) */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* STEP 1: INFO DASAR & KATEGORI */}
                            {currentStep === 1 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconPackage size={20} className="text-primary-600" />
                                            Langkah 1: Identitas & Kategori Menu
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Tentukan nama menu, foto yang memikat pelanggan, dan kelompok kategorinya.
                                        </p>
                                    </div>

                                    {/* Upload Foto Produk Modern */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                                            Foto Menu
                                        </label>
                                        <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border-2 border-dashed border-slate-300 p-4 transition hover:border-primary-400 dark:border-slate-700 dark:bg-slate-800/20">
                                            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-inner flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                                {imagePreview ? (
                                                    <>
                                                        <img
                                                            src={imagePreview}
                                                            alt="Preview"
                                                            className="h-full w-full object-cover"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveImage}
                                                            title="Hapus Foto"
                                                            className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1 text-white shadow-md hover:bg-red-700 transition"
                                                        >
                                                            <IconX size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                                        <IconPhoto size={36} />
                                                        <span className="text-[10px] mt-1 font-semibold">Belum Ada</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 space-y-2 text-center sm:text-left">
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100 dark:bg-primary-950/60 dark:text-primary-300 transition">
                                                        <IconPhoto size={16} />
                                                        <span>{imagePreview ? "Ganti Foto" : "Pilih Foto Menu"}</span>
                                                        <input
                                                            type="file"
                                                            accept={IMAGE_UPLOAD_ACCEPT}
                                                            onChange={handleImageChange}
                                                            className="sr-only"
                                                        />
                                                    </label>
                                                    {imagePreview && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveImage}
                                                            className="text-xs font-semibold text-red-500 hover:underline"
                                                        >
                                                            Hapus Foto
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    Format JPG, PNG, WEBP. Maks 2MB. Gambar dikompres otomatis demi performa POS cepat.
                                                </p>
                                                {(localErrors.image || errors.image) && (
                                                    <p className="text-xs font-semibold text-red-500">
                                                        {localErrors.image || errors.image}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tenant Outlet (Jika Bukan Tenant Workspace) */}
                                    {!isTenantWorkspace && (
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                                Outlet / Tenant Pemilik
                                            </label>
                                            <select
                                                value={data.tenant_outlet_id}
                                                onChange={(e) => {
                                                    setData("tenant_outlet_id", e.target.value);
                                                    setData("category_id", "");
                                                    setSelectedCategory(null);
                                                }}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            >
                                                <option value="">Global / Owner Outlet (Menu Milik Pusat)</option>
                                                {tenantOutlets.map((outlet) => (
                                                    <option key={outlet.id} value={outlet.id}>
                                                        {outlet.code} - {outlet.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.tenant_outlet_id && (
                                                <p className="mt-1 text-xs text-red-500">{errors.tenant_outlet_id}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Nama Produk */}
                                    <div>
                                        <Input
                                            type="text"
                                            label="Nama Menu / Produk *"
                                            value={data.title}
                                            onChange={(e) => setData("title", e.target.value)}
                                            errors={errors.title}
                                            placeholder="Contoh: Nasi Goreng Spesial / Kopi Susu Aren"
                                        />
                                    </div>

                                    {/* Kategori Menu */}
                                    <div>
                                        <InputSelect
                                            label="Kategori Menu *"
                                            data={availableCategories}
                                            selected={selectedCategory}
                                            setSelected={setSelectedCategoryHandler}
                                            placeholder={
                                                data.tenant_outlet_id
                                                    ? "Pilih kategori milik tenant"
                                                    : "Pilih kategori menu"
                                            }
                                            errors={errors.category_id}
                                            searchable={true}
                                            displayKey="name"
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            {availableCategories.length > 0
                                                ? `${availableCategories.length} kategori tersedia.`
                                                : "Belum ada kategori untuk konteks ini. Silakan buat kategori terlebih dahulu."}
                                        </p>
                                    </div>

                                    {/* Deskripsi */}
                                    <div>
                                        <Textarea
                                            label="Deskripsi Menu (Opsional)"
                                            placeholder="Jelaskan bahan, rasa, atau catatan khusus tentang menu ini..."
                                            errors={errors.description}
                                            onChange={(e) => setData("description", e.target.value)}
                                            value={data.description}
                                            rows={2}
                                        />
                                    </div>

                                    {/* Pengaturan Lanjutan: Barcode & SKU (Collapsible Ringkas) */}
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedCodes((v) => !v)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600 transition"
                                        >
                                            <IconBarcode size={16} />
                                            <span>
                                                {showAdvancedCodes
                                                    ? "Sembunyikan Pengaturan Barcode & SKU"
                                                    : "+ Atur Barcode & SKU Manual (Opsional)"}
                                            </span>
                                        </button>

                                        {showAdvancedCodes && (
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                                                {isTenantWorkspace ? (
                                                    <div className="sm:col-span-2 text-xs text-slate-500">
                                                        Barcode & SKU otomatis digenerate dari kode tenant & nama produk:{" "}
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {autoProductCodePreview}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Input
                                                            type="text"
                                                            label="Barcode"
                                                            value={data.barcode}
                                                            onChange={(e) => setData("barcode", e.target.value)}
                                                            errors={errors.barcode}
                                                            placeholder="Kosongkan untuk otomatis"
                                                        />
                                                        <Input
                                                            type="text"
                                                            label="SKU"
                                                            value={data.sku}
                                                            onChange={(e) => setData("sku", e.target.value)}
                                                            errors={errors.sku}
                                                            placeholder="Kosongkan untuk otomatis"
                                                        />
                                                        <p className="sm:col-span-2 text-[11px] text-slate-500">
                                                            Preview kode otomatis:{" "}
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                                {autoSkuPreview}
                                                            </span>
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: HARGA & STOK */}
                            {currentStep === 2 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconCurrencyDollar size={20} className="text-primary-600" />
                                            Langkah 2: Harga 3 Level & Stok Awal
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Kelola harga pokok modal (HPP), harga beli tenant, harga jual di kasir, dan persediaan stok.
                                        </p>
                                    </div>

                                    {/* Grid Input Harga */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <Input
                                            type="number"
                                            label="HPP Tenant (Biaya Modal) *"
                                            value={data.tenant_hpp_price}
                                            onChange={(e) => setData("tenant_hpp_price", e.target.value)}
                                            errors={errors.tenant_hpp_price}
                                            placeholder="0"
                                        />

                                        <Input
                                            type="number"
                                            label="Harga Beli dari Tenant *"
                                            value={data.buy_price}
                                            onChange={(e) => setData("buy_price", e.target.value)}
                                            errors={errors.buy_price}
                                            placeholder="0"
                                        />

                                        {isTenantWorkspace ? (
                                            <div className="rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-2.5 dark:border-primary-900/50 dark:bg-primary-950/20">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                                                    Harga Jual Kasir (Auto)
                                                </p>
                                                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                                    {formatCurrency(effectiveOutletSellPrice)}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    Harga Beli + Markup Rp {Number(tenantDefaultMarkup || 0).toLocaleString("id-ID")}
                                                </p>
                                            </div>
                                        ) : (
                                            <Input
                                                type="number"
                                                label="Harga Jual Kasir / POS *"
                                                value={data.sell_price}
                                                onChange={(e) => setData("sell_price", e.target.value)}
                                                errors={errors.sell_price}
                                                placeholder="0"
                                            />
                                        )}
                                    </div>

                                    {/* Visual Margin Calculator Card */}
                                    {(Number(data.tenant_hpp_price || 0) > 0 ||
                                        Number(data.buy_price || 0) > 0 ||
                                        Number(data.sell_price || effectiveOutletSellPrice || 0) > 0) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                                                    <IconCurrencyDollar size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                                        Margin Tenant per Porsi
                                                    </p>
                                                    <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                                                        +{" "}
                                                        {formatCurrency(
                                                            Math.max(
                                                                0,
                                                                Number(data.buy_price || 0) -
                                                                    Number(
                                                                        data.tenant_hpp_price ||
                                                                            data.buy_price ||
                                                                            0
                                                                    )
                                                            )
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                                                    <IconBuildingStore size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                                                        Margin Kasir Outlet per Porsi
                                                    </p>
                                                    <p className="text-lg font-extrabold text-teal-700 dark:text-teal-400">
                                                        +{" "}
                                                        {formatCurrency(
                                                            Math.max(
                                                                0,
                                                                Number(
                                                                    isTenantWorkspace
                                                                        ? effectiveOutletSellPrice
                                                                        : data.sell_price || 0
                                                                ) - Number(data.buy_price || 0)
                                                            )
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Input Stok */}
                                    <div className="pt-2">
                                        <Input
                                            type="number"
                                            label="Stok Awal Produk *"
                                            value={data.stock}
                                            onChange={(e) => setData("stock", e.target.value)}
                                            errors={errors.stock}
                                            placeholder="Contoh: 50"
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Jumlah persediaan yang siap dijual. Pengurangan stok akan dicatat otomatis setiap transaksi berhasil.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: DAPUR & PENYAJIAN */}
                            {currentStep === 3 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconToolsKitchen2 size={20} className="text-primary-600" />
                                            Langkah 3: Dapur & Aliran Tiket Pesanan
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Informasi stasiun dapur tujuan untuk cetak struk masak dan Kitchen Display System (KDS).
                                        </p>
                                    </div>

                                    {/* Stasiun Dapur Auto-mapping Card */}
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                                        <div className="flex items-start gap-3.5">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                                                <IconToolsKitchen2 size={22} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    Stasiun Dapur Tujuan (Kitchen Station)
                                                </h4>
                                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                                    {autoKitchenStation
                                                        ? `Pesanan menu ini otomatis diarahkan ke stasiun: "${autoKitchenStation.station_name}"${
                                                              autoKitchenStation.station_code
                                                                  ? ` [${autoKitchenStation.station_code}]`
                                                                  : ""
                                                          }.`
                                                        : "Belum ada stasiun dapur aktif untuk outlet ini. Pesanan akan masuk ke tiket umum kasir."}
                                                </p>
                                                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                                    <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                                    <span>Terhubung otomatis dengan sistem Kitchen Dispatch POS</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ringkasan Konteks Outlet */}
                                    <div className="rounded-xl border border-slate-200 p-4 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-slate-500">Konteks Outlet:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {isTenantWorkspace
                                                    ? "Tenant Outlet Aktif"
                                                    : selectedTenantOutlet
                                                    ? `${selectedTenantOutlet.name} (${selectedTenantOutlet.code})`
                                                    : "Global / Multi-Tenant"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-slate-500">Kategori Menu:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {selectedCategory?.name || "Belum dipilih"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: TOPPING & VARIAN (ROMBAK TOTAL) */}
                            {currentStep === 4 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconSparkles size={20} className="text-primary-600" />
                                            Langkah 4: Pengaturan Topping, Varian & Add-on
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Kelola kelompok varian dengan sangat mudah menggunakan builder visual modern di bawah ini.
                                        </p>
                                    </div>

                                    <ModifierBuilder
                                        supportsModifiers={data.supports_modifiers}
                                        setSupportsModifiers={(val) => setData("supports_modifiers", val)}
                                        requiresModifierSelection={data.requires_modifier_selection}
                                        setRequiresModifierSelection={(val) =>
                                            setData("requires_modifier_selection", val)
                                        }
                                        modifierOptions={data.modifier_options}
                                        onChangeModifierOptions={(newOptions) =>
                                            setData("modifier_options", newOptions)
                                        }
                                        toppingMarkupSettings={toppingMarkupSettings}
                                        disabled={false}
                                    />
                                </div>
                            )}

                            {/* Navigasi Stepper Bawah (Previous / Next / Submit) */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <div>
                                    {currentStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep((curr) => Math.max(1, curr - 1))}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                                        >
                                            <IconArrowLeft size={16} />
                                            Sebelumnya
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2.5">
                                    {currentStep < 4 ? (
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep((curr) => Math.min(4, curr + 1))}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition"
                                        >
                                            <span>Lanjut ke Langkah {currentStep + 1}</span>
                                            <IconArrowRight size={16} />
                                        </button>
                                    ) : (
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-primary-600/25 transition hover:bg-primary-700 active:scale-[0.98]"
                                        >
                                            <IconDeviceFloppy size={18} />
                                            <span>{processing ? "Menyimpan..." : "Selesai & Simpan Produk"}</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Kolom Kanan: Live Product Preview Card & Summary (4 Kolom Sticky) */}
                        <div className="lg:col-span-4 sticky top-6 space-y-6">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Live Preview Menu
                                    </h4>
                                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                                        Tampilan POS
                                    </span>
                                </div>

                                {/* Preview Card Layaknya di POS */}
                                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md dark:border-slate-800 dark:bg-slate-800/60">
                                    <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                        {imagePreview ? (
                                            <img
                                                src={imagePreview}
                                                alt="Preview Menu"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-center p-4 text-slate-400">
                                                <IconPhoto size={40} className="mx-auto mb-1" />
                                                <span className="text-[11px] font-medium">Foto Menu</span>
                                            </div>
                                        )}

                                        {/* Badge Kategori Mengambang */}
                                        <div className="absolute left-3 top-3">
                                            <span className="rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-white">
                                                {selectedCategory?.name || "Kategori"}
                                            </span>
                                        </div>

                                        {/* Badge Stok */}
                                        <div className="absolute right-3 top-3">
                                            <span
                                                className={`rounded-lg px-2 py-1 text-[10px] font-bold backdrop-blur-md ${
                                                    Number(data.stock || 0) > 0
                                                        ? "bg-emerald-600/90 text-white"
                                                        : "bg-red-600/90 text-white"
                                                }`}
                                            >
                                                Stok: {data.stock !== "" ? data.stock : "0"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-2.5">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                                                {data.title || "Nama Menu Anda"}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                                {data.description || "Deskripsi singkat tentang menu lezat ini..."}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-slate-400">
                                                    Harga Jual
                                                </p>
                                                <p className="text-lg font-extrabold text-primary-600 dark:text-primary-400">
                                                    {formatCurrency(
                                                        isTenantWorkspace
                                                            ? effectiveOutletSellPrice
                                                            : data.sell_price || 0
                                                    )}
                                                </p>
                                            </div>

                                            {data.supports_modifiers && (
                                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                                    + {data.modifier_options?.length || 0} Topping
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Ringkasan Cepat Form */}
                                <div className="mt-4 space-y-2 text-xs">
                                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">Kategori:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {selectedCategory?.name || "-"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">Harga Beli:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {formatCurrency(data.buy_price || 0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">Varian / Topping:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {data.supports_modifiers
                                                ? `${data.modifier_options?.length || 0} Opsi`
                                                : "Tidak Aktif"}
                                        </span>
                                    </div>
                                </div>

                                {/* Tombol Simpan di Sidebar */}
                                <div className="mt-5 pt-3">
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-xs font-bold text-white shadow-md shadow-primary-600/25 transition hover:bg-primary-700 disabled:opacity-60"
                                    >
                                        <IconDeviceFloppy size={18} />
                                        <span>{processing ? "Menyimpan..." : "Simpan Menu"}</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
