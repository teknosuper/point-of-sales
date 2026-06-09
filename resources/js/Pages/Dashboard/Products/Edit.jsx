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
    outletStocks = [],
    capabilities = {},
}) {
    const { errors } = usePage().props;
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
        modifier_options: (product.modifier_options || []).map((option) => ({
            name: option.name || "",
            price: option.price ?? "",
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
    const [showModifierSection, setShowModifierSection] = useState(false);
    const [showOutletStockSection, setShowOutletStockSection] = useState(false);

    useEffect(() => {
        if (product.category_id) {
            setSelectedCategory(
                categories.find((cat) => cat.id === product.category_id)
            );
        }
    }, [categories, product.category_id]);

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
            { name: "", price: "" },
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
                                Mode owner tenant aktif. Anda bisa mengubah nama produk, HPP tenant, dan harga jual tenant sendiri. Harga outlet tetap dikelola owner outlet. Gunakan tombol <span className="font-semibold">Sesuaikan Stok Hari Ini</span> di halaman daftar produk untuk menyesuaikan stok outlet aktif.
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
                                        <InputSelect
                                            label="Kategori"
                                            data={categories}
                                            selected={selectedCategory}
                                            setSelected={setSelectedCategoryHandler}
                                            placeholder="Pilih kategori"
                                            errors={errors.category_id}
                                            searchable={true}
                                            displayKey="name"
                                        />
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Kategori
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {selectedCategory?.name || "-"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    {canManageCatalog ? (
                                        <>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Tenant Outlet
                                            </label>
                                            <select
                                                value={data.tenant_outlet_id}
                                                onChange={(e) =>
                                                    setData("tenant_outlet_id", e.target.value)
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            >
                                                <option value="">Pilih tenant outlet</option>
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
                                <Input
                                    type="text"
                                    label="Barcode"
                                    value={data.barcode}
                                    onChange={(e) =>
                                        setData("barcode", e.target.value)
                                    }
                                    errors={errors.barcode}
                                    placeholder="Kode produk"
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
                                    Jika dikosongkan, SKU akan dibuat otomatis dari barcode atau nama produk.
                                    Preview:{" "}
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {autoSkuPreview}
                                    </span>
                                </p>
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
                                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={data.supports_modifiers}
                                                onChange={(e) =>
                                                    setData(
                                                        "supports_modifiers",
                                                        e.target.checked
                                                    )
                                                }
                                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                            />
                                            <span>
                                                <span className="block font-semibold">
                                                    Produk ini mendukung topping / tambahan
                                                </span>
                                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                    Nonaktifkan jika item ini tidak boleh diberi extra topping atau add-on saat transaksi.
                                                </span>
                                            </span>
                                        </label>
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

                        {canManagePricing ? (
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

                        {canManageCatalog && data.supports_modifiers && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Preset Topping / Tambahan
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Opsi ini akan muncul sebagai pilihan cepat di POS untuk produk ini.
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
                                            className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-3"
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
                                        Preset topping disembunyikan. Buka detail jika ingin menambah atau mengubah opsi.
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
