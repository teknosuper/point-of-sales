import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, router, Link } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import InputSelect from "@/Components/Dashboard/InputSelect";
import toast from "react-hot-toast";
import {
    IconPackage,
    IconDeviceFloppy,
    IconArrowLeft,
    IconChevronDown,
    IconChevronRight,
    IconChevronUp,
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconBuildingStore,
    IconPlus,
    IconTrash,
    IconStar,
} from "@/Utils/icons";
import { useAuthorization } from "@/Utils/authorization";
import Swal from "sweetalert2";
import { getProductImageUrl } from "@/Utils/imageUrl";
import {
    IMAGE_UPLOAD_ACCEPT,
    prepareImageUpload,
} from "@/Utils/imageUpload";

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

const modifierModeLabel = (mode) => {
    if (mode === "single") return "Pilih 1";
    if (mode === "multiple") return "Bisa lebih dari 1";
    return "Opsional";
};

const modifierRuleSummary = (option) => {
    const mode = String(option?.selection_mode || "optional");
    const min = Math.max(0, Number(option?.min_select || 0));
    const maxValue = option?.max_select;
    const max = maxValue === "" || maxValue === null || maxValue === undefined
        ? null
        : Math.max(0, Number(maxValue || 0));

    if (mode === "single") {
        return "Customer hanya bisa memilih 1 opsi dari kategori ini.";
    }

    if (mode === "multiple") {
        if (max !== null) {
            return `Customer wajib memilih minimal ${min} dan maksimal ${max} opsi.`;
        }

        return `Customer wajib memilih minimal ${min} opsi tanpa batas maksimum.`;
    }

    if (max !== null) {
        return `Customer boleh melewati kategori ini, atau memilih sampai ${max} opsi.`;
    }

    return "Customer boleh memilih atau melewati kategori ini.";
};

const defaultModifierOption = (groupName = "Topping") => ({
    group_name: groupName,
    order_type_scope: "",
    selection_mode: "optional",
    min_select: 0,
    max_select: "",
    name: "",
    price: "",
    stock: "",
    is_required: false,
});

const resolveModifierMarkupPreview = (basePrice, rules = []) => {
    const price = Math.max(0, Number(basePrice || 0));
    const activeRules = Array.isArray(rules) ? rules.filter((rule) => rule?.is_active !== false) : [];
    const matchedRule = activeRules.find((rule) => {
        const compareValue = Math.max(0, Number(rule?.compare_value || 0));
        const compareValueTo = rule?.compare_value_to === "" || rule?.compare_value_to === null || rule?.compare_value_to === undefined
            ? null
            : Math.max(0, Number(rule.compare_value_to || 0));

        switch (rule?.operator) {
            case "lt":
                return price < compareValue;
            case "lte":
                return price <= compareValue;
            case "eq":
                return price === compareValue;
            case "gte":
                return price >= compareValue;
            case "gt":
                return price > compareValue;
            case "between":
                return compareValueTo !== null
                    && price >= Math.min(compareValue, compareValueTo)
                    && price <= Math.max(compareValue, compareValueTo);
            default:
                return false;
        }
    });

    const markupPrice = matchedRule
        ? matchedRule.markup_type === "percentage"
            ? Math.max(0, Math.round(price * (Number(matchedRule.markup_value || 0) / 100)))
            : Math.max(0, Number(matchedRule.markup_value || 0))
        : 0;

    return {
        basePrice: price,
        markupPrice,
        effectivePrice: price + markupPrice,
        rule: matchedRule || null,
    };
};

function ModifierGroupNameInput({ value, onCommit }) {
    const [draftValue, setDraftValue] = useState(value || "");

    useEffect(() => {
        setDraftValue(value || "");
    }, [value]);

    return (
        <Input
            type="text"
            label="Kategori"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={(event) => {
                const nextValue = event.target.value;

                if (nextValue !== (value || "")) {
                    onCommit(nextValue);
                }
            }}
            placeholder="Contoh: Kuah"
        />
    );
}

export default function Edit({
    categories,
    product,
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
                auth.roleNames?.includes('admin-sistem') ||
                (activeOutlet?.outlet_type === 'main' &&
                 ['admin-owner-outlet', 'outlet-owner'].some(role => auth.roleNames?.includes(role)))));
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

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [imagePreview, setImagePreview] = useState(
        product.image ? getProductImageUrl(product.image) : null
    );
    const [selectedImageName, setSelectedImageName] = useState("");
    const [imageLocalError, setImageLocalError] = useState("");
    const [showModifierSection, setShowModifierSection] = useState(true);
    const [showOutletStockSection, setShowOutletStockSection] = useState(false);
    const [collapsedModifierGroups, setCollapsedModifierGroups] = useState({});
    const pricingRules = activePricingRules?.rules || [];
    const activeRulesCount = Number(activePricingRules?.active_rules_count || 0);
    const currentPricingRule = activePricingRules?.current_price?.pricing_rule || null;
    const toppingMarkupRules = toppingMarkupSettings?.rules || [];
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
    const modifierGroups = useMemo(() => {
        const buckets = new Map();

        data.modifier_options.forEach((option, index) => {
            const groupName = String(option.group_name || "Topping").trim() || "Topping";

            if (!buckets.has(groupName)) {
                buckets.set(groupName, {
                    groupKey: index,
                    groupName,
                    order_type_scope: option.order_type_scope ?? "",
                    selection_mode: option.selection_mode || "optional",
                    min_select: option.min_select ?? 0,
                    max_select: option.max_select ?? "",
                    options: [],
                });
            }

            buckets.get(groupName).options.push({
                ...option,
                originalIndex: index,
            });
        });

        return Array.from(buckets.values());
    }, [data.modifier_options]);
    const autoSkuPreview = previewAutoSku(data.sku, data.barcode, data.title);

    const setSelectedCategoryHandler = (value) => {
        setSelectedCategory(value);
        setData("category_id", value?.id || "");
    };

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
            defaultModifierOption(),
        ]);
    };

    const addModifierGroup = () => {
        const nextGroupNumber = modifierGroups.length + 1;

        setData("modifier_options", [
            ...data.modifier_options,
            defaultModifierOption(`Kategori ${nextGroupNumber}`),
        ]);
    };

    const toggleModifierGroup = (groupKey) => {
        setCollapsedModifierGroups((current) => ({
            ...current,
            [groupKey]: !current[groupKey],
        }));
    };

    const duplicateModifierGroup = (group) => {
        const clonedGroupName = `${group.groupName} Copy`;
        const clonedRows = group.options.map((option) => ({
            ...defaultModifierOption(clonedGroupName),
            order_type_scope: group.order_type_scope ?? "",
            selection_mode: group.selection_mode || "optional",
            min_select: group.min_select ?? 0,
            max_select: group.max_select ?? "",
            name: option.name || "",
            price: option.price ?? "",
            stock: option.stock ?? "",
            is_required: !!option.is_required,
        }));

        setData("modifier_options", [...data.modifier_options, ...clonedRows]);
    };

    const removeModifierGroup = (groupName) => {
        setData(
            "modifier_options",
            data.modifier_options.filter(
                (row) => String(row.group_name || "Topping").trim() !== String(groupName).trim()
            )
        );
    };

    const addModifierOptionToGroup = (groupName) => {
        const group = modifierGroups.find((entry) => entry.groupName === groupName);

        setData("modifier_options", [
            ...data.modifier_options,
            {
                ...defaultModifierOption(groupName),
                order_type_scope: group?.order_type_scope ?? "",
                selection_mode: group?.selection_mode || "optional",
                min_select: group?.min_select ?? 0,
                max_select: group?.max_select ?? "",
            },
        ]);
    };

    const updateModifierGroupMeta = (groupName, field, value) => {
        setData(
            "modifier_options",
            data.modifier_options.map((row) =>
                String(row.group_name || "Topping").trim() === String(groupName).trim()
                    ? {
                          ...row,
                          [field]: value,
                          ...(field === "selection_mode" && value === "single"
                              ? { max_select: 1 }
                              : {}),
                      }
                    : row
            )
        );
    };

    const removeModifierOption = (index) => {
        setData(
            "modifier_options",
            data.modifier_options.filter((_, rowIndex) => rowIndex !== index)
        );
    };

    const submit = (e) => {
        e.preventDefault();

        if (imageLocalError) {
            toast.error(imageLocalError);
            return;
        }

        post(route("products.update", product.id), {
            forceFormData: true,
            onSuccess: () => toast.success("Produk berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui produk"),
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
                                        errors={imageLocalError || errors.image}
                                        accept={IMAGE_UPLOAD_ACCEPT}
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        {selectedImageName
                                            ? `File dipilih: ${selectedImageName}. `
                                            : ""}
                                        Validasi: hanya `JPG`, `JPEG`, `PNG`, atau `WEBP`, maksimal `2 MB`. Gambar akan dikompres otomatis sebelum diunggah.
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
                                {pendingRename ? (
                                    <div className="-mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                                        <p>
                                            Permintaan ganti nama ini sedang menunggu review owner. Produk tetap tampil dengan nama &ldquo;{pendingRename.old_title}&rdquo; sampai disetujui.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => cancelPendingRename(pendingRename.id)}
                                            className="shrink-0 rounded-lg bg-amber-200 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-300 dark:bg-amber-900/60 dark:text-amber-100"
                                        >
                                            Batalkan Permintaan
                                        </button>
                                    </div>
                                ) : product.tenant_outlet_id && data.title !== product.title ? (
                                    <p className="-mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs font-medium text-warning-700 ring-1 ring-warning-200 dark:bg-warning-950/30 dark:text-warning-300 dark:ring-warning-800/50">
                                        Ganti nama produk tenant akan dikirim sebagai permintaan review ke owner. Produk tetap tampil dengan nama lama sampai disetujui. Perubahan harga/gambar/topping tetap berlaku langsung.
                                    </p>
                                ) : product.tenant_outlet_id ? (
                                    <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">
                                        Perubahan selain nama produk (harga, gambar, topping, &amp; lainnya) berlaku langsung tanpa review.
                                    </p>
                                ) : null}
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
                                                            Jika aktif, pelanggan harus memilih minimal satu topping sebelum menambah ke keranjang. Berlaku jika produk tidak punya kategori topping yang sudah diatur kewajibannya (Mode &amp; Min) di Langkah 3.
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
                                <div className="flex flex-wrap items-center gap-2">
                                    {canManagePricing ? (
                                        <Link
                                            href={route("pricing-rules.create", {
                                                product_id: product.id,
                                            })}
                                            className="inline-flex items-center justify-center rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-600"
                                        >
                                            <IconPlus size={14} className="mr-1" />
                                            Tambah Promo
                                        </Link>
                                    ) : null}
                                    <Link
                                        href={route("pricing-rules.index")}
                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Buka Promo Harga
                                    </Link>
                                </div>
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
                                                        {canManagePricing ? (
                                                            <Link
                                                                href={route("pricing-rules.edit", entry.id)}
                                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-primary-300"
                                                            >
                                                                Kelola
                                                            </Link>
                                                        ) : null}
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
                                            Opsi ini muncul di POS dan self order. Setiap baris sekarang bisa menentukan kategori topping, mode pilihan, batas minimum/maksimum, dan stok opsi.
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
                                    </div>
                                </div>

                                {showModifierSection ? (
                                <div className="space-y-3">
                                    {/* ===== Panduan alur singkat ===== */}
                                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                                            Alur mengatur topping
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-800 dark:text-sky-200">
                                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold shadow-sm dark:bg-slate-900">
                                                1. Tambah Kategori Topping
                                            </span>
                                            <IconChevronRight size={13} className="text-sky-400" />
                                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold shadow-sm dark:bg-slate-900">
                                                2. Tambah Opsi di kategori
                                            </span>
                                            <IconChevronRight size={13} className="text-sky-400" />
                                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold shadow-sm dark:bg-slate-900">
                                                3. Atur mode, min/max & wajib
                                            </span>
                                        </div>
                                    </div>

                                    {data.modifier_options.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                            Belum ada kategori topping. Klik{" "}
                                            <span className="font-semibold text-primary-600 dark:text-primary-400">
                                                "Tambah Kategori Topping"
                                            </span>{" "}
                                            di bawah untuk membuat kategori pertama (mis. "Topping Wajib", "Tingkat Pedas", "Ekstra Topping").
                                        </div>
                                    )}
                                    {modifierGroups.map((group, groupIndex) => (
                                        <div
                                            key={`modifier-group-${group.groupKey}-${groupIndex}`}
                                            className="space-y-4 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-900/50 dark:bg-primary-950/20"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary-200 bg-white px-3 py-3 dark:border-primary-900/40 dark:bg-slate-900">
                                                <div className="min-w-0 flex-1">
                                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-primary-600 dark:text-primary-300">
                                                        Kategori
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                            {group.groupName}
                                                        </p>
                                                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                            {group.options.length} opsi
                                                        </span>
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {modifierModeLabel(group.selection_mode)}
                                                        </span>
                                                        <span
                                                            className={
                                                                group.order_type_scope === "take_away"
                                                                    ? "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                                                    : group.order_type_scope === "dine_in"
                                                                        ? "rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                                                                        : "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                            }
                                                        >
                                                            {group.order_type_scope === "take_away"
                                                                ? "Take-away"
                                                                : group.order_type_scope === "dine_in"
                                                                    ? "Dine-in"
                                                                    : "Semua"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                        {modifierRuleSummary(group)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Total opsi
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {group.options.length}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleModifierGroup(group.groupKey)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        {collapsedModifierGroups[group.groupKey] ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
                                                        {collapsedModifierGroups[group.groupKey] ? "Buka" : "Tutup"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => duplicateModifierGroup(group)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        Duplikat
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeModifierGroup(group.groupName)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-danger-200 px-3 py-2 text-xs font-semibold text-danger-600 hover:bg-danger-50 dark:border-danger-900/50 dark:text-danger-300 dark:hover:bg-danger-950/20"
                                                    >
                                                        Hapus
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => addModifierOptionToGroup(group.groupName)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:border-slate-700 dark:text-primary-300 dark:hover:bg-slate-800"
                                                    >
                                                        <IconPlus size={14} />
                                                        Tambah Opsi
                                                    </button>
                                                </div>
                                            </div>
                                            {!collapsedModifierGroups[group.groupKey] && (
                                            <>
                                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                                            <div className="lg:col-span-3">
                                                <ModifierGroupNameInput
                                                    value={group.groupName}
                                                    onCommit={(nextValue) =>
                                                        updateModifierGroupMeta(
                                                            group.groupName,
                                                            "group_name",
                                                            nextValue
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="lg:col-span-2">
                                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Mode
                                                </label>
                                                <select
                                                    value={group.selection_mode || "optional"}
                                                    onChange={(e) =>
                                                        updateModifierGroupMeta(group.groupName, "selection_mode", e.target.value)
                                                    }
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                >
                                                    <option value="single">1 opsi</option>
                                                    <option value="multiple">Bisa &gt;1</option>
                                                    <option value="optional">Opsional</option>
                                                </select>
                                            </div>
                                            <div className="lg:col-span-3">
                                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Berlaku saat
                                                </label>
                                                <select
                                                    value={group.order_type_scope ?? ""}
                                                    onChange={(e) =>
                                                        updateModifierGroupMeta(group.groupName, "order_type_scope", e.target.value)
                                                    }
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                >
                                                    <option value="">Semua (dine-in & take-away)</option>
                                                    <option value="take_away">Hanya take-away</option>
                                                    <option value="dine_in">Hanya dine-in</option>
                                                </select>
                                            </div>
                                            <div className="lg:col-span-4">
                                                <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                    Kewajiban diatur di sini: Mode &amp; Min menentukan berapa opsi yang harus dipilih user.
                                                </div>
                                            </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
                                            <div className="lg:col-span-2">
                                                <Input
                                                    type="number"
                                                    label="Min"
                                                    value={group.min_select}
                                                    onChange={(e) =>
                                                        updateModifierGroupMeta(group.groupName, "min_select", e.target.value)
                                                    }
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="lg:col-span-2">
                                                <Input
                                                    type="number"
                                                    label="Max"
                                                    value={group.max_select}
                                                    onChange={(e) =>
                                                        updateModifierGroupMeta(group.groupName, "max_select", e.target.value)
                                                    }
                                                    disabled={group.selection_mode === "single"}
                                                    placeholder="∞"
                                                />
                                            </div>
                                            <div className="lg:col-span-3">
                                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                    {toppingMarkupRules.length > 0
                                                        ? `${toppingMarkupRules.length} rule aktif dari menu markup topping.`
                                                        : "Belum ada rule markup aktif. Harga efektif = harga dasar."}
                                                </p>
                                            </div>
                                            <div className="col-span-2 lg:col-span-2 grid grid-cols-2 gap-2 lg:block">
                                                <div className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-center dark:border-primary-900/40 dark:bg-slate-900">
                                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Rentang harga
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {group.options.length > 0
                                                            ? `${formatCurrency(Math.min(...group.options.map((item) => resolveModifierMarkupPreview(item.price, toppingMarkupRules).effectivePrice)))} - ${formatCurrency(Math.max(...group.options.map((item) => resolveModifierMarkupPreview(item.price, toppingMarkupRules).effectivePrice)))}`
                                                            : formatCurrency(0)}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-center dark:border-primary-900/40 dark:bg-slate-900">
                                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Stok
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {group.options.every((item) => item.stock === "" || item.stock === null || item.stock === undefined)
                                                            ? "Bebas"
                                                            : "Campuran"}
                                                    </p>
                                                </div>
                                            </div>
                                            </div>
                                            <div className="space-y-3">
                                                {group.options.map((option, optionIndex) => (
                                                    <div
                                                        key={`modifier-option-${option.originalIndex}`}
                                                        className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/10 lg:grid-cols-12"
                                                    >
                                                        <div className="lg:col-span-12">
                                                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
                                                                Opsi
                                                            </p>
                                                        </div>
                                                        <div className="lg:col-span-5">
                                                            <Input
                                                                type="text"
                                                                label={optionIndex === 0 ? "Nama Opsi" : ""}
                                                                value={option.name}
                                                                onChange={(e) =>
                                                                    updateModifierOption(option.originalIndex, "name", e.target.value)
                                                                }
                                                                placeholder="Contoh: Extra cheese"
                                                            />
                                                        </div>
                                                        <div className="lg:col-span-3">
                                                            {(() => {
                                                                const preview = resolveModifierMarkupPreview(option.price, toppingMarkupRules);

                                                                return (
                                                                    <>
                                                            <Input
                                                                type="number"
                                                                label={optionIndex === 0 ? "Harga Dasar" : ""}
                                                                value={option.price}
                                                                onChange={(e) =>
                                                                    updateModifierOption(option.originalIndex, "price", e.target.value)
                                                                }
                                                                placeholder="0"
                                                            />
                                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                Markup {formatCurrency(preview.markupPrice)} • Efektif {formatCurrency(preview.effectivePrice)}
                                                            </p>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="lg:col-span-2">
                                                            <Input
                                                                type="number"
                                                                label={optionIndex === 0 ? "Stok" : ""}
                                                                value={option.stock}
                                                                onChange={(e) =>
                                                                    updateModifierOption(option.originalIndex, "stock", e.target.value)
                                                                }
                                                                placeholder="Bebas"
                                                            />
                                                        </div>
                                                        <div className="lg:col-span-2 flex items-end justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeModifierOption(option.originalIndex)}
                                                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-danger-200 hover:bg-danger-50 hover:text-danger-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-danger-900 dark:hover:bg-danger-950/30"
                                                            >
                                                                <IconTrash size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            </>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addModifierGroup}
                                        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <IconPlus size={16} />
                                        Tambah Kategori Topping
                                    </button>
                                </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                        Preset topping berada tepat di bagian ini. Buka detail di bawah judul ini untuk menambah, mengubah, atau menandai opsi wajib.
                                    </div>
                                )}
                            </div>
                        )}

                        {canViewPenaltyInfo && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                            <IconStar size={18} />
                                            Status Publik & Review
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Kelola featured, shadow ban, dan status penalty untuk publikasi menu.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Featured</p>
                                            <p className="text-[11px] text-slate-500">Tampilkan di bagian atas daftar menu.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!data.is_featured}
                                            onChange={(e) => setData("is_featured", e.target.checked)}
                                            className="h-5 w-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                        />
                                    </label>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                            Shadow Ban Reason
                                        </label>
                                        <input
                                            type="text"
                                            value={data.shadow_ban_reason}
                                            onChange={(e) => setData("shadow_ban_reason", e.target.value)}
                                            placeholder="Alasan shadow ban (jika ada)"
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                        Penalty Status
                                    </label>
                                    <select
                                        value={data.penalty_status}
                                        onChange={(e) => setData("penalty_status", e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    >
                                        <option value="">Tidak ada status</option>
                                        <option value="under_review">Under Review</option>
                                        <option value="accepted">Accepted (unban)</option>
                                        <option value="rejected">Rejected (keep banned)</option>
                                    </select>
                                </div>
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
