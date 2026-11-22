import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "@inertiajs/react";
import {
    IconPlus,
    IconTrash,
    IconCopy,
    IconChevronDown,
    IconChevronUp,
    IconToolsKitchen2,
    IconBolt,
    IconAdjustments,
    IconCategory,
    IconPackage,
    IconAlertCircle,
    IconCheck,
    IconSparkles,
    IconInfoCircle,
    IconEye,
    IconCircle,
    IconCircleFilled,
    IconDeviceMobile,
} from "@/Utils/icons";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

export const resolveModifierMarkupPreview = (basePrice, rules = []) => {
    const price = Math.max(0, Number(basePrice || 0));
    const activeRules = Array.isArray(rules) ? rules.filter((rule) => rule?.is_active !== false) : [];
    const matchedRule = activeRules.find((rule) => {
        const compareValue = Math.max(0, Number(rule?.compare_value || 0));
        const compareValueTo =
            rule?.compare_value_to === "" || rule?.compare_value_to === null || rule?.compare_value_to === undefined
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
                return (
                    compareValueTo !== null &&
                    price >= Math.min(compareValue, compareValueTo) &&
                    price <= Math.max(compareValue, compareValueTo)
                );
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

export const parseFlatOptionsToGroups = (flatOptions = []) => {
    if (!Array.isArray(flatOptions) || flatOptions.length === 0) {
        return [];
    }
    const groupMap = new Map();

    flatOptions.forEach((item, index) => {
        const groupName = (item.group_name || "Topping").trim() || "Topping";
        if (!groupMap.has(groupName)) {
            const rawSelectionMode = item.selection_mode || "optional";
            const minSelect = Number(item.min_select || 0);
            const maxSelect =
                item.max_select !== "" && item.max_select !== null && item.max_select !== undefined
                    ? Number(item.max_select)
                    : "";

            let visualMode = rawSelectionMode;
            if (rawSelectionMode === "single") {
                visualMode = "single";
            } else if (rawSelectionMode === "multiple" || minSelect > 0) {
                visualMode = minSelect > 0 ? "custom" : "optional";
            } else {
                visualMode = "optional";
            }

            groupMap.set(groupName, {
                id: `grp_${index}_${Math.random().toString(36).substring(2, 8)}`,
                name: groupName,
                order_type_scope: item.order_type_scope || "",
                selection_mode: visualMode,
                is_required: !!item.is_required || minSelect > 0,
                min_select: minSelect,
                max_select: maxSelect,
                options: [],
            });
        }

        const group = groupMap.get(groupName);
        group.options.push({
            id: `opt_${index}_${Math.random().toString(36).substring(2, 8)}`,
            name: item.name || "",
            price: item.price !== null && item.price !== undefined ? item.price : "",
            stock: item.stock !== null && item.stock !== undefined ? item.stock : "",
            is_required: !!item.is_required,
        });
    });

    return Array.from(groupMap.values());
};

export const serializeGroupsToFlatOptions = (groups = []) => {
    const flat = [];
    (groups || []).forEach((group, gIdx) => {
        const groupName = (group.name || "").trim() || "Topping";
        const scope = group.order_type_scope || "";
        const mode = group.selection_mode || "optional";

        let minSelect = 0;
        let maxSelect = "";
        let isRequired = !!group.is_required;

        if (mode === "single") {
            minSelect = isRequired ? 1 : 0;
            maxSelect = 1;
        } else if (mode === "optional") {
            minSelect = 0;
            maxSelect = group.max_select !== "" ? Number(group.max_select) : "";
        } else {
            // custom / multiple
            minSelect = Math.max(0, Number(group.min_select || 0));
            maxSelect = group.max_select !== "" ? Math.max(minSelect, Number(group.max_select)) : "";
            if (minSelect > 0) isRequired = true;
        }

        (group.options || []).forEach((opt, oIdx) => {
            flat.push({
                group_name: groupName,
                order_type_scope: scope,
                selection_mode: mode === "single" ? "single" : minSelect > 0 ? "multiple" : "optional",
                min_select: minSelect,
                max_select: maxSelect !== "" ? Number(maxSelect) : null,
                name: String(opt.name || "").trim(),
                price: Number(opt.price || 0),
                stock: opt.stock !== "" && opt.stock !== null && opt.stock !== undefined ? Number(opt.stock) : null,
                is_required: isRequired || !!opt.is_required,
                group_sort_order: gIdx,
                sort_order: oIdx,
            });
        });
    });
    return flat;
};

const PRESET_TEMPLATES = [
    {
        icon: IconBolt,
        title: "Level Pedas",
        description: "Pilihan 1 tingkat kepedasan (wajib)",
        categoryLabel: "Tingkat Kepedasan",
        create: () => ({
            id: `grp_${Date.now()}_pedas`,
            name: "Tingkat Kepedasan",
            order_type_scope: "",
            selection_mode: "single",
            is_required: true,
            min_select: 1,
            max_select: 1,
            options: [
                { id: `opt_${Date.now()}_1`, name: "Level 0 (Tidak Pedas)", price: 0, stock: "", is_required: true },
                { id: `opt_${Date.now()}_2`, name: "Level 1 (Sedang)", price: 0, stock: "", is_required: true },
                { id: `opt_${Date.now()}_3`, name: "Level 2 (Pedas Mantap)", price: 1000, stock: "", is_required: true },
                { id: `opt_${Date.now()}_4`, name: "Level 3 (Super Pedas)", price: 2000, stock: "", is_required: true },
            ],
        }),
    },
    {
        icon: IconSparkles,
        title: "Pilihan Suhu & Es",
        description: "Pilihan 1 temperatur / takaran es",
        categoryLabel: "Pilihan Es & Suhu",
        create: () => ({
            id: `grp_${Date.now()}_ice`,
            name: "Pilihan Es & Suhu",
            order_type_scope: "",
            selection_mode: "single",
            is_required: true,
            min_select: 1,
            max_select: 1,
            options: [
                { id: `opt_${Date.now()}_1`, name: "Normal Ice (Es Standar)", price: 0, stock: "", is_required: true },
                { id: `opt_${Date.now()}_2`, name: "Less Ice (Sedikit Es)", price: 0, stock: "", is_required: true },
                { id: `opt_${Date.now()}_3`, name: "Hangat / No Ice", price: 0, stock: "", is_required: true },
            ],
        }),
    },
    {
        icon: IconAdjustments,
        title: "Ukuran Porsi",
        description: "Pilihan ukuran reguler / besar",
        categoryLabel: "Ukuran Porsi",
        create: () => ({
            id: `grp_${Date.now()}_size`,
            name: "Ukuran Porsi",
            order_type_scope: "",
            selection_mode: "single",
            is_required: true,
            min_select: 1,
            max_select: 1,
            options: [
                { id: `opt_${Date.now()}_1`, name: "Ukuran Regular", price: 0, stock: "", is_required: true },
                { id: `opt_${Date.now()}_2`, name: "Ukuran Large", price: 4000, stock: "", is_required: true },
                { id: `opt_${Date.now()}_3`, name: "Ukuran Jumbo", price: 7000, stock: "", is_required: true },
            ],
        }),
    },
    {
        icon: IconCategory,
        title: "Extra Topping",
        description: "Tambahan topping bebas centang",
        categoryLabel: "Topping Tambahan",
        create: () => ({
            id: `grp_${Date.now()}_top`,
            name: "Topping Tambahan",
            order_type_scope: "",
            selection_mode: "optional",
            is_required: false,
            min_select: 0,
            max_select: "",
            options: [
                { id: `opt_${Date.now()}_1`, name: "Keju Parut Cheddar", price: 3000, stock: "", is_required: false },
                { id: `opt_${Date.now()}_2`, name: "Telur Ceplok Mata Sapi", price: 4000, stock: 25, is_required: false },
                { id: `opt_${Date.now()}_3`, name: "Sosis Panggang / Kornet", price: 5000, stock: "", is_required: false },
            ],
        }),
    },
    {
        icon: IconPackage,
        title: "Kemasan Bawa Pulang",
        description: "Khusus bungkus (Take-Away)",
        categoryLabel: "Opsi Kemasan & Alat Makan",
        create: () => ({
            id: `grp_${Date.now()}_ta`,
            name: "Opsi Kemasan & Alat Makan",
            order_type_scope: "take_away",
            selection_mode: "optional",
            is_required: false,
            min_select: 0,
            max_select: "",
            options: [
                { id: `opt_${Date.now()}_1`, name: "Sendok & Garpu Plastik", price: 0, stock: "", is_required: false },
                { id: `opt_${Date.now()}_2`, name: "Paper Bag Ramah Lingkungan", price: 1500, stock: "", is_required: false },
                { id: `opt_${Date.now()}_3`, name: "Extra Sambal Sachet", price: 1000, stock: "", is_required: false },
            ],
        }),
    },
];

export default function ModifierBuilder({
    supportsModifiers = false,
    setSupportsModifiers,
    requiresModifierSelection = false,
    setRequiresModifierSelection,
    modifierOptions = [],
    onChangeModifierOptions,
    toppingMarkupSettings = {},
    disabled = false,
}) {
    const isInternalUpdateRef = useRef(false);
    const [groups, setGroups] = useState(() => parseFlatOptionsToGroups(modifierOptions));
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [groupPreviewToggles, setGroupPreviewToggles] = useState({});
    const [activeViewTab, setActiveViewTab] = useState("editor"); // "editor" | "simulation"
    const [simulatedSelections, setSimulatedSelections] = useState({});

    const toppingMarkupRules = toppingMarkupSettings?.rules || [];

    // Inisialisasi awal & sinkronisasi dari luar
    useEffect(() => {
        if (isInternalUpdateRef.current) {
            isInternalUpdateRef.current = false;
            return;
        }
        setGroups(parseFlatOptionsToGroups(modifierOptions));
    }, [modifierOptions]);

    const notifyChange = (newGroups) => {
        isInternalUpdateRef.current = true;
        setGroups(newGroups);
        const flat = serializeGroupsToFlatOptions(newGroups);
        if (onChangeModifierOptions) {
            onChangeModifierOptions(flat);
        }
    };

    // Tambah Kelompok Baru
    const handleAddGroup = () => {
        const newGroup = {
            id: `grp_${Date.now()}`,
            name: `Kelompok Topping ${groups.length + 1}`,
            order_type_scope: "",
            selection_mode: "optional",
            is_required: false,
            min_select: 0,
            max_select: "",
            options: [
                {
                    id: `opt_${Date.now()}_1`,
                    name: "",
                    price: 0,
                    stock: "",
                    is_required: false,
                },
            ],
        };
        notifyChange([...groups, newGroup]);
    };

    // Terapkan Template Preset
    const handleApplyPreset = (template) => {
        const newGroup = template.create();
        notifyChange([...groups, newGroup]);
    };

    // Update metadata kelompok
    const handleUpdateGroup = (groupId, key, value) => {
        const nextGroups = groups.map((g) => {
            if (g.id !== groupId) return g;
            const updated = { ...g, [key]: value };

            if (key === "selection_mode") {
                if (value === "single") {
                    updated.is_required = true;
                    updated.min_select = 1;
                    updated.max_select = 1;
                } else if (value === "optional") {
                    updated.is_required = false;
                    updated.min_select = 0;
                    updated.max_select = "";
                } else if (value === "custom") {
                    updated.min_select = updated.min_select || 1;
                    updated.is_required = true;
                }
            }

            return updated;
        });
        notifyChange(nextGroups);
    };

    // Duplikat kelompok
    const handleDuplicateGroup = (group) => {
        const duplicated = {
            ...group,
            id: `grp_${Date.now()}`,
            name: `${group.name} (Salinan)`,
            options: group.options.map((opt, i) => ({
                ...opt,
                id: `opt_${Date.now()}_${i}`,
            })),
        };
        notifyChange([...groups, duplicated]);
    };

    // Hapus kelompok
    const handleDeleteGroup = (groupId) => {
        notifyChange(groups.filter((g) => g.id !== groupId));
    };

    // Tambah pilihan di dalam kelompok
    const handleAddOption = (groupId) => {
        const nextGroups = groups.map((g) => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                options: [
                    ...g.options,
                    {
                        id: `opt_${Date.now()}`,
                        name: "",
                        price: 0,
                        stock: "",
                        is_required: false,
                    },
                ],
            };
        });
        notifyChange(nextGroups);
    };

    // Update pilihan
    const handleUpdateOption = (groupId, optionId, key, value) => {
        const nextGroups = groups.map((g) => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                options: g.options.map((opt) => (opt.id === optionId ? { ...opt, [key]: value } : opt)),
            };
        });
        notifyChange(nextGroups);
    };

    // Hapus pilihan
    const handleDeleteOption = (groupId, optionId) => {
        const nextGroups = groups.map((g) => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                options: g.options.filter((opt) => opt.id !== optionId),
            };
        });
        notifyChange(nextGroups);
    };

    const toggleCollapse = (groupId) => {
        setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const toggleGroupPreview = (groupId) => {
        setGroupPreviewToggles((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // Simulasi interaktif klik opsi di preview
    const handleSimulateClick = (group, option) => {
        setSimulatedSelections((prev) => {
            const currentGroupSelections = prev[group.id] || [];

            if (group.selection_mode === "single") {
                return { ...prev, [group.id]: [option.id] };
            }

            // Mode Checkbox / Bebas / Kustom
            if (currentGroupSelections.includes(option.id)) {
                return {
                    ...prev,
                    [group.id]: currentGroupSelections.filter((id) => id !== option.id),
                };
            } else {
                if (group.selection_mode === "custom" && group.max_select) {
                    if (currentGroupSelections.length >= Number(group.max_select)) {
                        return prev; // tidak bisa melebihi batas max
                    }
                }
                return {
                    ...prev,
                    [group.id]: [...currentGroupSelections, option.id],
                };
            }
        });
    };

    const totalOptionsCount = useMemo(
        () => groups.reduce((acc, g) => acc + (g.options?.length || 0), 0),
        [groups]
    );

    // Hitung total simulasi biaya tambahan
    const simulatedExtraPrice = useMemo(() => {
        let total = 0;
        groups.forEach((g) => {
            const selectedIds = simulatedSelections[g.id] || [];
            g.options.forEach((opt) => {
                if (selectedIds.includes(opt.id)) {
                    total += Number(opt.price || 0);
                }
            });
        });
        return total;
    }, [groups, simulatedSelections]);

    return (
        <div className="space-y-6">
            {/* Card Switch Utama Topping */}
            <div className="rounded-2xl border-2 border-primary-200 bg-gradient-to-r from-primary-50/80 via-white to-primary-50/30 p-5 shadow-sm transition dark:border-primary-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-primary-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-md shadow-primary-500/20 dark:bg-primary-600">
                            <IconToolsKitchen2 size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                    Aktifkan Topping, Varian & Add-on
                                </h3>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        supportsModifiers
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                                >
                                    {supportsModifiers ? "Aktif" : "Non-aktif"}
                                </span>
                            </div>
                            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                Aktifkan jika produk ini memiliki pilihan rasa, level pedas, ukuran cup, atau ekstra topping saat diorder di kasir dan meja.
                            </p>
                        </div>
                    </div>

                    {/* Toggle Switch */}
                    <label className="relative inline-flex cursor-pointer items-center self-start sm:self-auto">
                        <input
                            type="checkbox"
                            checked={supportsModifiers}
                            disabled={disabled}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setSupportsModifiers(checked);
                                if (!checked && setRequiresModifierSelection) {
                                    setRequiresModifierSelection(false);
                                }
                            }}
                            className="peer sr-only"
                        />
                        <div className="peer h-7 w-14 rounded-full bg-slate-200 after:absolute after:left-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-7 peer-focus:outline-none dark:bg-slate-700 dark:peer-checked:bg-primary-500"></div>
                    </label>
                </div>

                {/* Sub-Switch: Wajib Memilih Topping */}
                {supportsModifiers && (
                    <div className="mt-4 pt-4 border-t border-primary-200/60 dark:border-primary-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Wajib Memilih Topping?
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                (Pelanggan / kasir tidak bisa checkout sebelum memilih salah satu varian yang bertanda wajib)
                            </span>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                checked={requiresModifierSelection}
                                disabled={disabled}
                                onChange={(e) => setRequiresModifierSelection && setRequiresModifierSelection(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-5 peer-focus:outline-none dark:bg-slate-700 dark:peer-checked:bg-amber-500"></div>
                        </label>
                    </div>
                )}
            </div>

            {/* Bagian Konten Jika Topping Aktif */}
            {supportsModifiers && (
                <div className="space-y-6">
                    {/* Edukasi Pembeda Visual: Kelompok vs Pilihan */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                                <IconInfoCircle size={18} />
                            </div>
                            <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                                <p className="font-bold text-sm">
                                    Cara Kerja Pengaturan Topping & Varian:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div className="rounded-xl bg-white/80 p-2.5 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-900/50">
                                        <p className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">1</span>
                                            Kelompok / Grup Varian
                                        </p>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                            Wadah pengelompokan seperti: <strong>"Pilihan Level Pedas"</strong>, <strong>"Ukuran Porsi"</strong>, atau <strong>"Ekstra Topping"</strong>.
                                        </p>
                                    </div>
                                    <div className="rounded-xl bg-white/80 p-2.5 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-900/50">
                                        <p className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">2</span>
                                            Pilihan Opsi Topping (Isi)
                                        </p>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                            Item di dalamnya seperti: <strong>Level 0</strong>, <strong>Level 1 (+Rp 0)</strong>, atau <strong>Keju (+Rp 3.000)</strong>, <strong>Telur (+Rp 4.000)</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Template Cepat (1-Klik Tambah) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <IconSparkles size={18} className="text-amber-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                    Template Cepat (1-Klik Siap Pakai)
                                </span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Klik salah satu untuk otomatis membuat kelompok varian lengkap dengan contoh pilihan
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                            {PRESET_TEMPLATES.map((tpl, idx) => {
                                const IconComp = tpl.icon;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => handleApplyPreset(tpl)}
                                        className="group flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-primary-400 hover:bg-primary-50/60 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-primary-600 dark:hover:bg-primary-950/20"
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm transition group-hover:bg-primary-500 group-hover:text-white dark:bg-slate-700 dark:text-slate-200">
                                            <IconComp size={16} />
                                        </div>
                                        <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                                            {tpl.title}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                            {tpl.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Header Navigasi Mode: Editor vs Simulasi Kasir Penuh */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                        {/* Tab Switch */}
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                            <button
                                type="button"
                                onClick={() => setActiveViewTab("editor")}
                                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                                    activeViewTab === "editor"
                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300"
                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                            >
                                <IconToolsKitchen2 size={16} />
                                <span>Mode Pengaturan ({groups.length} Kelompok)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveViewTab("simulation")}
                                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                                    activeViewTab === "simulation"
                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300"
                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                            >
                                <IconEye size={16} />
                                <span>Simulasi Tampilan Kasir & Pelanggan</span>
                            </button>
                        </div>

                        {/* Action Buttons Kanan */}
                        <div className="flex items-center gap-2">
                            <Link
                                href={route("settings.topping-markup")}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-primary-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <IconInfoCircle size={15} />
                                Atur Markup Topping
                            </Link>

                            <button
                                type="button"
                                disabled={disabled}
                                onClick={handleAddGroup}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 active:scale-[0.98]"
                            >
                                <IconPlus size={16} />
                                + Buat Kelompok Topping Baru
                            </button>
                        </div>
                    </div>

                    {/* ========================================================
                        TAB 1: MODE EDITOR LENGKAP DENGAN PREVIEW PER KELOMPOK
                        ======================================================== */}
                    {activeViewTab === "editor" && (
                        <div className="space-y-6">
                            {/* Empty State */}
                            {groups.length === 0 && (
                                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400">
                                        <IconToolsKitchen2 size={28} />
                                    </div>
                                    <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                                        Belum Ada Kelompok Topping
                                    </h4>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                        Buat kelompok topping baru (misal: "Level Pedas" atau "Pilihan Ukuran") atau gunakan salah satu template siap pakai di atas.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleAddGroup}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-primary-700"
                                    >
                                        <IconPlus size={16} />
                                        Buat Kelompok Pertama
                                    </button>
                                </div>
                            )}

                            {/* Daftar Kartu Kelompok */}
                            {groups.map((group, groupIndex) => {
                                const isCollapsed = !!collapsedGroups[group.id];
                                const isPreviewOpen = !!groupPreviewToggles[group.id];

                                return (
                                    <div
                                        key={group.id}
                                        className="overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        {/* HEADER KELOMPOK (TEGAS & JELAS) */}
                                        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 dark:border-slate-800 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                                {/* Label Kelompok & Input Nama Kelompok */}
                                                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-xs font-black text-white shadow-sm">
                                                        #{groupIndex + 1}
                                                    </span>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                                                                Kelompok / Grup Varian
                                                            </span>
                                                            {group.selection_mode === "single" ? (
                                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/70 dark:text-red-300">
                                                                    ● Wajib Pilih 1
                                                                </span>
                                                            ) : group.selection_mode === "optional" ? (
                                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                                                                    ○ Bebas Centang (Opsional)
                                                                </span>
                                                            ) : (
                                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                                                                    Batas: Min {group.min_select || 0} - Max {group.max_select || "Bebas"}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <input
                                                            type="text"
                                                            value={group.name}
                                                            disabled={disabled}
                                                            onChange={(e) =>
                                                                handleUpdateGroup(group.id, "name", e.target.value)
                                                            }
                                                            placeholder="Nama Kelompok (cth: Pilihan Tingkat Kepedasan / Tambahan Extra Topping)"
                                                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Action Buttons Kanan */}
                                                <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                                                    {/* Tombol Preview Mini */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroupPreview(group.id)}
                                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                                                            isPreviewOpen
                                                                ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
                                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                        }`}
                                                    >
                                                        <IconEye size={15} />
                                                        <span>{isPreviewOpen ? "Tutup Preview" : "Preview Kasir"}</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateGroup(group)}
                                                        title="Duplikat Kelompok Ini"
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                    >
                                                        <IconCopy size={14} />
                                                        <span className="hidden sm:inline">Duplikat</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        title="Hapus Kelompok Ini"
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                                                    >
                                                        <IconTrash size={14} />
                                                        <span className="hidden sm:inline">Hapus</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapse(group.id)}
                                                        className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                                    >
                                                        {isCollapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* LIVE MINI PREVIEW JIKA DIBUKA */}
                                            {isPreviewOpen && (
                                                <div className="mt-4 rounded-2xl border-2 border-primary-300 bg-white p-4 shadow-inner dark:border-primary-800 dark:bg-slate-900">
                                                    <div className="flex items-center justify-between mb-3 border-b pb-2 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <IconDeviceMobile size={18} className="text-primary-600" />
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                Simulasi Layar Kasir / Self-Order untuk "{group.name || "Kelompok Ini"}"
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] text-slate-400">
                                                            (Klik opsi untuk mencoba interaksi)
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2 max-w-lg">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                                {group.name || "Nama Kelompok"}
                                                            </p>
                                                            {group.selection_mode === "single" ? (
                                                                <span className="text-xs font-extrabold text-red-600 dark:text-red-400">
                                                                    * Wajib pilih 1
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs font-medium text-slate-500">
                                                                    Opsional (Pilihan bebas)
                                                                </span>
                                                            )}
                                                        </div>

                                                        {group.options.length === 0 ? (
                                                            <p className="text-xs text-slate-400 italic">
                                                                Belum ada pilihan opsi di kelompok ini.
                                                            </p>
                                                        ) : (
                                                            group.options.map((opt) => {
                                                                const isSelected = (
                                                                    simulatedSelections[group.id] || []
                                                                ).includes(opt.id);

                                                                return (
                                                                    <div
                                                                        key={opt.id}
                                                                        onClick={() => handleSimulateClick(group, opt)}
                                                                        className={`flex items-center justify-between rounded-xl p-3 cursor-pointer border transition ${
                                                                            isSelected
                                                                                ? "border-primary-500 bg-primary-50/80 dark:bg-primary-950/40 dark:border-primary-600"
                                                                                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            {group.selection_mode === "single" ? (
                                                                                <div
                                                                                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                                                                        isSelected
                                                                                            ? "border-primary-600 bg-primary-600"
                                                                                            : "border-slate-400"
                                                                                    }`}
                                                                                >
                                                                                    {isSelected && (
                                                                                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                                                                                        isSelected
                                                                                            ? "border-primary-600 bg-primary-600 text-white"
                                                                                            : "border-slate-400"
                                                                                    }`}
                                                                                >
                                                                                    {isSelected && <IconCheck size={12} />}
                                                                                </div>
                                                                            )}
                                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                                                {opt.name || "Nama Opsi"}
                                                                            </span>
                                                                        </div>

                                                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                                            {Number(opt.price || 0) > 0
                                                                                ? `+${formatCurrency(opt.price)}`
                                                                                : "Gratis"}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* PENGATURAN ATURAN (MODE & SCOPE) */}
                                            {!isCollapsed && (
                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    {/* Aturan Pemilihan */}
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                                            Aturan Pemilihan Untuk Pelanggan
                                                        </label>
                                                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateGroup(group.id, "selection_mode", "single")}
                                                                className={`flex flex-col items-center justify-center py-2 px-1 text-center rounded-lg transition ${
                                                                    group.selection_mode === "single"
                                                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300 font-bold"
                                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                                }`}
                                                            >
                                                                <span className="text-xs font-bold">🔘 Wajib Pilih 1</span>
                                                                <span className="text-[10px] opacity-75">Tipe Radio</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateGroup(group.id, "selection_mode", "optional")}
                                                                className={`flex flex-col items-center justify-center py-2 px-1 text-center rounded-lg transition ${
                                                                    group.selection_mode === "optional"
                                                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300 font-bold"
                                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                                }`}
                                                            >
                                                                <span className="text-xs font-bold">☑️ Bebas Centang</span>
                                                                <span className="text-[10px] opacity-75">Opsional</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateGroup(group.id, "selection_mode", "custom")}
                                                                className={`flex flex-col items-center justify-center py-2 px-1 text-center rounded-lg transition ${
                                                                    group.selection_mode === "custom"
                                                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300 font-bold"
                                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                                }`}
                                                            >
                                                                <span className="text-xs font-bold">🔢 Batas Kustom</span>
                                                                <span className="text-[10px] opacity-75">Min - Max</span>
                                                            </button>
                                                        </div>

                                                        {/* Sub-keterangan Aturan */}
                                                        <p className="mt-1.5 text-[11px] text-slate-500">
                                                            {group.selection_mode === "single"
                                                                ? "Pelanggan wajib memilih tepat 1 opsi (contoh: Level Pedas 0, 1, atau 2)."
                                                                : group.selection_mode === "optional"
                                                                ? "Pelanggan bebas mencentang topping yang disukai atau melewatinya."
                                                                : "Pelanggan wajib memilih dengan batasan jumlah tertentu."}
                                                        </p>

                                                        {/* Input Batas Min & Max jika Custom */}
                                                        {group.selection_mode === "custom" && (
                                                            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Min:</span>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={50}
                                                                        value={group.min_select}
                                                                        onChange={(e) => handleUpdateGroup(group.id, "min_select", e.target.value)}
                                                                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs text-center font-bold focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Max:</span>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={50}
                                                                        value={group.max_select}
                                                                        placeholder="Bebas"
                                                                        onChange={(e) => handleUpdateGroup(group.id, "max_select", e.target.value)}
                                                                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs text-center font-bold focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                                                                    />
                                                                </div>
                                                                <span className="text-[11px] text-slate-500">
                                                                    (Kosongkan max jika tanpa batas)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Lingkup Pesanan (Order Type Scope) */}
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                                            Berlaku Pada Jenis Pesanan
                                                        </label>
                                                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateGroup(group.id, "order_type_scope", "")}
                                                                className={`flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition ${
                                                                    !group.order_type_scope
                                                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300 font-bold"
                                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                                }`}
                                                            >
                                                                <span>Semua Pesanan</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateGroup(group.id, "order_type_scope", "dine_in")}
                                                                className={`flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition ${
                                                                    group.order_type_scope === "dine_in"
                                                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300 font-bold"
                                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                                }`}
                                                            >
                                                                <span>Dine In Saja</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateGroup(group.id, "order_type_scope", "take_away")}
                                                                className={`flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition ${
                                                                    group.order_type_scope === "take_away"
                                                                        ? "bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300 font-bold"
                                                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                                }`}
                                                            >
                                                                <span>Bungkus Saja</span>
                                                            </button>
                                                        </div>
                                                        <p className="mt-1.5 text-[11px] text-slate-500">
                                                            {!group.order_type_scope
                                                                ? "Muncul di semua transaksi (makan di tempat dan bawa pulang)."
                                                                : group.order_type_scope === "dine_in"
                                                                ? "Hanya muncul saat pelanggan memilih makan di tempat (Dine In)."
                                                                : "Hanya muncul saat pesanan dibawa pulang / bungkus (Take-Away)."}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* DAFTAR PILIHAN TOOPING DI DALAM KELOMPOK (LEVEL 2) */}
                                        {!isCollapsed && (
                                            <div className="p-4 space-y-3 bg-slate-50/30 dark:bg-slate-900/40">
                                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                                                    <div>
                                                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                            <span>Pilihan Opsi Topping</span>
                                                            <span className="rounded-full bg-primary-100 px-2 py-0.2 text-[10px] font-black text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                                                                {group.options.length} Item
                                                            </span>
                                                        </h5>
                                                        <p className="text-[11px] text-slate-500">
                                                            Item pilihan yang bisa diklik atau dicentang di dalam kelompok "{group.name || "Kelompok Ini"}".
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={disabled}
                                                        onClick={() => handleAddOption(group.id)}
                                                        className="inline-flex items-center gap-1 rounded-xl bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 transition dark:bg-primary-950/60 dark:text-primary-300"
                                                    >
                                                        <IconPlus size={14} />
                                                        + Tambah Pilihan
                                                    </button>
                                                </div>

                                                {group.options.length === 0 ? (
                                                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                        Belum ada pilihan opsi di kelompok ini. Klik "+ Tambah Pilihan" di atas.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {/* Header Kolom Opsi */}
                                                        <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            <div className="sm:col-span-5">Nama Pilihan Opsi</div>
                                                            <div className="sm:col-span-3">Biaya Tambahan (+Rp)</div>
                                                            <div className="sm:col-span-3">Stok Terbatas (Opsional)</div>
                                                            <div className="sm:col-span-1 text-center">Hapus</div>
                                                        </div>

                                                        {/* Baris Pilihan Opsi */}
                                                        {group.options.map((option, optIdx) => {
                                                            const markupCalc = resolveModifierMarkupPreview(
                                                                option.price,
                                                                toppingMarkupRules
                                                            );

                                                            return (
                                                                <div
                                                                    key={option.id}
                                                                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                                                                >
                                                                    {/* Nama Pilihan */}
                                                                    <div className="sm:col-span-5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                                                {optIdx + 1}
                                                                            </span>
                                                                            <input
                                                                                type="text"
                                                                                value={option.name}
                                                                                disabled={disabled}
                                                                                onChange={(e) =>
                                                                                    handleUpdateOption(
                                                                                        group.id,
                                                                                        option.id,
                                                                                        "name",
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                placeholder="Nama opsi (cth: Keju Parut / Level 1)"
                                                                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Tambahan Harga */}
                                                                    <div className="sm:col-span-3">
                                                                        <div className="relative">
                                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                                                                                +Rp
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                min={0}
                                                                                value={option.price}
                                                                                disabled={disabled}
                                                                                onChange={(e) =>
                                                                                    handleUpdateOption(
                                                                                        group.id,
                                                                                        option.id,
                                                                                        "price",
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                placeholder="0 = Gratis"
                                                                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-2 py-1.5 text-xs font-bold text-slate-800 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                            />
                                                                        </div>
                                                                        {markupCalc.markupPrice > 0 && (
                                                                            <span className="mt-0.5 block text-[10px] text-primary-600 dark:text-primary-400">
                                                                                Harga Kasir: {formatCurrency(markupCalc.effectivePrice)}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Stok */}
                                                                    <div className="sm:col-span-3">
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            value={option.stock}
                                                                            disabled={disabled}
                                                                            onChange={(e) =>
                                                                                handleUpdateOption(
                                                                                    group.id,
                                                                                    option.id,
                                                                                    "stock",
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            placeholder="Tak Terbatas"
                                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                                        />
                                                                    </div>

                                                                    {/* Tombol Hapus */}
                                                                    <div className="sm:col-span-1 flex justify-end sm:justify-center">
                                                                        <button
                                                                            type="button"
                                                                            disabled={disabled}
                                                                            onClick={() =>
                                                                                handleDeleteOption(group.id, option.id)
                                                                            }
                                                                            title="Hapus Opsi Ini"
                                                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                                                        >
                                                                            <IconTrash size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        disabled={disabled}
                                                        onClick={() => handleAddOption(group.id)}
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 bg-primary-50/40 px-3.5 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100/70 hover:border-primary-400 transition dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300"
                                                    >
                                                        <IconPlus size={15} />
                                                        + Tambah Pilihan Baru di "{group.name || "Kelompok Ini"}"
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ========================================================
                        TAB 2: SIMULASI LENGKAP TAMPILAN KASIR & PELANGGAN
                        ======================================================== */}
                    {activeViewTab === "simulation" && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
                            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
                                <div>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <IconDeviceMobile size={20} className="text-primary-600" />
                                        Simulasi Tampilan Dialog Pesanan (POS & QR Menu)
                                    </h4>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        Ini adalah preview interaktif nyata bagaimana kasir dan pelanggan akan memilih topping produk ini.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSimulatedSelections({})}
                                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                                >
                                    Reset Pilihan Simulasi
                                </button>
                            </div>

                            {groups.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center italic">
                                    Belum ada kelompok topping yang dibuat. Silakan tambahkan di Mode Pengaturan.
                                </p>
                            ) : (
                                <div className="max-w-xl mx-auto space-y-5">
                                    {groups.map((group) => {
                                        return (
                                            <div
                                                key={group.id}
                                                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3"
                                            >
                                                {/* Header Kelompok di Layar Pesanan */}
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                            {group.name || "Nama Kelompok"}
                                                        </h5>
                                                        <p className="text-[11px] text-slate-500">
                                                            {group.selection_mode === "single"
                                                                ? "Pilih 1 opsi"
                                                                : group.selection_mode === "custom"
                                                                ? `Pilih ${group.min_select || 0} - ${group.max_select || "bebas"} opsi`
                                                                : "Pilihan bebas (boleh dilewati)"}
                                                        </p>
                                                    </div>

                                                    {group.selection_mode === "single" ? (
                                                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-extrabold text-red-700 dark:bg-red-950/70 dark:text-red-300">
                                                            Wajib
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                            Opsional
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Opsi-opsi */}
                                                <div className="space-y-1.5">
                                                    {group.options.map((opt) => {
                                                        const isSelected = (
                                                            simulatedSelections[group.id] || []
                                                        ).includes(opt.id);

                                                        return (
                                                            <div
                                                                key={opt.id}
                                                                onClick={() => handleSimulateClick(group, opt)}
                                                                className={`flex items-center justify-between rounded-xl p-3 cursor-pointer border transition ${
                                                                    isSelected
                                                                        ? "border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-950/50 dark:border-primary-500 dark:text-primary-100 font-bold"
                                                                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {group.selection_mode === "single" ? (
                                                                        <div
                                                                            className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                                                                isSelected
                                                                                    ? "border-primary-600 bg-primary-600"
                                                                                    : "border-slate-400"
                                                                            }`}
                                                                        >
                                                                            {isSelected && (
                                                                                <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                                                                                isSelected
                                                                                    ? "border-primary-600 bg-primary-600 text-white"
                                                                                    : "border-slate-400"
                                                                            }`}
                                                                        >
                                                                            {isSelected && <IconCheck size={12} />}
                                                                        </div>
                                                                    )}
                                                                    <span className="text-xs">
                                                                        {opt.name || "Nama Opsi"}
                                                                    </span>
                                                                </div>

                                                                <span className="text-xs font-semibold">
                                                                    {Number(opt.price || 0) > 0
                                                                        ? `+${formatCurrency(opt.price)}`
                                                                        : "Gratis"}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Footer Simulasi */}
                                    <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-900/50 dark:bg-primary-950/30 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold text-primary-800 dark:text-primary-300">
                                                Total Tambahan Topping Terpilih:
                                            </p>
                                            <p className="text-lg font-black text-primary-700 dark:text-primary-400">
                                                +{formatCurrency(simulatedExtraPrice)}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setActiveViewTab("editor")}
                                            className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700"
                                        >
                                            Kembali ke Editor
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
