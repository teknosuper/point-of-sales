import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import InputSelect from "@/Components/Dashboard/InputSelect";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { useAuthorization } from "@/Utils/authorization";
import {
    IMAGE_UPLOAD_ACCEPT,
    prepareImageUpload,
} from "@/Utils/imageUpload";
import { getProductImageUrl } from "@/Utils/imageUrl";
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
    IconAlertTriangle,
    IconDiscount2,
    IconBuildingWarehouse,
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

export default function Edit({
    categories = [],
    product = {},
    pendingRename = null,
    tenantOutlets = [],
    autoKitchenStations = [],
    outletStocks = [],
    activePricingRules = {},
    workspace = {},
    tenantDefaultMarkup = 3000,
    toppingMarkupSettings = {},
    capabilities = {},
}) {
    const { errors, auth, activeOutlet } = usePage().props;
    const { isSuperAdmin } = useAuthorization();

    const canViewPenaltyInfo =
        capabilities?.can_manage_publication === true ||
        (capabilities?.can_manage_publication === undefined &&
            (isSuperAdmin() ||
                auth.roleNames?.includes("admin-sistem") ||
                (activeOutlet?.outlet_type === "main" &&
                    ["admin-owner-outlet", "outlet-owner"].some((role) =>
                        auth.roleNames?.includes(role)
                    ))));

    const isTenantWorkspace = workspace?.is_tenant === true;
    const canManageCatalog = capabilities?.can_manage_catalog === true;
    const canManagePricing = capabilities?.can_manage_pricing === true;
    const canManageTenantDiscount = capabilities?.can_manage_tenant_discount === true;
    const canManageTenantBasicFields = capabilities?.can_manage_tenant_basic_fields === true;
    const canManageTenantSellPrice = capabilities?.can_manage_tenant_sell_price === true;
    const canManageOutletStock = capabilities?.can_manage_outlet_stock === true;
    const canManageProductImage = capabilities?.can_manage_product_image === true;

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [imagePreview, setImagePreview] = useState(
        product.image ? getProductImageUrl(product.image) : null
    );
    const [selectedImageName, setSelectedImageName] = useState("");
    const [imageLocalError, setImageLocalError] = useState("");
    const [showAdvancedCodes, setShowAdvancedCodes] = useState(false);

    const { data, setData, post, processing } = useForm({
        image: "",
        barcode: product.barcode ?? "",
        sku: product.sku ?? "",
        title: product.title ?? "",
        category_id: product.category_id ?? "",
        tenant_outlet_id: product.tenant_outlet_id ?? "",
        supports_modifiers: !!product.supports_modifiers,
        requires_modifier_selection: !!product.requires_modifier_selection,
        modifier_options: (product.modifier_options || []).map((option) => ({
            group_name: option.group_name || "Topping",
            order_type_scope: option.order_type_scope ?? "",
            selection_mode: option.selection_mode || "optional",
            min_select: option.min_select ?? 0,
            max_select: option.max_select ?? "",
            name: option.name || "",
            price: option.price ?? "",
            stock: option.stock ?? "",
            is_required: !!option.is_required,
        })),
        description: product.description ?? "",
        tenant_hpp_price: product.tenant_hpp_price ?? "",
        buy_price: product.buy_price ?? "",
        sell_price: product.sell_price ?? "",
        tenant_discount_price: product.tenant_discount_price ?? "",
        is_featured: !!product.is_featured,
        shadow_ban_reason: product.shadow_ban_reason ?? "",
        penalty_status: product.penalty_status ?? "",
        _method: "PUT",
    });

    const {
        data: stockData,
        setData: setStockData,
        patch: patchStockData,
        processing: processingStock,
    } = useForm({
        notes: "",
        outlet_stocks: outletStocks.map((row) => ({
            outlet_id: row.outlet_id,
            stock: row.stock,
            reorder_level: row.reorder_level ?? 0,
        })),
    });

    const preservedOwnerMarkup = useMemo(
        () => Math.max(0, Number(product.sell_price || 0) - Number(product.buy_price || 0)),
        [product.buy_price, product.sell_price]
    );

    const effectiveOutletSellPrice = useMemo(
        () => Math.max(0, Number(data.buy_price || 0) + preservedOwnerMarkup),
        [data.buy_price, preservedOwnerMarkup]
    );

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
        if (!isTenantWorkspace || !canManageCatalog) {
            return;
        }

        if (String(data.sell_price || "") !== String(effectiveOutletSellPrice)) {
            setData("sell_price", String(effectiveOutletSellPrice));
        }
    }, [canManageCatalog, data.sell_price, effectiveOutletSellPrice, isTenantWorkspace, setData]);

    const handleImageChange = async (e) => {
        const file = e.target.files[0];

        if (!file) {
            setData("image", "");
            setSelectedImageName("");
            setImageLocalError("");
            return;
        }

        const result = await prepareImageUpload(file);

        if (!result.ok) {
            setData("image", "");
            setSelectedImageName("");
            setImageLocalError(result.error);
            toast.error(result.error);
            return;
        }

        setImageLocalError("");
        setSelectedImageName(result.file.name);
        setData("image", result.file);
        setImagePreview(URL.createObjectURL(result.file));
    };

    const handleRemoveImage = () => {
        setData("image", "");
        setSelectedImageName("");
        setImagePreview(product.image ? getProductImageUrl(product.image) : null);
        setImageLocalError("");
    };

    // Deteksi Error per Step untuk Badge Merah
    const stepErrors = useMemo(() => {
        const allKeys = Object.keys(errors || {});
        const step1Keys = ["image", "title", "category_id", "tenant_outlet_id", "description", "barcode", "sku"];
        const step2Keys = ["tenant_hpp_price", "buy_price", "sell_price", "tenant_discount_price", "stock"];
        const step3Keys = ["is_featured", "shadow_ban_reason", "penalty_status"];
        const step4Keys = ["supports_modifiers", "requires_modifier_selection", "modifier_options"];

        return {
            step1: allKeys.filter((k) => step1Keys.includes(k) || imageLocalError).length,
            step2: allKeys.filter((k) => step2Keys.includes(k)).length,
            step3: allKeys.filter((k) => step3Keys.includes(k)).length,
            step4: allKeys.filter((k) => step4Keys.includes(k) || k.startsWith("modifier_options.")).length,
        };
    }, [errors, imageLocalError]);

    const submit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        if (imageLocalError) {
            toast.error(imageLocalError);
            setCurrentStep(1);
            return;
        }

        post(route("products.update", product.id), {
            forceFormData: true,
            onSuccess: () => toast.success("Produk berhasil diperbarui!"),
            onError: () => {
                toast.error("Gagal memperbarui produk. Periksa kembali form yang bertanda merah.");
                if (stepErrors.step1 > 0) setCurrentStep(1);
                else if (stepErrors.step2 > 0) setCurrentStep(2);
                else if (stepErrors.step4 > 0) setCurrentStep(4);
            },
        });
    };

    const updateOutletStockRow = (index, field, value) => {
        setStockData(
            "outlet_stocks",
            stockData.outlet_stocks.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row
            )
        );
    };

    const submitOutletStocks = () => {
        patchStockData(route("products.outlet-stocks.update", product.id), {
            preserveScroll: true,
            onSuccess: () => toast.success("Stok outlet berhasil diperbarui!"),
            onError: () => toast.error("Gagal memperbarui stok outlet"),
        });
    };

    const cancelPendingRename = (renameId) => {
        Swal.fire({
            title: "Batalkan permintaan ganti nama?",
            text: "Permintaan akan dihapus dan produk tetap memakai nama saat ini.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Batalkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#d97706",
            reverseButtons: true,
        }).then((result) => {
            if (!result.isConfirmed) return;
            router.delete(route("products.rename.cancel", renameId), {
                preserveScroll: true,
                onSuccess: () => toast.success("Permintaan ganti nama dibatalkan"),
            });
        });
    };

    const STEPS = [
        { id: 1, title: "Identitas Menu", subtitle: "Nama, foto & kategori", icon: IconPackage },
        { id: 2, title: "Harga & Stok", subtitle: "Modal, jual & stok outlet", icon: IconCurrencyDollar },
        { id: 3, title: "Dapur & Visibilitas", subtitle: "Aliran tiket & status", icon: IconToolsKitchen2 },
        { id: 4, title: "Topping & Varian", subtitle: "Add-on & rasa", icon: IconSparkles },
    ];

    return (
        <DashboardLayout>
            <Head title={`Edit Menu: ${product.title || ""}`} />

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
                            Edit Menu: {product.title}
                        </h1>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Perbarui informasi menu, harga, stok, atau topping dengan mudah.
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
                            <span>{processing ? "Menyimpan..." : "Simpan Perubahan"}</span>
                        </Button>
                    </div>
                </div>

                {/* Banner Pending Rename Request (Jika Ada) */}
                {pendingRename && (
                    <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                                <IconAlertTriangle size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                    Permintaan Ganti Nama Sedang Ditinjau Owner
                                </h4>
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    Nama baru yang diajukan:{" "}
                                    <span className="font-bold underline">
                                        {pendingRename.requested_title}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {isTenantWorkspace && (
                            <button
                                type="button"
                                onClick={() => cancelPendingRename(pendingRename.id)}
                                className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                            >
                                Batalkan Pengajuan
                            </button>
                        )}
                    </div>
                )}

                {/* Modern Stepper Header */}
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {STEPS.map((step) => {
                            const IconComponent = step.icon;
                            const isActive = currentStep === step.id;
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
                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        }`}
                                    >
                                        {errorCount > 0 ? (
                                            <IconAlertCircle size={20} />
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
                            {/* STEP 1: IDENTITAS & KATEGORI */}
                            {currentStep === 1 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconPackage size={20} className="text-primary-600" />
                                            Langkah 1: Identitas & Kategori Menu
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Perbarui foto, nama menu, kategori dan deskripsi produk.
                                        </p>
                                    </div>

                                    {/* Upload Foto Menu Modern */}
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
                                                        {canManageProductImage && (
                                                            <button
                                                                type="button"
                                                                onClick={handleRemoveImage}
                                                                title="Reset Foto"
                                                                className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1 text-white shadow-md hover:bg-red-700 transition"
                                                            >
                                                                <IconX size={14} />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                                        <IconPhoto size={36} />
                                                        <span className="text-[10px] mt-1 font-semibold">Belum Ada</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 space-y-2 text-center sm:text-left">
                                                {canManageProductImage ? (
                                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100 dark:bg-primary-950/60 dark:text-primary-300 transition">
                                                            <IconPhoto size={16} />
                                                            <span>Pilih / Ganti Foto</span>
                                                            <input
                                                                type="file"
                                                                accept={IMAGE_UPLOAD_ACCEPT}
                                                                onChange={handleImageChange}
                                                                className="sr-only"
                                                            />
                                                        </label>
                                                        {selectedImageName && (
                                                            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-xs">
                                                                {selectedImageName}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500">
                                                        Anda tidak memiliki izin untuk mengubah foto produk ini.
                                                    </p>
                                                )}
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    Format JPG, PNG, WEBP. Maks 2MB. Gambar dikompres otomatis demi performa POS cepat.
                                                </p>
                                                {(imageLocalError || errors.image) && (
                                                    <p className="text-xs font-semibold text-red-500">
                                                        {imageLocalError || errors.image}
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
                                                disabled={!canManageCatalog}
                                                onChange={(e) => {
                                                    setData("tenant_outlet_id", e.target.value);
                                                    setData("category_id", "");
                                                    setSelectedCategory(null);
                                                }}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-800/60"
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
                                            disabled={!canManageCatalog}
                                            onChange={(e) => setData("title", e.target.value)}
                                            errors={errors.title}
                                            placeholder="Masukkan nama menu"
                                        />
                                        {isTenantWorkspace && !canManageCatalog && (
                                            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                                Mengubah nama menu akan dikirim sebagai permohonan ke owner outlet utama.
                                            </p>
                                        )}
                                    </div>

                                    {/* Kategori Menu */}
                                    <div>
                                        <InputSelect
                                            label="Kategori Menu *"
                                            data={availableCategories}
                                            selected={selectedCategory}
                                            setSelected={setSelectedCategoryHandler}
                                            disabled={!canManageCatalog}
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
                                                : "Belum ada kategori untuk tenant ini."}
                                        </p>
                                    </div>

                                    {/* Deskripsi */}
                                    <div>
                                        <Textarea
                                            label="Deskripsi Menu"
                                            placeholder="Deskripsi bahan atau catatan khusus tentang menu ini..."
                                            disabled={!canManageCatalog && !canManageTenantBasicFields}
                                            errors={errors.description}
                                            onChange={(e) => setData("description", e.target.value)}
                                            value={data.description}
                                            rows={2}
                                        />
                                    </div>

                                    {/* Barcode & SKU (Collapsible Ringkas) */}
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedCodes((v) => !v)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600 transition"
                                        >
                                            <IconBarcode size={16} />
                                            <span>
                                                {showAdvancedCodes
                                                    ? "Sembunyikan Barcode & SKU"
                                                    : "Lihat / Edit Barcode & SKU"}
                                            </span>
                                        </button>

                                        {showAdvancedCodes && (
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                                                <Input
                                                    type="text"
                                                    label="Barcode"
                                                    value={data.barcode}
                                                    disabled={!canManageCatalog}
                                                    onChange={(e) => setData("barcode", e.target.value)}
                                                    errors={errors.barcode}
                                                />
                                                <Input
                                                    type="text"
                                                    label="SKU"
                                                    value={data.sku}
                                                    disabled={!canManageCatalog}
                                                    onChange={(e) => setData("sku", e.target.value)}
                                                    errors={errors.sku}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: HARGA & STOK MULTI-OUTLET */}
                            {currentStep === 2 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconCurrencyDollar size={20} className="text-primary-600" />
                                            Langkah 2: Harga 3 Level & Stok Outlet
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Atur harga modal, harga transfer tenant, harga jual kasir, serta alokasi stok per outlet.
                                        </p>
                                    </div>

                                    {/* Grid Input Harga */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <Input
                                            type="number"
                                            label="HPP Tenant (Biaya Modal)"
                                            value={data.tenant_hpp_price}
                                            disabled={!canManageCatalog}
                                            onChange={(e) => setData("tenant_hpp_price", e.target.value)}
                                            errors={errors.tenant_hpp_price}
                                            placeholder="0"
                                        />

                                        <Input
                                            type="number"
                                            label="Harga Beli dari Tenant"
                                            value={data.buy_price}
                                            disabled={!canManagePricing && !canManageCatalog}
                                            onChange={(e) => setData("buy_price", e.target.value)}
                                            errors={errors.buy_price}
                                            placeholder="0"
                                        />

                                        {isTenantWorkspace && canManageCatalog ? (
                                            <div className="rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-2.5 dark:border-primary-900/50 dark:bg-primary-950/20">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                                                    Harga Jual Kasir (Auto)
                                                </p>
                                                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                                    {formatCurrency(effectiveOutletSellPrice)}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    Otomatis diselaraskan dengan markup owner
                                                </p>
                                            </div>
                                        ) : (
                                            <Input
                                                type="number"
                                                label="Harga Jual Kasir / POS"
                                                value={data.sell_price}
                                                disabled={!canManagePricing && !canManageTenantSellPrice}
                                                onChange={(e) => setData("sell_price", e.target.value)}
                                                errors={errors.sell_price}
                                                placeholder="0"
                                            />
                                        )}
                                    </div>

                                    {/* Diskon Tenant (Jika Diizinkan) */}
                                    {canManageTenantDiscount && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <IconDiscount2 size={18} className="text-amber-600" />
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                                    Harga Promo / Diskon Tenant
                                                </h4>
                                            </div>
                                            <Input
                                                type="number"
                                                label="Harga Khusus Promo (Rp)"
                                                value={data.tenant_discount_price}
                                                onChange={(e) =>
                                                    setData("tenant_discount_price", e.target.value)
                                                }
                                                errors={errors.tenant_discount_price}
                                                placeholder="Kosongkan jika tidak sedang promo"
                                            />
                                        </div>
                                    )}

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

                                    {/* Pengaturan Stok Per Outlet (Multi-Outlet Support) */}
                                    <div className="pt-2 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <IconBuildingWarehouse size={18} className="text-primary-600" />
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    Persediaan Stok per Outlet ({outletStocks.length} Outlet)
                                                </h4>
                                            </div>
                                            {canManageOutletStock && (
                                                <button
                                                    type="button"
                                                    onClick={submitOutletStocks}
                                                    disabled={processingStock}
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
                                                >
                                                    <IconCheck size={14} />
                                                    <span>{processingStock ? "Menyimpan..." : "Simpan Stok Saja"}</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                            <table className="w-full text-left text-xs">
                                                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                                                    <tr>
                                                        <th className="px-4 py-3 font-bold">Outlet</th>
                                                        <th className="px-4 py-3 font-bold">Stok Saat Ini</th>
                                                        <th className="px-4 py-3 font-bold">Reorder Level</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {outletStocks.map((outlet, idx) => (
                                                        <tr key={outlet.outlet_id}>
                                                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                                                {outlet.outlet_name}
                                                                <span className="ml-1.5 text-[10px] text-slate-400">
                                                                    ({outlet.outlet_code})
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {canManageOutletStock ? (
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        value={
                                                                            stockData.outlet_stocks[idx]?.stock ??
                                                                            outlet.stock
                                                                        }
                                                                        onChange={(e) =>
                                                                            updateOutletStockRow(
                                                                                idx,
                                                                                "stock",
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                                    />
                                                                ) : (
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                                        {outlet.stock}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {canManageOutletStock ? (
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        value={
                                                                            stockData.outlet_stocks[idx]
                                                                                ?.reorder_level ??
                                                                            outlet.reorder_level
                                                                        }
                                                                        onChange={(e) =>
                                                                            updateOutletStockRow(
                                                                                idx,
                                                                                "reorder_level",
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                                    />
                                                                ) : (
                                                                    <span className="text-slate-500">
                                                                        {outlet.reorder_level}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: DAPUR & VISIBILITAS */}
                            {currentStep === 3 && (
                                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconToolsKitchen2 size={20} className="text-primary-600" />
                                            Langkah 3: Dapur & Visibilitas Publik
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Kelola stasiun dapur tujuan dan pengaturan visibilitas menu di kasir.
                                        </p>
                                    </div>

                                    {/* Stasiun Dapur Card */}
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
                                                        ? `Pesanan menu ini diarahkan ke stasiun: "${autoKitchenStation.station_name}"${
                                                              autoKitchenStation.station_code
                                                                  ? ` [${autoKitchenStation.station_code}]`
                                                                  : ""
                                                          }.`
                                                        : "Belum ada stasiun dapur terhubung."}
                                                </p>
                                                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                                    <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                                                    <span>Terhubung dengan modul Kitchen Dispatch POS</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Menu Unggulan (Featured Switch) */}
                                    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                Tandai sebagai Menu Unggulan / Rekomendasi
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Menu ini akan diprioritaskan di daftar atas kasir POS dan self-order pelanggan.
                                            </p>
                                        </div>
                                        <label className="relative inline-flex cursor-pointer items-center">
                                            <input
                                                type="checkbox"
                                                checked={data.is_featured}
                                                onChange={(e) => setData("is_featured", e.target.checked)}
                                                className="peer sr-only"
                                            />
                                            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-5 peer-focus:outline-none dark:bg-slate-700 dark:peer-checked:bg-primary-500"></div>
                                        </label>
                                    </div>

                                    {/* Informasi Status Penalti / Shadow Ban (Admin Saja) */}
                                    {canViewPenaltyInfo && (
                                        <div className="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-slate-800">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Status Moderasi & Penalti
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                                        Status Penalti
                                                    </label>
                                                    <select
                                                        value={data.penalty_status || ""}
                                                        onChange={(e) =>
                                                            setData("penalty_status", e.target.value)
                                                        }
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        <option value="">Normal (Tidak Ada Penalti)</option>
                                                        <option value="under_review">Dalam Peninjauan</option>
                                                        <option value="accepted">Diterima / Bersih</option>
                                                        <option value="rejected">Ditolak / Blokir</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <Input
                                                        type="text"
                                                        label="Alasan Moderasi"
                                                        value={data.shadow_ban_reason}
                                                        onChange={(e) =>
                                                            setData("shadow_ban_reason", e.target.value)
                                                        }
                                                        placeholder="Catatan alasan jika ditolak..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                        disabled={!canManageCatalog}
                                    />
                                </div>
                            )}

                            {/* Navigasi Stepper Bawah */}
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
                                            <span>{processing ? "Menyimpan..." : "Simpan Perubahan"}</span>
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

                                        {/* Badge Rekomendasi Jika Featured */}
                                        {data.is_featured && (
                                            <div className="absolute right-3 top-3">
                                                <span className="rounded-lg bg-amber-500/90 backdrop-blur-md px-2 py-1 text-[10px] font-bold text-white">
                                                    ★ Unggulan
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 space-y-2.5">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                                                {data.title || product.title}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                                {data.description || "Deskripsi singkat tentang menu..."}
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
                                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">Stok Total:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {outletStocks.reduce((acc, row) => acc + (Number(row.stock) || 0), 0)} porsi
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
                                        <span>{processing ? "Menyimpan..." : "Simpan Perubahan"}</span>
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
