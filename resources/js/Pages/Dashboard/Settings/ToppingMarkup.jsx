import React from "react";
import { Head, Link, useForm } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Button from "@/Components/Dashboard/Button";

const operatorOptions = [
    { value: "lt", label: "Harga <" },
    { value: "lte", label: "Harga <=" },
    { value: "eq", label: "Harga =" },
    { value: "gte", label: "Harga >=" },
    { value: "gt", label: "Harga >" },
    { value: "between", label: "Harga di antara" },
];

const markupTypeOptions = [
    { value: "fixed_amount", label: "Nominal tetap" },
    { value: "percentage", label: "Persentase" },
];

const emptyRule = () => ({
    label: "",
    operator: "lt",
    compare_value: "2000",
    compare_value_to: "",
    markup_type: "fixed_amount",
    markup_value: "0",
    is_active: true,
});

export default function ToppingMarkup({ settings = {}, workspace = {} }) {
    const { data, setData, post, processing, errors } = useForm({
        rules: Array.isArray(settings?.rules) && settings.rules.length > 0
            ? settings.rules.map((rule) => ({
                  label: rule.label || "",
                  operator: rule.operator || "lt",
                  compare_value: String(rule.compare_value ?? 0),
                  compare_value_to:
                      rule.compare_value_to !== null &&
                      rule.compare_value_to !== undefined
                          ? String(rule.compare_value_to)
                          : "",
                  markup_type: rule.markup_type || "fixed_amount",
                  markup_value: String(rule.markup_value ?? 0),
                  is_active: Boolean(rule.is_active ?? true),
              }))
            : [emptyRule()],
    });

    const updateRule = (index, key, value) => {
        setData(
            "rules",
            data.rules.map((rule, ruleIndex) =>
                ruleIndex === index ? { ...rule, [key]: value } : rule
            )
        );
    };

    const submit = (event) => {
        event.preventDefault();
        post(route("settings.topping-markup.update"));
    };

    return (
        <DashboardLayout>
            <Head title="Markup Topping" />

            <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            Markup Topping
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Harga dasar topping dari produk akan dinaikkan otomatis
                            sesuai rule pertama yang cocok. Setting ini berlaku global
                            untuk semua outlet, tenant, POS, dan self-order.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                Scope: {workspace?.scope_label || "Global"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Berlaku ke semua tenant dan outlet
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            label="Simpan Aturan"
                            onClick={submit}
                            disabled={processing}
                            className="bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-60"
                        />
                        <Link
                            href={route("settings.store")}
                            className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Kembali
                        </Link>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    {data.rules.map((rule, index) => (
                        <div
                            key={`rule-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    Rule {index + 1}
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setData(
                                            "rules",
                                            data.rules.filter((_, ruleIndex) => ruleIndex !== index)
                                        )
                                    }
                                    className="text-xs font-medium text-rose-500"
                                    disabled={data.rules.length <= 1}
                                >
                                    Hapus
                                </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Label
                                    </label>
                                    <input
                                        value={rule.label}
                                        onChange={(event) => updateRule(index, "label", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        placeholder="Contoh: topping murah"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Operator
                                    </label>
                                    <select
                                        value={rule.operator}
                                        onChange={(event) => updateRule(index, "operator", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    >
                                        {operatorOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Nilai pembanding
                                    </label>
                                    <input
                                        value={rule.compare_value}
                                        onChange={(event) => updateRule(index, "compare_value", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        inputMode="numeric"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Nilai kedua
                                    </label>
                                    <input
                                        value={rule.compare_value_to}
                                        onChange={(event) => updateRule(index, "compare_value_to", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        inputMode="numeric"
                                        placeholder={rule.operator === "between" ? "Wajib untuk between" : "Opsional"}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tipe markup
                                    </label>
                                    <select
                                        value={rule.markup_type}
                                        onChange={(event) => updateRule(index, "markup_type", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    >
                                        {markupTypeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Nilai markup
                                    </label>
                                    <input
                                        value={rule.markup_value}
                                        onChange={(event) => updateRule(index, "markup_value", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                        inputMode="numeric"
                                    />
                                </div>
                            </div>

                            <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(rule.is_active)}
                                    onChange={(event) => updateRule(index, "is_active", event.target.checked)}
                                    className="rounded border-slate-300 text-primary-600"
                                />
                                Rule aktif
                            </label>
                        </div>
                    ))}

                    {errors.rules ? (
                        <p className="text-sm text-rose-500">{errors.rules}</p>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => setData("rules", [...data.rules, emptyRule()])}
                            className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Tambah Rule
                        </button>
                        <Button
                            type="submit"
                            label="Simpan Aturan"
                            disabled={processing}
                            className="bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-60"
                        />
                    </div>

                    <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Perubahan di halaman ini akan langsung mempengaruhi preview dan harga efektif topping di seluruh sistem.
                            </p>
                            <Button
                                type="submit"
                                label="Simpan Aturan"
                                disabled={processing}
                                className="bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-60"
                            />
                        </div>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
