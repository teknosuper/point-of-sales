import React, { useState } from "react";
import { Head, useForm } from "@inertiajs/react";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/Components/Dashboard/Button";
import HintButton from "@/Components/Dashboard/HintButton";
import Modal from "@/Components/Dashboard/Modal";
import {
    IconArrowLeft,
    IconChartInfographic,
    IconDeviceFloppy,
    IconInfoCircle,
    IconPlus,
    IconTrash,
} from "@/Utils/icons";

const targetOptions = [
    { value: "all", label: "Semua Produk" },
    { value: "product", label: "Produk Tertentu" },
    { value: "category", label: "Kategori Tertentu" },
];

const customerScopeOptions = [
    { value: "all", label: "Semua Pelanggan" },
    { value: "walk_in", label: "Tanpa Pelanggan / Umum" },
    { value: "registered", label: "Pelanggan Terdaftar" },
    { value: "member", label: "Member Loyalty" },
];

const discountTypeOptions = [
    { value: "percentage", label: "Persentase (%)" },
    { value: "fixed_amount", label: "Potongan Nominal" },
    { value: "fixed_price", label: "Harga Final" },
];

const dayOptions = [
    { value: "mon", label: "Senin" },
    { value: "tue", label: "Selasa" },
    { value: "wed", label: "Rabu" },
    { value: "thu", label: "Kamis" },
    { value: "fri", label: "Jumat" },
    { value: "sat", label: "Sabtu" },
    { value: "sun", label: "Minggu" },
];

const basisLabel = (basis) =>
    basis === "buy_price" ? "Harga Beli Tenant" : "Harga Jual Owner";

function InputError({ message }) {
    if (!message) return null;
    return <p className="mt-1 text-xs text-rose-500">{message}</p>;
}

function FieldLabel({ children, hint }) {
    return (
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {children}
            {hint ? <HintButton>{hint}</HintButton> : null}
        </label>
    );
}

const formatCurrency = (value) =>
    `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const firstErrorByPrefix = (errors, prefix) =>
    Object.entries(errors).find(([key]) => key === prefix || key.startsWith(`${prefix}.`))?.[1] ?? null;

const buildRulePayload = (data) => {
    const payload = {
        ...data,
        qty_breaks: [],
        bundle_items: [],
        buy_get_items: [],
    };

    if (data.kind === "qty_break") {
        payload.qty_breaks = data.qty_breaks;
        payload.bundle_items = [];
        payload.buy_get_items = [];
    }

    if (data.kind === "bundle_price") {
        payload.bundle_items = data.bundle_items;
        payload.qty_breaks = [];
        payload.buy_get_items = [];
    }

    if (data.kind === "buy_x_get_y") {
        payload.buy_get_items = data.buy_get_items;
        payload.qty_breaks = [];
        payload.bundle_items = [];
    }

    return payload;
};

function CardSection({ title, description, children }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </section>
    );
}

export default function Form({
    mode = "create",
    rule = null,
    products = [],
    categories = [],
    tierOptions = [],
    kindOptions = [],
    priceBasisOptions = [],
    pricingContext = {},
}) {
    const isEdit = mode === "edit";
    const forcedPriceBasis = pricingContext?.forced_price_basis || null;
    const [showInfoModal, setShowInfoModal] = useState(false);
    const { data, setData, post, put, processing, errors, transform } = useForm({
        name: rule?.name ?? "",
        kind: rule?.kind ?? "standard_discount",
        is_active: Boolean(rule?.is_active ?? true),
        priority: String(rule?.priority ?? 100),
        target_type: rule?.target_type ?? "all",
        product_id: rule?.product_id ? String(rule.product_id) : "",
        category_id: rule?.category_id ? String(rule.category_id) : "",
        customer_scope: rule?.customer_scope ?? "all",
        eligible_loyalty_tiers: rule?.eligible_loyalty_tiers ?? [],
        discount_type: rule?.discount_type ?? "percentage",
        discount_value:
            rule?.discount_value !== undefined && rule?.discount_value !== null
                ? String(rule.discount_value)
                : "",
        price_basis:
            rule?.price_basis ?? forcedPriceBasis ?? "sell_price",
        preview_quantity_multiplier: String(rule?.preview_quantity_multiplier ?? 1),
        starts_at: rule?.starts_at
            ? new Date(rule.starts_at).toISOString().slice(0, 16)
            : "",
        ends_at: rule?.ends_at
            ? new Date(rule.ends_at).toISOString().slice(0, 16)
            : "",
        active_days: rule?.active_days ?? [],
        daily_start_time: rule?.daily_start_time ?? "",
        daily_end_time: rule?.daily_end_time ?? "",
        notes: rule?.notes ?? "",
        qty_breaks: rule?.qty_breaks?.length
            ? rule.qty_breaks.map((item) => ({
                  min_qty: String(item.min_qty),
                  discount_type: item.discount_type,
                  discount_value: String(item.discount_value),
                  sort_order: String(item.sort_order ?? 0),
              }))
            : [{ min_qty: "3", discount_type: "fixed_price", discount_value: "", sort_order: "0" }],
        bundle_items: rule?.bundle_items?.length
            ? rule.bundle_items.map((item) => ({
                  product_id: String(item.product_id),
                  quantity: String(item.quantity),
                  sort_order: String(item.sort_order ?? 0),
              }))
            : [
                  { product_id: "", quantity: "1", sort_order: "0" },
                  { product_id: "", quantity: "1", sort_order: "1" },
              ],
        buy_get_items: rule?.buy_get_items?.length
            ? rule.buy_get_items.map((item) => ({
                  product_id: String(item.product_id),
                  role: item.role,
                  quantity: String(item.quantity),
                  sort_order: String(item.sort_order ?? 0),
              }))
            : [
                  { product_id: "", role: "buy", quantity: "1", sort_order: "0" },
                  { product_id: "", role: "get", quantity: "1", sort_order: "1" },
              ],
    });
    const [previewState, setPreviewState] = useState({
        loading: false,
        data: null,
    });
    const validationMessages = Object.values(errors || {});
    const bundleError =
        firstErrorByPrefix(errors, "bundle_items") ||
        firstErrorByPrefix(errors, "bundle_items.*");
    const buyGetError =
        firstErrorByPrefix(errors, "buy_get_items") ||
        firstErrorByPrefix(errors, "buy_get_items.*");
    const qtyBreakError =
        firstErrorByPrefix(errors, "qty_breaks") ||
        firstErrorByPrefix(errors, "qty_breaks.*");
    const previewSummary = previewState.data?.summary ?? {};
    const previewItems = previewState.data?.items ?? [];
    const previewDiagnostics = previewState.data?.diagnostics ?? null;
    const previewBundleNotApplied =
        data.kind === "bundle_price" &&
        previewState.data &&
        Number(previewSummary.promo_discount_total || 0) <= 0 &&
        Number(data.discount_value || 0) >= Number(previewSummary.base_subtotal || 0);

    const submit = (event) => {
        event.preventDefault();
        const payload = buildRulePayload(data);
        transform(() => payload);

        const options = {
            preserveScroll: true,
            onError: () => {
                toast.error("Rule belum tersimpan. Periksa field yang ditandai.");
                window.scrollTo({ top: 0, behavior: "smooth" });
            },
        };

        if (isEdit) {
            put(route("pricing-rules.update", rule.id), options);
            return;
        }

        post(route("pricing-rules.store"), options);
    };

    const updateArrayRow = (key, index, field, value) => {
        const next = [...data[key]];
        next[index] = { ...next[index], [field]: value };
        setData(key, next);
    };

    const addRow = (key, template) => {
        setData(key, [...data[key], template]);
    };

    const removeRow = (key, index) => {
        setData(
            key,
            data[key].filter((_, currentIndex) => currentIndex !== index)
        );
    };

    const runPreview = async () => {
        setPreviewState({ loading: true, data: null });

        try {
            const response = await axios.post(
                route("pricing-rules.preview"),
                buildRulePayload(data)
            );
            setPreviewState({ loading: false, data: response.data?.data ?? null });
        } catch {
            setPreviewState({ loading: false, data: null });
        }
    };

    const previewGroups = previewState.data?.applied_groups || [];

    return (
        <>
            <Head title={isEdit ? "Edit Promo Harga" : "Buat Promo Harga"} />

            <div className="w-full">
                <div className="mb-6">
                    <Button
                        type="link"
                        href={route("pricing-rules.index")}
                        icon={<IconArrowLeft size={18} />}
                        className="mb-3 border-none bg-transparent px-0 text-slate-500 shadow-none hover:bg-transparent hover:text-primary-600 dark:text-slate-400"
                        label="Kembali ke promo harga"
                    />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {isEdit ? "Edit Promo Harga" : "Buat Promo Harga"}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Kelola promo standar, grosir, bundle, dan buy x get y dalam satu engine yang otomatis masuk ke kasir dan self order.
                            </p>
                            {pricingContext?.active_outlet ? (
                                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Mode: {pricingContext.mode_label || "Promo Harga"} •{" "}
                                    Outlet aktif: {pricingContext.active_outlet.code} - {pricingContext.active_outlet.name}
                                    {forcedPriceBasis === "buy_price"
                                        ? " • Rule tenant akan menghitung promo dari harga beli tenant."
                                        : " • Rule outlet akan menghitung promo dari harga jual owner."}
                                </p>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowInfoModal(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            <IconInfoCircle size={18} />
                            Panduan Promo
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Gunakan tombol <span className="font-semibold">Panduan Promo</span> untuk melihat ringkasan promo tenant, promo owner, dan hal yang wajib dicek sebelum menyimpan rule.
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {validationMessages.length > 0 && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
                            <p className="font-semibold">Rule belum bisa disimpan.</p>
                            <p className="mt-1">
                                Periksa field yang masih belum valid di form ini.
                            </p>
                            <ul className="mt-3 list-disc space-y-1 pl-5">
                                {Object.entries(errors).map(([key, message]) => (
                                    <li key={key}>
                                        <span className="font-medium">{key}</span>: {message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <CardSection
                        title="Informasi Rule"
                        description="Identitas dasar rule, jenis promo, dan prioritas penerapan."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <FieldLabel hint="Nama internal promo. Buat sejelas mungkin supaya tim mudah mengenali rule ini saat preview, audit, dan evaluasi hasil promo.">
                                    Nama Rule
                                </FieldLabel>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={(event) =>
                                        setData("name", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <InputError message={errors.name} />
                            </div>
                            <div>
                                <FieldLabel hint="Pilih bentuk promonya: diskon langsung, grosir bertingkat, paket bundle, atau buy x get y.">
                                    Jenis Rule
                                </FieldLabel>
                                <select
                                    value={data.kind}
                                    onChange={(event) =>
                                        setData("kind", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    {kindOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.kind} />
                            </div>
                            <div>
                                <FieldLabel hint="Menentukan rule mana yang didahulukan jika beberapa promo sama-sama cocok. Angka lebih besar berarti prioritas lebih tinggi.">
                                    Priority
                                </FieldLabel>
                                <input
                                    type="number"
                                    min="0"
                                    value={data.priority}
                                    onChange={(event) =>
                                        setData("priority", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <InputError message={errors.priority} />
                            </div>
                            <div>
                                <FieldLabel hint="Dipakai untuk simulasi di kartu produk POS/self-order. Isi 2 atau 3 jika promo baru terasa saat beli minimal 2 atau 3 item.">
                                    Qty Preview POS
                                </FieldLabel>
                                <input
                                    type="number"
                                    min="1"
                                    value={data.preview_quantity_multiplier}
                                    onChange={(event) =>
                                        setData(
                                            "preview_quantity_multiplier",
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <FieldLabel hint="Menentukan harga acuan saat diskon dihitung. Harga jual owner dipakai untuk promo outlet, sedangkan harga beli tenant dipakai untuk promo tenant/dapur.">
                                    Basis Harga
                                </FieldLabel>
                                {forcedPriceBasis ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                        Workspace tenant mengunci basis promo ke <span className="font-semibold">harga beli tenant</span>. Rule ini tidak akan memakai harga jual owner outlet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <select
                                            value={data.price_basis}
                                            onChange={(event) =>
                                                setData("price_basis", event.target.value)
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        >
                                            {priceBasisOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            Basis terpilih sekarang: <span className="font-semibold">{basisLabel(data.price_basis)}</span>.
                                            {data.price_basis === "buy_price"
                                                ? " Cocok untuk promo tenant."
                                                : " Cocok untuk promo outlet owner."}
                                        </div>
                                    </div>
                                )}
                                <InputError message={errors.price_basis} />
                            </div>
                        </div>
                    </CardSection>

                    <CardSection
                        title="Target & Scope"
                        description="Tentukan produk/kategori yang terkena promo dan siapa yang berhak."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <FieldLabel hint="Tentukan apakah promo berlaku untuk semua produk, satu produk tertentu, atau seluruh produk dalam satu kategori.">
                                    Target Rule
                                </FieldLabel>
                                <select
                                    value={data.target_type}
                                    onChange={(event) =>
                                        setData("target_type", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    {targetOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <FieldLabel hint="Batasi siapa yang berhak menerima promo ini: semua orang, pelanggan umum, pelanggan terdaftar, atau hanya member loyalty.">
                                    Scope Pelanggan
                                </FieldLabel>
                                <select
                                    value={data.customer_scope}
                                    onChange={(event) =>
                                        setData("customer_scope", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    {customerScopeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {data.target_type === "product" && (
                                <div className="md:col-span-2">
                                    <FieldLabel hint="Pilih produk spesifik yang menerima promo. Jika target-nya kategori atau semua produk, field ini tidak dipakai.">
                                        Produk
                                    </FieldLabel>
                                    <select
                                        value={data.product_id}
                                        onChange={(event) =>
                                            setData("product_id", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Pilih produk</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.title}
                                            </option>
                                            ))}
                                        </select>
                                    <InputError message={errors.product_id} />
                                </div>
                            )}
                            {data.target_type === "category" && (
                                <div className="md:col-span-2">
                                    <FieldLabel hint="Semua produk dalam kategori ini akan ikut dievaluasi oleh engine promo.">
                                        Kategori
                                    </FieldLabel>
                                    <select
                                        value={data.category_id}
                                        onChange={(event) =>
                                            setData("category_id", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Pilih kategori</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                            ))}
                                        </select>
                                    <InputError message={errors.category_id} />
                                </div>
                            )}
                            {data.customer_scope === "member" && (
                                <div className="md:col-span-2">
                                    <FieldLabel hint="Kosongkan jika semua tier member boleh mendapat promo. Centang hanya tier tertentu bila promo ini eksklusif.">
                                        Tier Member yang Berhak
                                    </FieldLabel>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                        {tierOptions.map((tier) => {
                                            const checked = data.eligible_loyalty_tiers.includes(
                                                tier.value
                                            );

                                            return (
                                                <label
                                                    key={tier.value}
                                                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(event) => {
                                                            const next = event.target.checked
                                                                ? [
                                                                      ...data.eligible_loyalty_tiers,
                                                                      tier.value,
                                                                  ]
                                                                : data.eligible_loyalty_tiers.filter(
                                                                      (value) =>
                                                                          value !== tier.value
                                                                  );

                                                            setData(
                                                                "eligible_loyalty_tiers",
                                                                next
                                                            );
                                                        }}
                                                    />
                                                    {tier.label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardSection>

                    <CardSection
                        title="Jadwal Promo"
                        description="Rule bisa dibatasi ke rentang tanggal tertentu, hari tertentu, dan jam operasional tertentu."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <FieldLabel hint="Kosongkan jika promo boleh langsung aktif tanpa batas tanggal mulai.">
                                    Mulai Aktif
                                </FieldLabel>
                                <input
                                    type="datetime-local"
                                    value={data.starts_at}
                                    onChange={(event) =>
                                        setData("starts_at", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <InputError message={errors.starts_at} />
                            </div>
                            <div>
                                <FieldLabel hint="Kosongkan jika promo tidak punya tanggal berakhir.">
                                    Selesai Aktif
                                </FieldLabel>
                                <input
                                    type="datetime-local"
                                    value={data.ends_at}
                                    onChange={(event) =>
                                        setData("ends_at", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <InputError message={errors.ends_at} />
                            </div>
                            <div className="md:col-span-2">
                                <FieldLabel hint="Jika tidak ada hari yang dicentang, promo dianggap boleh berjalan setiap hari.">
                                    Hari Aktif
                                </FieldLabel>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    {dayOptions.map((day) => {
                                        const checked = data.active_days.includes(day.value);

                                        return (
                                            <label
                                                key={day.value}
                                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        const next = event.target.checked
                                                            ? [...data.active_days, day.value]
                                                            : data.active_days.filter(
                                                                  (value) => value !== day.value
                                                              );

                                                        setData("active_days", next);
                                                    }}
                                                />
                                                {day.label}
                                            </label>
                                        );
                                    })}
                                </div>
                                <InputError message={errors.active_days} />
                            </div>
                            <div>
                                <FieldLabel hint="Isi jika promo hanya aktif mulai jam tertentu, misalnya promo sarapan atau happy hour.">
                                    Jam Mulai
                                </FieldLabel>
                                <input
                                    type="time"
                                    value={data.daily_start_time}
                                    onChange={(event) =>
                                        setData("daily_start_time", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <InputError message={errors.daily_start_time} />
                            </div>
                            <div>
                                <FieldLabel hint="Isi bersama jam mulai. Jika kosong, promo dianggap tidak dibatasi jam.">
                                    Jam Selesai
                                </FieldLabel>
                                <input
                                    type="time"
                                    value={data.daily_end_time}
                                    onChange={(event) =>
                                        setData("daily_end_time", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <InputError message={errors.daily_end_time} />
                            </div>
                        </div>
                    </CardSection>

                    {(data.kind === "standard_discount" ||
                        data.kind === "qty_break") && (
                        <CardSection
                            title="Diskon Rule"
                            description="Tentukan tipe diskon yang dipakai rule ini."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <FieldLabel hint="Persentase memotong dalam %, Potongan Nominal mengurangi rupiah per item, Harga Final memaksa harga akhir item.">
                                        Tipe Diskon
                                    </FieldLabel>
                                    <select
                                        value={data.discount_type}
                                        onChange={(event) =>
                                            setData("discount_type", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {discountTypeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <FieldLabel hint="Contoh: isi 15 untuk diskon 15%, 2000 untuk potongan Rp2.000, atau 18000 jika ingin harga akhir jadi Rp18.000.">
                                        Nilai Diskon
                                    </FieldLabel>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={data.discount_value}
                                        onChange={(event) =>
                                            setData("discount_value", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                <InputError message={errors.discount_value} />
                            </div>
                        </div>
                    </CardSection>
                    )}

                    {data.kind === "qty_break" && (
                        <CardSection
                            title="Qty Break / Grosir"
                            description="Satu rule bisa memiliki beberapa breakpoint quantity."
                        >
                            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                Setiap baris berarti: saat qty minimal terpenuhi, promo pada baris itu aktif. Break dengan `min qty` paling besar yang lolos akan dipakai lebih dulu.
                            </div>
                            <div className="mb-3 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 md:grid md:grid-cols-4">
                                <div className="flex items-center gap-2">
                                    Min Qty
                                    <HintButton>
                                        Jumlah minimum item agar break ini aktif.
                                    </HintButton>
                                </div>
                                <div className="flex items-center gap-2">
                                    Tipe Diskon
                                    <HintButton>
                                        Bentuk potongan yang dipakai saat break ini aktif.
                                    </HintButton>
                                </div>
                                <div className="flex items-center gap-2">
                                    Nilai
                                    <HintButton>
                                        Besar diskon untuk break ini, mengikuti tipe diskon yang dipilih.
                                    </HintButton>
                                </div>
                                <div className="text-center">Aksi</div>
                            </div>
                            <div className="space-y-3">
                                {data.qty_breaks.map((row, index) => (
                                    <div
                                        key={`qty-break-${index}`}
                                        className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4 dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <input
                                            type="number"
                                            min="1"
                                            value={row.min_qty}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "qty_breaks",
                                                    index,
                                                    "min_qty",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            placeholder="Min qty"
                                        />
                                        <select
                                            value={row.discount_type}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "qty_breaks",
                                                    index,
                                                    "discount_type",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            {discountTypeOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={row.discount_value}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "qty_breaks",
                                                    index,
                                                    "discount_value",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            placeholder="Nilai"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeRow("qty_breaks", index)}
                                            className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                        <div className="md:col-span-4">
                                            <InputError
                                                message={firstErrorByPrefix(
                                                    errors,
                                                    `qty_breaks.${index}`
                                                )}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow("qty_breaks", {
                                            min_qty: "1",
                                            discount_type: "fixed_price",
                                            discount_value: "",
                                            sort_order: String(data.qty_breaks.length),
                                        })
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                                >
                                    <IconPlus size={16} />
                                    Tambah Break
                                </button>
                                <InputError message={qtyBreakError} />
                            </div>
                        </CardSection>
                    )}

                    {data.kind === "bundle_price" && (
                        <CardSection
                            title="Bundle Price"
                            description="Pilih kombinasi produk dan harga paket final."
                        >
                            <div className="mb-4">
                                <FieldLabel hint="Ini adalah total harga paket setelah promo, bukan nilai potongan. Contoh: dua item normal Rp44.000 lalu dijual bundle Rp38.000.">
                                    Harga Bundle
                                </FieldLabel>
                                <input
                                    type="number"
                                    min="1"
                                    value={data.discount_value}
                                    onChange={(event) =>
                                        setData("discount_value", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <div className="mb-3 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 md:grid md:grid-cols-[1fr_160px_48px]">
                                <div className="flex items-center gap-2">
                                    Produk Bundle
                                    <HintButton>
                                        Pilih item yang harus hadir bersama dalam satu paket promo.
                                    </HintButton>
                                </div>
                                <div className="flex items-center gap-2">
                                    Qty
                                    <HintButton>
                                        Berapa unit produk ini yang dibutuhkan dalam paket.
                                    </HintButton>
                                </div>
                                <div className="text-center">Aksi</div>
                            </div>
                            <div className="space-y-3">
                                {data.bundle_items.map((row, index) => (
                                    <div
                                        key={`bundle-item-${index}`}
                                        className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_160px_48px] dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <select
                                            value={row.product_id}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "bundle_items",
                                                    index,
                                                    "product_id",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <option value="">Pilih produk</option>
                                            {products.map((product) => (
                                                <option key={product.id} value={product.id}>
                                                    {product.title}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="1"
                                            value={row.quantity}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "bundle_items",
                                                    index,
                                                    "quantity",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            placeholder="Qty"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeRow("bundle_items", index)}
                                            className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                        <div className="md:col-span-3">
                                            <InputError
                                                message={firstErrorByPrefix(
                                                    errors,
                                                    `bundle_items.${index}`
                                                )}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow("bundle_items", {
                                            product_id: "",
                                            quantity: "1",
                                            sort_order: String(data.bundle_items.length),
                                        })
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                                >
                                    <IconPlus size={16} />
                                    Tambah Item Bundle
                                </button>
                                <InputError message={bundleError} />
                            </div>
                        </CardSection>
                    )}

                    {data.kind === "buy_x_get_y" && (
                        <CardSection
                            title="Buy X Get Y"
                            description="Atur item pembelian (buy) dan item hadiah/diskon (get)."
                        >
                            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                Baris `Buy` adalah syarat pembelian. Baris `Get` adalah item bonus yang akan dibuat gratis / terdiskon saat syarat terpenuhi.
                            </div>
                            <div className="mb-3 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 md:grid md:grid-cols-[160px_1fr_140px_48px]">
                                <div className="flex items-center gap-2">
                                    Role
                                    <HintButton>
                                        `Buy` adalah syarat pembelian, `Get` adalah item hadiah/bonus.
                                    </HintButton>
                                </div>
                                <div className="flex items-center gap-2">
                                    Produk
                                    <HintButton>
                                        Produk yang dipakai sebagai pemicu promo atau hadiah promo.
                                    </HintButton>
                                </div>
                                <div className="flex items-center gap-2">
                                    Qty
                                    <HintButton>
                                        Jumlah unit yang harus dibeli atau yang akan diberikan sebagai bonus.
                                    </HintButton>
                                </div>
                                <div className="text-center">Aksi</div>
                            </div>
                            <div className="space-y-3">
                                {data.buy_get_items.map((row, index) => (
                                    <div
                                        key={`buy-get-item-${index}`}
                                        className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[160px_1fr_140px_48px] dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <select
                                            value={row.role}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "buy_get_items",
                                                    index,
                                                    "role",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <option value="buy">Buy</option>
                                            <option value="get">Get</option>
                                        </select>
                                        <select
                                            value={row.product_id}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "buy_get_items",
                                                    index,
                                                    "product_id",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <option value="">Pilih produk</option>
                                            {products.map((product) => (
                                                <option key={product.id} value={product.id}>
                                                    {product.title}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="1"
                                            value={row.quantity}
                                            onChange={(event) =>
                                                updateArrayRow(
                                                    "buy_get_items",
                                                    index,
                                                    "quantity",
                                                    event.target.value
                                                )
                                            }
                                            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeRow("buy_get_items", index)}
                                            className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                        <div className="md:col-span-4">
                                            <InputError
                                                message={firstErrorByPrefix(
                                                    errors,
                                                    `buy_get_items.${index}`
                                                )}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow("buy_get_items", {
                                            product_id: "",
                                            role: "buy",
                                            quantity: "1",
                                            sort_order: String(data.buy_get_items.length),
                                        })
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                                >
                                    <IconPlus size={16} />
                                    Tambah Item Buy/Get
                                </button>
                                <InputError message={buyGetError} />
                            </div>
                        </CardSection>
                    )}

                    <CardSection
                        title="Jadwal & Catatan"
                        description="Gunakan jadwal bila promo hanya aktif pada periode tertentu."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <FieldLabel hint="Versi singkat dari jadwal. Kosongkan jika promo boleh langsung aktif tanpa tanggal mulai khusus.">
                                    Mulai
                                </FieldLabel>
                                <input
                                    type="datetime-local"
                                    value={data.starts_at}
                                    onChange={(event) =>
                                        setData("starts_at", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <FieldLabel hint="Kosongkan jika promo boleh terus aktif sampai dinonaktifkan manual.">
                                    Berakhir
                                </FieldLabel>
                                <input
                                    type="datetime-local"
                                    value={data.ends_at}
                                    onChange={(event) =>
                                        setData("ends_at", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <FieldLabel hint="Catatan internal untuk tim, misalnya alasan promo dibuat, channel kampanye, atau instruksi operasional.">
                                    Catatan
                                </FieldLabel>
                                <textarea
                                    rows="3"
                                    value={data.notes}
                                    onChange={(event) =>
                                        setData("notes", event.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={data.is_active}
                                    onChange={(event) =>
                                        setData("is_active", event.target.checked)
                                    }
                                />
                                Aktifkan rule ini
                                <HintButton>
                                    Jika dimatikan, rule tetap tersimpan tetapi engine promo tidak akan memakainya di POS, kasir, atau self-order.
                                </HintButton>
                            </label>
                        </div>
                    </CardSection>

                    <CardSection
                        title="Coba Dulu Sebelum Simpan"
                        description="Uji coba rule ini langsung terhadap contoh produk. Lihat estimasi diskon, potongan tenant/owner, dan total akhir sebelum disimpan."
                    >
                        <div className="mb-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={runPreview}
                                className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300"
                            >
                                <IconChartInfographic size={16} />
                                {previewState.loading
                                    ? "Memuat preview..."
                                    : "Lihat Hasil Preview"}
                            </button>
                        </div>

                        {previewState.data && (
                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">
                                            Harga Awal
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                            {formatCurrency(previewSummary.base_subtotal)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">
                                            Diskon Promo
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-rose-600 dark:text-rose-300">
                                            {formatCurrency(previewSummary.promo_discount_total)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Tenant {formatCurrency(previewSummary.tenant_discount_total)} • Owner {formatCurrency(previewSummary.owner_discount_total)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">
                                            Total Setelah Diskon
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                            {formatCurrency(previewSummary.subtotal_after_promo)}
                                        </p>
                                    </div>
                                </div>

                                {previewBundleNotApplied && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                        Harga bundle saat ini <span className="font-semibold">{formatCurrency(data.discount_value)}</span>, sedangkan subtotal contoh yang terbaca engine hanya <span className="font-semibold">{formatCurrency(previewSummary.base_subtotal)}</span>. Karena paket tidak lebih hemat, promo bundle tidak diterapkan pada preview ini.
                                    </div>
                                )}

                                {previewItems.length > 0 && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                                            Detail Item
                                        </h3>
                                        <div className="space-y-2">
                                            {previewItems.map((item) => (
                                                <div
                                                    key={`${item.cart_id}-${item.product_id}`}
                                                    className="rounded-xl bg-white px-4 py-3 text-sm dark:bg-slate-900"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-slate-100">
                                                                {item.product_title}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {item.qty} x {formatCurrency(item.base_unit_price)}
                                                            </p>
                                                            {item.pricing_group_label ? (
                                                                <p className="mt-1 text-xs text-primary-600 dark:text-primary-300">
                                                                    {item.pricing_group_label}
                                                                </p>
                                                            ) : null}
                                                            {(Number(item.tenant_discount_total || 0) > 0 || Number(item.owner_discount_total || 0) > 0) ? (
                                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            Potongan Tenant {formatCurrency(item.tenant_discount_total || 0)} • Potongan Owner {formatCurrency(item.owner_discount_total || 0)}
                                        </p>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                                {formatCurrency(item.line_total)}
                                                            </p>
                                                            {Number(item.line_discount_total || 0) > 0 ? (
                                                                <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                                                                    Hemat {formatCurrency(item.line_discount_total)}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {previewDiagnostics && (
                                    <details className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">
                                            Diagnostik
                                        </summary>
                                        <div className="mt-3 space-y-1">
                                            <p>
                                                Jenis: <span className="font-medium">{previewDiagnostics.kind}</span>
                                            </p>
                                            <p>
                                                Basis harga: <span className="font-medium">{previewDiagnostics.price_basis}</span>
                                            </p>
                                            <p>
                                                Nilai Diskon: <span className="font-medium">{formatCurrency(previewDiagnostics.draft_discount_value)}</span>
                                            </p>
                                            <p>
                                                Jumlah Keranjang: <span className="font-medium">{previewDiagnostics.cart_count}</span>
                                            </p>
                                        </div>
                                        {Array.isArray(previewDiagnostics.cart_items) && previewDiagnostics.cart_items.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {previewDiagnostics.cart_items.map((item, index) => (
                                                    <div key={`diag-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                                                        <p className="font-medium text-slate-800 dark:text-slate-100">
                                                            {item.product_title || `Product #${item.product_id}`}
                                                        </p>
                                                        <p>
                                                            qty {item.qty} • sell {formatCurrency(item.sell_price)} • buy {formatCurrency(item.buy_price)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </details>
                                )}

                                {previewGroups.length > 0 && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                                            Grup Diskon
                                        </h3>
                                        <div className="space-y-2">
                                            {previewGroups.map((group) => (
                                                <div
                                                    key={group.key}
                                                    className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm dark:bg-slate-900"
                                                >
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">
                                                        {group.label}
                                                    </span>
                                                    <span className="text-rose-600 dark:text-rose-300">
                                                        -{formatCurrency(group.discount_total)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardSection>

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                        <Button
                            type="link"
                            href={route("pricing-rules.index")}
                            className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            label="Batal"
                        />
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                        >
                            <IconDeviceFloppy size={18} />
                            {processing ? "Menyimpan..." : "Simpan Rule"}
                        </button>
                    </div>
                </form>
            </div>

            <Modal
                show={showInfoModal}
                onClose={() => setShowInfoModal(false)}
                title="Panduan Promo Harga"
                maxWidth="2xl"
            >
                <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                        <p className="font-semibold">Promo Tenant</p>
                        <p className="mt-1">
                            Dipakai saat outlet aktif adalah tenant atau workspace dapur. Perhitungan promonya memakai harga beli tenant, bukan harga jual owner.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                        <p className="font-semibold">Beban Diskon & Markup Owner</p>
                        <p className="mt-1">
                            Voucher/diskon selalu dipotong dari bagian tenant terlebih dahulu. Markup owner (sell_price - buy_price) tetap utuh diterima owner; owner baru menanggung bila diskon melebihi seluruh bagian tenant.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        <p className="font-semibold">Yang Harus Dicek</p>
                        <p className="mt-1">
                            Pastikan outlet aktif sudah benar, lalu cek <span className="font-semibold">Basis Harga</span>, target produk, dan preview promo sebelum menyimpan rule supaya promo tidak masuk ke sisi yang salah.
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
}
