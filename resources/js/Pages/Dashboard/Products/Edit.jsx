import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import InputSelect from "@/Components/Dashboard/InputSelect";
import toast from "react-hot-toast";
import {
    IconPackage,
    IconDeviceFloppy,
    IconArrowLeft,
    IconChevronDown,
    IconChevronUp,
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconBuildingStore,
    IconPlus,
    IconTrash,
} from "@/Utils/icons";
import { getProductImageUrl } from "@/Utils/imageUrl";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const participationRoleLabel = (role) => {
    if (role === "buy_item") return "Produk pemicu promo";
    if (role === "get_item") return "Produk bonus / gratis";
    if (role === "buy_and_get") return "Produk pemicu dan bonus";
    if (role === "bundle_item") return "Item dalam paket";
    return "Berlaku langsung";
};

const humanizeSchedule = (scheduleLabel) => {
    const raw = String(scheduleLabel || "").trim();

    if (!raw || raw === "Aktif setiap saat") {
        return {
            alwaysOn: true,
            period: "Tanpa batas tanggal",
            days: "Setiap hari",
            time: "24 jam",
        };
    }

    const segments = raw.split("•").map((part) => part.trim()).filter(Boolean);
    const periodSegment =
        segments.find((part) => part.startsWith("mulai ") || part.startsWith("sampai ")) ||
        null;
    const daysSegment = segments.find((part) => part.startsWith("hari ")) || null;
    const timeSegment = segments.find((part) => part.startsWith("jam ")) || null;

    const period = periodSegment
        ? periodSegment
              .replace(/^mulai\s+/i, "Mulai ")
              .replace(/\s+sampai\s+/i, " - ")
        : "Tanpa batas tanggal";

    const days = daysSegment
        ? daysSegment
              .replace(/^hari\s+/i, "")
              .replace(/\bMin\b/g, "Minggu")
              .replace(/\bSen\b/g, "Senin")
              .replace(/\bSel\b/g, "Selasa")
              .replace(/\bRab\b/g, "Rabu")
              .replace(/\bKam\b/g, "Kamis")
              .replace(/\bJum\b/g, "Jumat")
              .replace(/\bSab\b/g, "Sabtu")
        : "Setiap hari";

    const normalizedTime = timeSegment
        ? timeSegment
              .replace(/^jam\s+/i, "")
              .replace(/\s*s\.d\.\s*/i, " - ")
        : "24 jam";
    const time =
        normalizedTime === "00:00:00 - 23:59:00" ||
        normalizedTime === "00:00 - 23:59"
            ? "24 jam"
            : normalizedTime;

    return {
        alwaysOn: false,
        period,
        days,
        time,
    };
};

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

const loadImageElement = (src) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });

const compressImageFile = async (
    file,
    {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.82,
        outputType = "image/webp",
    } = {}
) => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await loadImageElement(objectUrl);
        const ratio = Math.min(
            1,
            maxWidth / image.width || 1,
            maxHeight / image.height || 1
        );
        const targetWidth = Math.max(1, Math.round(image.width * ratio));
        const targetHeight = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext("2d");
        if (!context) {
            return file;
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, outputType, quality)
        );

        if (!blob || blob.size >= file.size) {
            return file;
        }

        const normalizedName = file.name.replace(/\.(jpe?g|png|webp)$/i, "");

        return new File([blob], `${normalizedName}.webp`, {
            type: outputType,
            lastModified: Date.now(),
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export default function Edit({
    categories,
    product,
    tenantOutlets = [],
    autoKitchenStations = [],
    outletStocks = [],
    activePricingRules = {},
    workspace = {},
    tenantDefaultMarkup = 3000,
    capabilities = {},
}) {
    const { errors } = usePage().props;
    const isTenantWorkspace = workspace?.is_tenant === true;
    const canManageCatalog = capabilities?.can_manage_catalog === true;
    const canManagePricing = capabilities?.can_manage_pricing === true;
    const canManageTenantDiscount =
        capabilities?.can_manage_tenant_discount === true;
    const canManageTenantBasicFields =
        capabilities?.can_manage_tenant_basic_fields === true;
    const canManageTenantSellPrice =
        capabilities?.can_manage_tenant_sell_price === true;
    const canManageOutletStock =
        capabilities?.can_manage_outlet_stock === true;
    const canManageProductImage =
        capabilities?.can_manage_product_image === true;
    const tenantCatalogMode = isTenantWorkspace && canManageCatalog;
    const canSubmitProductForm =
        canManageCatalog ||
        canManagePricing ||
        canManageTenantDiscount ||
        canManageTenantBasicFields ||
        canManageTenantSellPrice;

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
            name: option.name || "",
            price: option.price ?? "",
            is_required: !!option.is_required,
        })),
        description: product.description ?? "",
        tenant_hpp_price: product.tenant_hpp_price ?? "",
        buy_price: product.buy_price ?? "",
        sell_price: product.sell_price ?? "",
        tenant_discount_price: product.tenant_discount_price ?? "",
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

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [imagePreview, setImagePreview] = useState(
        product.image ? getProductImageUrl(product.image) : null
    );
    const [showModifierSection, setShowModifierSection] = useState(true);
    const [showOutletStockSection, setShowOutletStockSection] = useState(false);
    const pricingRules = activePricingRules?.rules || [];
    const activeRulesCount = Number(activePricingRules?.active_rules_count || 0);
    const currentPricingRule = activePricingRules?.current_price?.pricing_rule || null;
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
    const preservedOwnerMarkup = useMemo(
        () =>
            Math.max(
                0,
                Number(product.sell_price || 0) - Number(product.buy_price || 0)
            ),
        [product.buy_price, product.sell_price]
    );
    const effectiveOutletSellPrice = useMemo(
        () => Math.max(0, Number(data.buy_price || 0) + preservedOwnerMarkup),
        [data.buy_price, preservedOwnerMarkup]
    );

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
    }, [
        canManageCatalog,
        data.sell_price,
        effectiveOutletSellPrice,
        isTenantWorkspace,
        setData,
    ]);

    const modifierSummary = useMemo(
        () =>
            (product.modifier_options || [])
                .map((option) =>
                    option.price > 0
                        ? `${option.name} (+Rp ${Number(option.price).toLocaleString("id-ID")})`
                        : option.name
                )
                .join(", "),
        [product.modifier_options]
    );
    const autoSkuPreview = previewAutoSku(data.sku, data.barcode, data.title);

    const setSelectedCategoryHandler = (value) => {
        setSelectedCategory(value);
        setData("category_id", value?.id || "");
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const processedFile = await compressImageFile(file);
            setData("image", processedFile);
            setImagePreview(URL.createObjectURL(processedFile));
        }
    };

    const updateModifierOption = (index, field, value) => {
        setData(
            "modifier_options",
            data.modifier_options.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row
            )
        );
    };

    const addModifierOption = () => {
        setData("modifier_options", [
            ...data.modifier_options,
            { name: "", price: "", is_required: false },
        ]);
    };

    const removeModifierOption = (index) => {
        setData(
            "modifier_options",
            data.modifier_options.filter((_, rowIndex) => rowIndex !== index)
        );
    };

    const submit = (e) => {
        e.preventDefault();
        post(route("products.update", product.id), {
            onSuccess: () => toast.success("Produk berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui produk"),
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
            onSuccess: () => toast.success("Stok outlet berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui stok outlet"),
        });
    };

    return (
        <>
            <Head title="Edit Produk" />

            <div className="mb-6">
                <Link
                    href={route("products.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Produk
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Edit Produk
                </h1>
                <p className="text-sm text-slate-500 mt-1">{product.title}</p>
            </div>

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left - Image */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconPhoto size={18} />
                                Gambar Produk
                            </h3>
                            <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden mb-4">
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-center p-6">
                                        <IconPhoto
                                            size={48}
                                            className="mx-auto text-slate-400 mb-2"
                                        />
                                        <p className="text-sm text-slate-500">
                                            Belum ada gambar
                                        </p>
                                    </div>
                                )}
                            </div>
                            {canManageProductImage ? (
                                <>
                                    <Input
                                        type="file"
                                        label="Ganti Gambar"
                                        onChange={handleImageChange}
                                        errors={errors.image}
                                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Validasi: hanya `JPG`, `JPEG`, `PNG`, atau `WEBP`, maksimal `5 MB`. Gambar akan dikompres otomatis sebelum diunggah jika ukuran file bisa diperkecil.
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Gambar produk hanya dapat diganti oleh admin atau owner tenant yang memiliki akses ke produk ini.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right - Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {!canSubmitProductForm ? (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                                Anda sedang memakai mode operasional dapur/tenant. Di halaman ini Anda hanya bisa menyesuaikan stok outlet. Harga jual, harga beli, dan data katalog produk tetap dikelola admin.
                            </div>
                        ) : (canManageTenantBasicFields || canManageTenantSellPrice) &&
                          !canManageCatalog &&
                          !canManagePricing ? (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                                Mode owner tenant aktif. Anda bisa mengelola katalog produk tenant sendiri, termasuk topping. Harga outlet tidak bisa diubah manual dan akan mengikuti selisih markup lama produk ini.
                            </div>
                        ) : canManageTenantDiscount && !canManageCatalog && !canManagePricing ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                Mode tenant aktif. Harga jual owner outlet disembunyikan. Anda bisa mengatur HPP tenant dan promo tenant tanpa mengubah harga owner outlet.
                            </div>
                        ) : null}

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconBarcode size={18} />
                                Informasi Dasar
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    {canManageCatalog ? (
                                        <>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Tenant Outlet
                                            </label>
                                            <select
                                                value={data.tenant_outlet_id}
                                                onChange={(e) => {
                                                    setData("tenant_outlet_id", e.target.value);
                                                    setData("category_id", "");
                                                    setSelectedCategory(null);
                                                }}
                                                disabled={tenantCatalogMode}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800"
                                            >
                                                <option value="">Global / Owner Outlet</option>
                                                {tenantOutlets.map((outlet) => (
                                                    <option key={outlet.id} value={outlet.id}>
                                                        {outlet.code} - {outlet.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.tenant_outlet_id && (
                                                <p className="mt-1 text-xs text-red-500">
                                                    {errors.tenant_outlet_id}
                                                </p>
                                            )}
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {tenantCatalogMode
                                                    ? "Produk tenant tetap terkunci ke outlet tenant aktif Anda."
                                                    : selectedTenantOutlet
                                                    ? `Kategori yang tampil dibatasi ke tenant ${selectedTenantOutlet.name}.`
                                                    : "Produk global hanya dapat memakai kategori global."}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {autoKitchenStation
                                                    ? `Auto-mapping dapur akan memakai station ${autoKitchenStation.station_name}${autoKitchenStation.station_code ? ` (${autoKitchenStation.station_code})` : ""} bila produk belum punya mapping aktif.`
                                                    : "Belum ada station dapur aktif yang bisa dipakai untuk auto-mapping."}
                                            </p>
                                        </>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Tenant Outlet
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {tenantOutlets.find(
                                                    (outlet) => Number(outlet.id) === Number(product.tenant_outlet_id)
                                                )?.name ||
                                                    product.tenant_outlet?.name ||
                                                    "Global"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    {canManageCatalog ? (
                                        <>
                                            <InputSelect
                                                label="Kategori"
                                                data={availableCategories}
                                                selected={selectedCategory}
                                                setSelected={setSelectedCategoryHandler}
                                                placeholder={
                                                    data.tenant_outlet_id
                                                        ? "Pilih kategori tenant"
                                                        : "Pilih kategori global"
                                                }
                                                errors={errors.category_id}
                                                searchable={true}
                                                displayKey="name"
                                            />
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {availableCategories.length > 0
                                                    ? `${availableCategories.length} kategori tersedia untuk konteks ini.`
                                                    : "Belum ada kategori yang cocok untuk tenant/konteks ini."}
                                            </p>
                                        </>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Kategori
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {selectedCategory?.name || product.category?.name || "-"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {tenantCatalogMode ? (
                                    <>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Barcode
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {product.barcode || autoSkuPreview}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Dibuat otomatis dan tidak dapat diubah dari workspace tenant.
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                SKU
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {product.sku || autoSkuPreview}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Dibuat otomatis mengikuti kode produk.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Input
                                            type="text"
                                            label="Barcode"
                                            value={data.barcode}
                                            onChange={(e) =>
                                                setData("barcode", e.target.value)
                                            }
                                            errors={errors.barcode}
                                            placeholder="Kosongkan untuk generate otomatis"
                                            disabled={!canManageCatalog}
                                        />
                                        <Input
                                            type="text"
                                            label="SKU"
                                            value={data.sku}
                                            onChange={(e) => setData("sku", e.target.value)}
                                            errors={errors.sku}
                                            placeholder="Kosongkan untuk generate otomatis"
                                            disabled={!canManageCatalog}
                                        />
                                        <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Jika dikosongkan, barcode dan SKU akan dibuat otomatis dari nama produk.
                                            Preview:{" "}
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                {autoSkuPreview}
                                            </span>
                                        </p>
                                    </>
                                )}
                                <Input
                                    type="text"
                                    label="Nama Produk"
                                    value={data.title}
                                    onChange={(e) =>
                                        setData("title", e.target.value)
                                    }
                                    errors={errors.title}
                                    placeholder="Nama produk"
                                    disabled={!canManageCatalog && !canManageTenantBasicFields}
                                />
                                <div className="md:col-span-2">
                                    <Textarea
                                        label="Deskripsi"
                                        placeholder="Deskripsi produk"
                                        errors={errors.description}
                                        onChange={(e) =>
                                            setData(
                                                "description",
                                                e.target.value
                                            )
                                        }
                                        value={data.description}
                                        rows={3}
                                        disabled={!canManageCatalog}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    {canManageCatalog ? (
                                        <div className="space-y-3">
                                        <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/80 p-4 dark:border-primary-900/40 dark:bg-primary-950/20">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                                                Langkah 1
                                            </p>
                                            <label className="mt-3 flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                                                <input
                                                    type="checkbox"
                                                    checked={data.supports_modifiers}
                                                    onChange={(e) =>
                                                        setData({
                                                            ...data,
                                                            supports_modifiers: e.target.checked,
                                                            requires_modifier_selection: e.target.checked
                                                                ? data.requires_modifier_selection
                                                                : false,
                                                        })
                                                    }
                                                    className="mt-0.5 h-6 w-6 rounded-md border-2 border-primary-400 text-primary-600 shadow-sm focus:ring-2 focus:ring-primary-500"
                                                />
                                                <span>
                                                    <span className="block text-base font-bold">
                                                        Produk ini mendukung topping / tambahan
                                                    </span>
                                                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                                                        Nonaktifkan jika item ini tidak boleh diberi extra topping atau add-on saat transaksi.
                                                    </span>
                                                </span>
                                            </label>
                                        </div>
                                        {data.supports_modifiers ? (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                                                    Langkah 2
                                                </p>
                                                <label className="mt-3 flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={data.requires_modifier_selection}
                                                        onChange={(e) =>
                                                            setData(
                                                                "requires_modifier_selection",
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="mt-0.5 h-6 w-6 rounded-md border-2 border-amber-400 text-amber-500 shadow-sm focus:ring-2 focus:ring-amber-500"
                                                    />
                                                    <span>
                                                        <span className="block font-semibold">
                                                            Produk ini wajib memilih topping
                                                        </span>
                                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                            Jika aktif, POS dan self order akan meminta minimal satu topping dipilih. Jika ada opsi yang ditandai wajib, user harus memilih salah satunya.
                                                        </span>
                                                    </span>
                                                </label>
                                            </div>
                                        ) : null}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Topping / Tambahan
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {product.supports_modifiers ? "Aktif" : "Tidak aktif"}
                                            </p>
                                            {product.supports_modifiers ? (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {modifierSummary || "Preset tambahan tersedia."}
                                                </p>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {tenantCatalogMode ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga Tenant & Outlet
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    type="number"
                                    label="HPP Tenant"
                                    value={data.tenant_hpp_price}
                                    onChange={(e) =>
                                        setData("tenant_hpp_price", e.target.value)
                                    }
                                    errors={errors.tenant_hpp_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Harga Jual Tenant"
                                    value={data.buy_price}
                                    onChange={(e) =>
                                        setData("buy_price", e.target.value)
                                    }
                                    errors={errors.buy_price}
                                    placeholder="0"
                                />
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Harga Outlet
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(effectiveOutletSellPrice)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Nilai ini otomatis mengikuti harga jual tenant + markup lama {formatCurrency(preservedOwnerMarkup)} dan tidak bisa diubah manual dari workspace tenant.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-4 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-900 dark:bg-success-950/30 md:grid-cols-2">
                                <div>
                                    <p className="text-sm font-medium text-success-700 dark:text-success-400">
                                        Margin Tenant per Item
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-500">
                                        + Rp{" "}
                                        {Math.max(
                                            0,
                                            Number(data.buy_price || 0) -
                                                Number(
                                                    data.tenant_hpp_price ||
                                                        product.tenant_hpp_price ||
                                                        product.buy_price ||
                                                        0
                                                )
                                        ).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-success-700 dark:text-success-400">
                                        Markup Outlet per Item
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-500">
                                        + Rp{" "}
                                        {Math.max(
                                            0,
                                            Number(effectiveOutletSellPrice || 0) -
                                                Number(data.buy_price || 0)
                                        ).toLocaleString("id-ID")}
                                    </p>
                                </div>
                            </div>
                        </div>
                        ) : canManagePricing ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga 3 Level Produk
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    type="number"
                                    label="HPP Tenant"
                                    value={data.tenant_hpp_price}
                                    onChange={(e) =>
                                        setData("tenant_hpp_price", e.target.value)
                                    }
                                    errors={errors.tenant_hpp_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Harga Beli dari Tenant"
                                    value={data.buy_price}
                                    onChange={(e) =>
                                        setData("buy_price", e.target.value)
                                    }
                                    errors={errors.buy_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Harga Jual Outlet"
                                    value={data.sell_price}
                                    onChange={(e) =>
                                        setData("sell_price", e.target.value)
                                    }
                                    errors={errors.sell_price}
                                    placeholder="0"
                                />
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Stok Saat Ini
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {product.stock}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Perubahan stok dilakukan melalui transaksi atau stock opname.
                                </p>
                            </div>

                            {/* Profit Estimation */}
                            <div className="mt-4 grid gap-4 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-900 dark:bg-success-950/30 md:grid-cols-2">
                                <div>
                                    <p className="text-sm font-medium text-success-700 dark:text-success-400">
                                        Margin Tenant per Item
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-500">
                                        + Rp{" "}
                                        {Math.max(
                                            0,
                                            Number(data.buy_price || 0) -
                                                Number(
                                                    data.tenant_hpp_price ||
                                                        data.buy_price ||
                                                        0
                                                )
                                        ).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-success-700 dark:text-success-400">
                                        Markup Owner per Item
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-500">
                                        + Rp{" "}
                                        {Math.max(
                                            0,
                                            Number(data.sell_price || 0) -
                                                Number(data.buy_price || 0)
                                        ).toLocaleString("id-ID")}
                                    </p>
                                </div>
                            </div>
                        </div>
                        ) : canManageTenantSellPrice ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga Tenant & Outlet
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    type="number"
                                    label="HPP Tenant"
                                    value={data.tenant_hpp_price}
                                    onChange={(e) =>
                                        setData("tenant_hpp_price", e.target.value)
                                    }
                                    errors={errors.tenant_hpp_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Harga Jual Tenant"
                                    value={data.buy_price}
                                    onChange={(e) =>
                                        setData("buy_price", e.target.value)
                                    }
                                    errors={errors.buy_price}
                                    placeholder="0"
                                />
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Harga Outlet
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(product.sell_price || 0)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Nilai ini tetap dikelola owner outlet dan tidak bisa diubah dari workspace tenant.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-4 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-900 dark:bg-success-950/30 md:grid-cols-2">
                                <div>
                                    <p className="text-sm font-medium text-success-700 dark:text-success-400">
                                        Margin Tenant per Item
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-500">
                                        + Rp{" "}
                                        {Math.max(
                                            0,
                                            Number(data.buy_price || 0) -
                                                Number(
                                                    data.tenant_hpp_price ||
                                                        product.tenant_hpp_price ||
                                                        product.buy_price ||
                                                        0
                                                )
                                        ).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-success-700 dark:text-success-400">
                                        Markup Outlet per Item
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-500">
                                        + Rp{" "}
                                        {Math.max(
                                            0,
                                            Number(product.sell_price || 0) -
                                                Number(data.buy_price || 0)
                                        ).toLocaleString("id-ID")}
                                    </p>
                                </div>
                            </div>
                        </div>
                        ) : canManageTenantDiscount ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga Tenant
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        HPP Tenant
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Rp {Number(product.tenant_hpp_price || product.buy_price || 0).toLocaleString("id-ID")}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Harga produksi / HPP internal tenant.
                                    </p>
                                </div>
                                <Input
                                    type="number"
                                    label="Update HPP Tenant"
                                    value={data.tenant_hpp_price}
                                    onChange={(e) =>
                                        setData("tenant_hpp_price", e.target.value)
                                    }
                                    errors={errors.tenant_hpp_price}
                                    placeholder="0"
                                />
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Harga Beli Owner dari Tenant
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Rp {Number(product.buy_price || 0).toLocaleString("id-ID")}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Dipakai sebagai basis jual tenant ke outlet owner.
                                    </p>
                                </div>
                                <Input
                                    type="number"
                                    label="Harga Diskon Tenant"
                                    value={data.tenant_discount_price}
                                    onChange={(e) =>
                                        setData("tenant_discount_price", e.target.value)
                                    }
                                    errors={errors.tenant_discount_price}
                                    placeholder="Kosongkan jika tidak ada promo"
                                />
                            </div>

                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                    Preview Harga Tenant
                                </p>
                                <div className="mt-2 flex flex-wrap items-end gap-3">
                                    <p
                                        className={`text-sm font-medium ${
                                            data.tenant_discount_price !== "" &&
                                            Number(data.tenant_discount_price) > 0 &&
                                            Number(data.tenant_discount_price) < Number(product.buy_price || 0)
                                                ? "text-slate-400 line-through dark:text-slate-500"
                                                : "text-lg font-bold text-slate-900 dark:text-slate-100"
                                        }`}
                                    >
                                        Rp {Number(product.buy_price || 0).toLocaleString("id-ID")}
                                    </p>
                                    {data.tenant_discount_price !== "" &&
                                    Number(data.tenant_discount_price) > 0 &&
                                    Number(data.tenant_discount_price) < Number(product.buy_price || 0) ? (
                                        <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                                            Rp {Number(data.tenant_discount_price || 0).toLocaleString("id-ID")}
                                        </p>
                                    ) : null}
                                </div>
                                <div
                                    className={`mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 ${
                                        product.sell_price !== null &&
                                        product.sell_price !== undefined
                                            ? "md:grid-cols-2"
                                            : "md:grid-cols-1"
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                            Margin Tenant / Item
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-200">
                                            {formatCurrency(
                                                Math.max(
                                                    0,
                                                    Number(product.buy_price || 0) -
                                                        Number(
                                                            data.tenant_hpp_price ||
                                                                product.tenant_hpp_price ||
                                                                product.buy_price ||
                                                                0
                                                        )
                                                )
                                            )}
                                        </p>
                                    </div>
                                    {product.sell_price !== null &&
                                    product.sell_price !== undefined ? (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                                Markup Owner / Item
                                            </p>
                                            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-200">
                                                {formatCurrency(
                                                    Math.max(
                                                        0,
                                                        Number(product.sell_price || 0) -
                                                            Number(product.buy_price || 0)
                                                    )
                                                )}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                                    HPP tenant tidak boleh lebih besar dari harga beli owner. Harga diskon tenant juga harus lebih kecil atau sama dengan harga beli owner. Untuk promo coret berbasis rule outlet, buat aturannya di menu Promo Harga tenant.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Link
                                        href={route("pricing-rules.index")}
                                        className="inline-flex items-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-950/40"
                                    >
                                        Buka Promo Harga Tenant
                                    </Link>
                                    <Link
                                        href={route("products.index")}
                                        className="inline-flex items-center rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                                    >
                                        Update Stok Harian
                                    </Link>
                                </div>
                            </div>
                        </div>
                        ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga Produk
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Harga Beli
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Rp {Number(product.buy_price || 0).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        HPP Tenant
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Rp {Number(product.tenant_hpp_price || product.buy_price || 0).toLocaleString("id-ID")}
                                    </p>
                                </div>
                                {!canManageTenantDiscount && product.sell_price !== null && product.sell_price !== undefined ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Harga Jual
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                            Rp {Number(product.sell_price || 0).toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                Perubahan harga hanya boleh dilakukan admin atau pengguna yang memiliki izin pembaruan harga.
                            </p>
                        </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <IconCurrencyDollar size={18} />
                                        Promo Aktif pada Produk Ini
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Ringkasan rule pricing aktif yang sedang menyentuh produk ini, termasuk potongan dan cara rule tersebut bekerja.
                                    </p>
                                </div>
                                <Link
                                    href={route("pricing-rules.index")}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Buka Promo Harga
                                </Link>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Rule Aktif
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                                        {activeRulesCount}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Harga Dasar
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(activePricingRules?.current_price?.base_unit_price || product.sell_price || product.buy_price || 0)}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Harga Efektif Saat Ini
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-primary-600 dark:text-primary-400">
                                        {formatCurrency(activePricingRules?.current_price?.effective_unit_price || product.sell_price || product.buy_price || 0)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {currentPricingRule?.name
                                            ? `Dipengaruhi langsung oleh ${currentPricingRule.name}.`
                                            : "Belum ada rule direct yang menurunkan harga 1 item."}
                                    </p>
                                </div>
                            </div>

                            {pricingRules.length === 0 ? (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    Tidak ada promo aktif yang sedang menyentuh produk ini pada outlet aktif.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-4">
                                    {pricingRules.map((entry) => {
                                        const schedule = humanizeSchedule(
                                            entry.schedule_label
                                        );

                                        return (
                                        <div
                                            key={entry.id}
                                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                        >
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                            {entry.name}
                                                        </p>
                                                        <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                            {entry.kind_label}
                                                        </span>
                                                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                            {entry.rule?.label}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                                        {entry.rule?.detail}
                                                    </p>
                                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                        {entry.impact?.summary}
                                                    </p>
                                                </div>
                                                <div className="grid min-w-full gap-2 sm:grid-cols-2 lg:min-w-[320px]">
                                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            Target
                                                        </p>
                                                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {entry.target_label}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            Pelanggan
                                                        </p>
                                                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {entry.customer_scope_label}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            Outlet
                                                        </p>
                                                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {entry.outlet_label}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            Cara Produk Ini Ikut
                                                        </p>
                                                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {participationRoleLabel(entry.impact?.participation_role)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Jadwal Aktif
                                                    </p>
                                                    <div className="mt-2 space-y-2">
                                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                                Periode
                                                            </p>
                                                            <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                                                                {schedule.period}
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                                    Hari
                                                                </p>
                                                                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                                                                    {schedule.days}
                                                                </p>
                                                            </div>
                                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                                    Jam
                                                                </p>
                                                                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                                                                    {schedule.time}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {schedule.alwaysOn ? (
                                                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                                Aktif terus
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Qty Simulasi
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                                                        {entry.impact?.preview_quantity || 1} item
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Potongan Simulasi
                                                    </p>
                                                    {entry.kind === "bundle_price" &&
                                                    entry.impact?.base_package_total !== undefined &&
                                                    entry.impact?.base_package_total !== null &&
                                                    entry.impact?.promo_package_total !== undefined &&
                                                    entry.impact?.promo_package_total !== null ? (
                                                        <div className="mt-1 space-y-1 text-sm">
                                                            <p className="text-slate-500 dark:text-slate-400">
                                                                Sebelum bundle:{" "}
                                                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                    {formatCurrency(entry.impact.base_package_total)}
                                                                </span>
                                                            </p>
                                                            <p className="text-primary-600 dark:text-primary-400">
                                                                Setelah bundle:{" "}
                                                                <span className="font-semibold">
                                                                    {formatCurrency(entry.impact.promo_package_total)}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    ) : entry.impact?.display_discount_label ? (
                                                        <p className="mt-1 text-sm font-semibold text-danger-600 dark:text-danger-400">
                                                            {entry.impact.display_discount_label}
                                                        </p>
                                                    ) : (
                                                        <p className="mt-1 text-sm font-semibold text-danger-600 dark:text-danger-400">
                                                            {formatCurrency(entry.impact?.line_discount_total || 0)}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Harga Setelah Promo
                                                    </p>
                                                    {entry.impact?.display_price_label ? (
                                                        <div className="mt-1 space-y-1">
                                                            {entry.impact?.base_package_total !== undefined &&
                                                            entry.impact?.base_package_total !== null &&
                                                            entry.impact?.promo_package_total !== undefined &&
                                                            entry.impact?.promo_package_total !== null &&
                                                            Number(entry.impact.base_package_total) >
                                                                Number(entry.impact.promo_package_total) ? (
                                                                <span className="text-xs text-slate-400 line-through dark:text-slate-500">
                                                                    {formatCurrency(entry.impact.base_package_total)}
                                                                </span>
                                                            ) : null}
                                                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                                                                {entry.impact.display_price_label}
                                                            </p>
                                                            {entry.kind === "bundle_price" &&
                                                            entry.impact?.base_package_total !== undefined &&
                                                            entry.impact?.base_package_total !== null &&
                                                            entry.impact?.promo_package_total !== undefined &&
                                                            entry.impact?.promo_package_total !== null ? (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Harga normal paket{" "}
                                                                    {formatCurrency(entry.impact.base_package_total)}{" "}
                                                                    menjadi{" "}
                                                                    {formatCurrency(entry.impact.promo_package_total)}.
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            {entry.impact?.base_unit_price &&
                                                            entry.impact?.effective_unit_price &&
                                                            Number(entry.impact.base_unit_price) >
                                                                Number(entry.impact.effective_unit_price) ? (
                                                                <span className="text-xs text-slate-400 line-through dark:text-slate-500">
                                                                    {formatCurrency(entry.impact.base_unit_price)}
                                                                </span>
                                                            ) : null}
                                                            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                                                                {formatCurrency(entry.impact?.effective_unit_price || entry.impact?.base_unit_price || 0)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {entry.rule?.qty_breaks?.length ? (
                                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                                        Break Quantity
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {entry.rule.qty_breaks.map((breakItem, index) => (
                                                            <span
                                                                key={`${entry.id}-break-${index}`}
                                                                className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
                                                            >
                                                                Qty {breakItem.min_qty}:{" "}
                                                                {breakItem.discount_type === "percentage"
                                                                    ? `${Number(breakItem.discount_value)}% OFF`
                                                                    : breakItem.discount_type === "fixed_price"
                                                                      ? formatCurrency(breakItem.discount_value)
                                                                      : `Hemat ${formatCurrency(breakItem.discount_value)}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {Boolean(
                                                (entry.rule?.bundle_items?.length || 0) ||
                                                    (entry.rule?.buy_items?.length || 0) ||
                                                    (entry.rule?.get_items?.length || 0)
                                            ) && (
                                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                                    {entry.rule?.bundle_items?.length ? (
                                                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                Item Bundle
                                                            </p>
                                                            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                                                {entry.rule.bundle_items.map((item, index) => (
                                                                    <p key={`${entry.id}-bundle-${index}`}>
                                                                        {item.quantity}x {item.product_title}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    {entry.rule?.buy_items?.length ? (
                                                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                Item Pembelian
                                                            </p>
                                                            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                                                {entry.rule.buy_items.map((item, index) => (
                                                                    <p key={`${entry.id}-buy-${index}`}>
                                                                        {item.quantity}x {item.product_title}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    {entry.rule?.get_items?.length ? (
                                                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                Item Bonus
                                                            </p>
                                                            <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                                                {entry.rule.get_items.map((item, index) => (
                                                                    <p key={`${entry.id}-get-${index}`}>
                                                                        {item.quantity}x {item.product_title}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {canManageCatalog && data.supports_modifiers && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                                            Langkah 3
                                        </p>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Preset Topping / Tambahan
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Opsi ini muncul di POS dan self order. Tandai `Wajib` pada opsi yang harus dipilih.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowModifierSection((value) => !value)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            {showModifierSection ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                            {showModifierSection ? "Sembunyikan" : "Lihat detail"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addModifierOption}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
                                        >
                                            <IconPlus size={14} />
                                            Tambah
                                        </button>
                                    </div>
                                </div>

                                {showModifierSection ? (
                                <div className="space-y-3">
                                    {data.modifier_options.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                            Belum ada preset topping.
                                        </div>
                                    )}
                                    {data.modifier_options.map((option, index) => (
                                        <div
                                            key={index}
                                            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-[minmax(0,1fr)_120px_180px_auto]"
                                        >
                                            <Input
                                                type="text"
                                                label={index === 0 ? "Nama Opsi" : ""}
                                                value={option.name}
                                                onChange={(e) =>
                                                    updateModifierOption(
                                                        index,
                                                        "name",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Contoh: Extra cheese"
                                            />
                                            <Input
                                                type="number"
                                                label={index === 0 ? "Harga" : ""}
                                                value={option.price}
                                                onChange={(e) =>
                                                    updateModifierOption(
                                                        index,
                                                        "price",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="0"
                                            />
                                            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                <input
                                                    type="checkbox"
                                                    checked={!!option.is_required}
                                                    onChange={(e) =>
                                                        updateModifierOption(
                                                            index,
                                                            "is_required",
                                                            e.target.checked
                                                        )
                                                    }
                                                    className="h-5 w-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                                />
                                                <span>
                                                    <span className="block font-semibold">
                                                        Wajib dipilih
                                                    </span>
                                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                        Salah satu opsi wajib harus dipilih saat order.
                                                    </span>
                                                </span>
                                            </label>
                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeModifierOption(index)
                                                    }
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-danger-200 hover:bg-danger-50 hover:text-danger-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-danger-900 dark:hover:bg-danger-950/30"
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                        Preset topping berada tepat di bagian ini. Buka detail di bawah judul ini untuk menambah, mengubah, atau menandai opsi wajib.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <IconBuildingStore size={18} />
                                        Penyesuaian Stok Outlet
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Penyesuaian di sini akan dicatat sebagai adjustment stok outlet. Untuk tenant, yang bisa diubah hanya stok outlet aktif miliknya sendiri.
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        `Batas restock minimum` dipakai sebagai alarm kapan stok perlu diisi ulang.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowOutletStockSection((value) => !value)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        {showOutletStockSection ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                        {showOutletStockSection ? "Sembunyikan" : "Lihat detail"}
                                    </button>
                                    <Link
                                        href={route("stock-opnames.index")}
                                        className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                    >
                                        Buka Stock Opname
                                    </Link>
                                </div>
                            </div>

                            {showOutletStockSection ? (
                            <div className="mt-4 space-y-4">
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Outlet</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tipe</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Stok Fisik</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Batas Restock Minimum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {outletStocks.map((row, index) => (
                                                <tr key={row.outlet_id} className="bg-white dark:bg-slate-900">
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-slate-100">
                                                                {row.outlet_code} - {row.outlet_name}
                                                            </p>
                                                            {row.last_counted_at ? (
                                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                    Counted: {new Date(row.last_counted_at).toLocaleString("id-ID")}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {row.outlet_type || "main"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={stockData.outlet_stocks[index]?.stock ?? 0}
                                                            onChange={(e) =>
                                                                updateOutletStockRow(index, "stock", e.target.value)
                                                            }
                                                            disabled={!canManageOutletStock}
                                                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={stockData.outlet_stocks[index]?.reorder_level ?? 0}
                                                            onChange={(e) =>
                                                                updateOutletStockRow(index, "reorder_level", e.target.value)
                                                            }
                                                            disabled={!canManageOutletStock}
                                                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {canManageOutletStock ? (
                                    <>
                                        <Textarea
                                            label="Catatan Adjustment"
                                            placeholder="Contoh: hasil audit stok outlet pagi"
                                            value={stockData.notes}
                                            onChange={(e) => setStockData("notes", e.target.value)}
                                            rows={2}
                                        />

                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={submitOutletStocks}
                                                disabled={processingStock}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                                            >
                                                <IconDeviceFloppy size={18} />
                                                {processingStock ? "Menyimpan Penyesuaian Stok..." : "Simpan Penyesuaian Stok"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                        Anda tidak memiliki izin untuk mengubah stok outlet dari halaman ini.
                                    </div>
                                )}
                            </div>
                            ) : (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    Detail stok outlet disembunyikan. Buka detail jika ingin mengubah stok fisik per outlet.
                                </div>
                            )}
                        </div>

                        {canSubmitProductForm ? (
                            <div className="flex justify-end gap-3">
                                <Link
                                    href={route("products.index")}
                                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                                >
                                    Batal
                                </Link>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                                >
                                    <IconDeviceFloppy size={18} />
                                    {processing
                                        ? "Menyimpan..."
                                        : "Simpan Perubahan"}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </form>
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
