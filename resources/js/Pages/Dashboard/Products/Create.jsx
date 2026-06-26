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
    IconChevronDown,
    IconChevronUp,
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconPlus,
    IconTrash,
} from "@/Utils/icons";

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
    categories,
    tenantOutlets = [],
    autoKitchenStations = [],
    workspace = {},
    tenantDefaultMarkup = 3000,
}) {
    const { errors } = usePage().props;
    const isTenantWorkspace = workspace?.is_tenant === true;
    const defaultTenantOutletId = workspace?.active_outlet_id || "";

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

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedImageName, setSelectedImageName] = useState("");
    const [localErrors, setLocalErrors] = useState({});
    const [showModifierSection, setShowModifierSection] = useState(true);
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
            setLocalErrors((current) => ({ ...current, image: "" }));
            return;
        }

        const result = await prepareImageUpload(file);

        if (!result.ok) {
            setData("image", "");
            setSelectedImageName("");
            setLocalErrors((current) => ({ ...current, image: result.error }));
            toast.error(result.error);
            return;
        }

        setLocalErrors((current) => ({ ...current, image: "" }));
        setSelectedImageName(result.file.name);
        setData("image", result.file);
        setImagePreview(URL.createObjectURL(result.file));
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

        if (localErrors.image) {
            toast.error(localErrors.image);
            return;
        }

        post(route("products.store"), {
            forceFormData: true,
            onSuccess: () => toast.success("Produk berhasil ditambahkan"),
            onError: () => toast.error("Gagal menyimpan produk"),
        });
    };

    return (
        <>
            <Head title="Tambah Produk" />

            {/* Header */}
            <div className="mb-6">
                <Link
                    href={route("products.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Produk
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Tambah Produk
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Isi data inti produk, lalu simpan.
                </p>
            </div>

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Image */}
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
                            <Input
                                type="file"
                                label="Upload Gambar"
                                onChange={handleImageChange}
                                errors={localErrors.image || errors.image}
                                accept={IMAGE_UPLOAD_ACCEPT}
                            />
                            <div className="mt-2 space-y-1 text-xs text-slate-500">
                                <p>
                                    {selectedImageName
                                        ? `File dipilih: ${selectedImageName}`
                                        : "Belum ada gambar dipilih. Sistem akan memakai default.jpg."}
                                </p>
                                <p>
                                    Format: JPG, PNG, WEBP. Maksimal 2MB.
                                    Gambar dikompres otomatis sebelum diunggah.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconBarcode size={18} />
                                Informasi Dasar
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
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
                                        disabled={isTenantWorkspace}
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
                                    <p className="mt-1 text-xs text-slate-500">
                                        {isTenantWorkspace
                                            ? "Produk baru otomatis masuk ke tenant outlet aktif Anda."
                                            : selectedTenantOutlet
                                            ? `Kategori yang tersedia akan dibatasi ke tenant ${selectedTenantOutlet.name}.`
                                            : "Pilih global jika produk milik owner outlet dan memakai kategori global."}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {autoKitchenStation
                                            ? `Auto-mapping dapur akan memakai station ${autoKitchenStation.station_name}${autoKitchenStation.station_code ? ` (${autoKitchenStation.station_code})` : ""}.`
                                            : "Belum ada station dapur aktif yang bisa dipakai untuk auto-mapping."}
                                    </p>
                                </div>
                                <div className="md:col-span-2">
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
                                    <p className="mt-1 text-xs text-slate-500">
                                        {availableCategories.length > 0
                                            ? `${availableCategories.length} kategori tersedia untuk konteks ini.`
                                            : "Belum ada kategori untuk tenant/konteks ini. Buat kategori terlebih dahulu."}
                                    </p>
                                </div>
                                {isTenantWorkspace ? (
                                    <>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Barcode
                                            </p>
                                            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                                {autoProductCodePreview}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Dibuat otomatis saat produk disimpan.
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                SKU
                                            </p>
                                            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                                {autoProductCodePreview}
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
                                        />
                                        <Input
                                            type="text"
                                            label="SKU"
                                            value={data.sku}
                                            onChange={(e) => setData("sku", e.target.value)}
                                            errors={errors.sku}
                                            placeholder="Kosongkan untuk generate otomatis"
                                        />
                                        <p className="-mt-2 text-xs text-slate-500">
                                            Jika dikosongkan, barcode dan SKU akan dibuat otomatis dari nama produk.
                                            Preview:{" "}
                                            <span className="font-semibold text-slate-700">
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
                                    placeholder="Masukkan nama produk"
                                />
                                <div className="md:col-span-2">
                                    <Textarea
                                        label="Deskripsi"
                                        placeholder="Deskripsi produk (opsional)"
                                        errors={errors.description}
                                        onChange={(e) =>
                                            setData(
                                                "description",
                                                e.target.value
                                            )
                                        }
                                        value={data.description}
                                        rows={3}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-3">
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
                                                    Aktifkan jika item ini bisa memiliki extra topping, add-on, atau tambahan harga di POS dan self order.
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
                            </div>
                        </div>

                        {/* Pricing & Stock */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga 3 Level & Stok
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                {isTenantWorkspace ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Harga Jual Outlet
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                            Rp {effectiveOutletSellPrice.toLocaleString("id-ID")}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Otomatis dihitung dari harga beli tenant + markup default Rp {Number(tenantDefaultMarkup || 0).toLocaleString("id-ID")}.
                                        </p>
                                    </div>
                                ) : (
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
                                )}
                                <Input
                                    type="number"
                                    label="Stok"
                                    value={data.stock}
                                    onChange={(e) =>
                                        setData("stock", e.target.value)
                                    }
                                    errors={errors.stock}
                                    placeholder="0"
                                />
                            </div>

                            {(Number(data.tenant_hpp_price || 0) > 0 ||
                                Number(data.buy_price || 0) > 0 ||
                                Number(data.sell_price || 0) > 0) && (
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
                                                Number(
                                                    isTenantWorkspace
                                                        ? effectiveOutletSellPrice
                                                        : data.sell_price || 0
                                                ) -
                                                    Number(data.buy_price || 0)
                                            ).toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {data.supports_modifiers && (
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
                                        <div className="mt-3">
                                            <Link
                                                href={route("settings.topping-markup")}
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:border-slate-700 dark:text-primary-300 dark:hover:bg-slate-800"
                                            >
                                                Atur Markup Topping
                                            </Link>
                                        </div>
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
                                            <div>
                                                <Input
                                                    type="number"
                                                    label={index === 0 ? "Harga Dasar" : ""}
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
                                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                    Markup mengikuti menu `Settings > Profil Toko > Markup Topping`.
                                                </p>
                                            </div>
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

                        {/* Submit */}
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
                                {processing ? "Menyimpan..." : "Simpan Produk"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
