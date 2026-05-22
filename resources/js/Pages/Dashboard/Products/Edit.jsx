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
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconBuildingStore,
    IconPlus,
    IconTrash,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";

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
    const canSubmitProductForm =
        canManageCatalog || canManagePricing || canManageTenantDiscount;

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

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData("image", file);
            setImagePreview(URL.createObjectURL(file));
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
                    <IconPackage size={28} className="text-primary-500" />
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
                            {canManageCatalog ? (
                                <Input
                                    type="file"
                                    label="Ganti Gambar"
                                    onChange={handleImageChange}
                                    errors={errors.image}
                                    accept="image/*"
                                />
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Gambar produk hanya dapat diganti oleh admin atau pengelola katalog.
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
                        ) : canManageTenantDiscount && !canManageCatalog && !canManagePricing ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                Mode tenant aktif. Harga jual owner outlet disembunyikan. Anda hanya bisa mengatur harga promo tenant dari harga beli produk ini.
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
                                    disabled={!canManageCatalog}
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
                                Harga Produk
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    type="number"
                                    label="Harga Beli"
                                    value={data.buy_price}
                                    onChange={(e) =>
                                        setData("buy_price", e.target.value)
                                    }
                                    errors={errors.buy_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Harga Jual"
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
                            {data.buy_price > 0 && data.sell_price > 0 && (
                                <div className="mt-4 p-4 rounded-xl bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-900">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-success-700 dark:text-success-400 font-medium">
                                                Estimasi Profit per Item
                                            </p>
                                            <p className="text-2xl font-bold text-success-600 dark:text-success-500 mt-1">
                                                + Rp{" "}
                                                {(
                                                    data.sell_price -
                                                    data.buy_price
                                                ).toLocaleString("id-ID")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-success-700 dark:text-success-400 font-medium">
                                                Margin
                                            </p>
                                            <p className="text-xl font-bold text-success-600 dark:text-success-500 mt-1">
                                                {(
                                                    ((data.sell_price -
                                                        data.buy_price) /
                                                        data.buy_price) *
                                                    100
                                                ).toFixed(1)}
                                                %
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                        Harga Dasar Tenant
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        Rp {Number(product.buy_price || 0).toLocaleString("id-ID")}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Basis harga tenant mengikuti harga beli owner outlet.
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
                                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                                    Harga diskon tenant harus lebih kecil atau sama dengan harga beli. Untuk promo coret berbasis rule outlet, buat aturannya di menu Promo Harga tenant.
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
                                    <button
                                        type="button"
                                        onClick={addModifierOption}
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
                                    >
                                        <IconPlus size={14} />
                                        Tambah
                                    </button>
                                </div>

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
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <IconBuildingStore size={18} />
                                        Stok per Outlet
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Penyesuaian di sini akan dicatat sebagai adjustment stok outlet dan membantu admin menjaga akurasi stok multi outlet.
                                    </p>
                                </div>
                                <Link
                                    href={route("stock-opnames.index")}
                                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                >
                                    Buka Stock Opname
                                </Link>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Outlet</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tipe</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Stok Fisik</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Reorder Level</th>
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
                                                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

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
                                        {processingStock ? "Menyimpan Stok Outlet..." : "Simpan Stok Outlet"}
                                    </button>
                                </div>
                            </div>
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
