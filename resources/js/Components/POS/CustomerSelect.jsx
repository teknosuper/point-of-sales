import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
    IconCrown,
    IconUser,
    IconSearch,
    IconCheck,
    IconUserPlus,
    IconX,
} from "@/Utils/icons";
import { CustomerHistoryButton } from "./CustomerHistoryPanel";
import AddCustomerModal from "./AddCustomerModal";

const WALK_IN_CUSTOMER = {
    id: "walk_in",
    name: "Pelanggan Umum / Walk-in",
    no_telp: "",
    member_code: "",
    is_loyalty_member: false,
    is_walk_in: true,
    loyalty_tier: null,
    loyalty_points: 0,
};

export default function CustomerSelect({
    customers = [],
    selected,
    onSelect,
    placeholder = "Pilih pelanggan...",
    error,
    label,
    onCustomerAdded,
    tierOptions = [],
    openAddModalSignal = 0,
}) {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [availableCustomers, setAvailableCustomers] = useState(customers);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

    useEffect(() => {
        setAvailableCustomers(customers);
    }, [customers]);

    useEffect(() => {
        if (!isPickerOpen) {
            return;
        }

        let cancelled = false;
        const normalizedSearch = search.trim();
        const timerId = window.setTimeout(async () => {
            setIsLoadingCustomers(true);

            try {
                const response = await axios.get(route("customers.lookup"), {
                    params: {
                        search: normalizedSearch,
                        limit: normalizedSearch ? 20 : 12,
                    },
                });

                if (!cancelled) {
                    setAvailableCustomers(response.data?.data || []);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Customer lookup error:", error);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingCustomers(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timerId);
        };
    }, [isPickerOpen, search]);

    const filteredCustomers = useMemo(() => {
        const normalizedSearch = search.toLowerCase();
        const pool = availableCustomers.filter(
            (customer) =>
                customer.name?.toLowerCase().includes(normalizedSearch) ||
                customer.no_telp?.toLowerCase().includes(normalizedSearch) ||
                customer.member_code?.toLowerCase().includes(normalizedSearch)
        );

        const selectedCustomerIncluded =
            selected &&
            !selected.is_walk_in &&
            !pool.some((customer) => Number(customer.id) === Number(selected.id));

        return [
            WALK_IN_CUSTOMER,
            ...(selectedCustomerIncluded ? [selected] : []),
            ...pool,
        ].filter((customer, index, array) => {
            if (customer.is_walk_in) {
                return (
                    customer.name.toLowerCase().includes(normalizedSearch) ||
                    "umum".includes(normalizedSearch) ||
                    "walk-in".includes(normalizedSearch) ||
                    "walk in".includes(normalizedSearch)
                );
            }

            return (
                array.findIndex(
                    (item) => Number(item.id) === Number(customer.id)
                ) === index
            );
        });
    }, [availableCustomers, search, selected]);

    useEffect(() => {
        if (openAddModalSignal > 0) {
            setShowAddModal(false);
            setIsPickerOpen(true);
        }
    }, [openAddModalSignal]);

    const handleSelect = (customer) => {
        onSelect(customer);
        setIsPickerOpen(false);
        setSearch("");
    };

    const handleAddCustomerSuccess = (newCustomer) => {
        setShowAddModal(false);
        setAvailableCustomers((current) => [newCustomer, ...current]);
        onCustomerAdded?.(newCustomer);
        onSelect?.(newCustomer);
    };

    const handleUpgradeMember = async () => {
        if (!selected || selected.is_loyalty_member || selected.is_walk_in) {
            return;
        }

        try {
            const response = await axios.post(
                route("customers.upgrade-member", selected.id),
                {
                    loyalty_tier: tierOptions[0]?.value || "regular",
                }
            );

            if (response.data.success) {
                onSelect?.(response.data.customer);
                setAvailableCustomers((current) =>
                    current.map((customer) =>
                        Number(customer.id) === Number(response.data.customer.id)
                            ? response.data.customer
                            : customer
                    )
                );
            }
        } catch (error) {
            console.error("Upgrade member error:", error);
        }
    };

    return (
        <>
            <div className="relative">
                {label && (
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {label}
                    </label>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <div
                                className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                                    selected
                                        ? "bg-primary-100 dark:bg-primary-900/50"
                                        : "bg-slate-100 dark:bg-slate-800"
                                }`}
                            >
                                <IconUser
                                    size={18}
                                    className={
                                        selected
                                            ? "text-primary-600 dark:text-primary-400"
                                            : "text-slate-400"
                                    }
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {selected?.name || placeholder}
                                </p>
                                <p className="mt-1 text-[11px] text-primary-500 dark:text-primary-300">
                                    {selected?.is_walk_in
                                        ? "Default pelanggan umum"
                                        : selected?.is_loyalty_member
                                        ? `${selected.loyalty_tier} • ${selected.loyalty_points || 0} poin`
                                        : "Pelanggan terdaftar"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPickerOpen(true)}
                            className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-100 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300"
                        >
                            Ganti Pelanggan
                        </button>
                    </div>

                    {(selected && !selected.is_walk_in) || error ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {selected && !selected.is_walk_in && (
                                <CustomerHistoryButton
                                    customerId={selected.id}
                                    customerName={selected.name}
                                />
                            )}
                            {selected &&
                            !selected.is_walk_in &&
                            !selected.is_loyalty_member ? (
                                <button
                                    type="button"
                                    onClick={handleUpgradeMember}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-600 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300"
                                    title="Upgrade pelanggan menjadi member"
                                >
                                    <IconCrown size={16} />
                                    Upgrade
                                </button>
                            ) : null}
                            {error && (
                                <p className="text-xs text-danger-500">{error}</p>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {isPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setIsPickerOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                                    Pelanggan
                                </p>
                                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    Pilih pelanggan terbaik
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Transaksi otomatis memakai pelanggan umum. Ganti jika ingin pakai profil pelanggan atau member.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPickerOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <IconSearch
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Cari nama/telepon/nomor anggota..."
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPickerOpen(false);
                                        setShowAddModal(true);
                                    }}
                                    className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-dashed border-primary-300 px-3 text-sm font-semibold text-primary-500 hover:bg-primary-50 dark:border-primary-700 dark:hover:bg-primary-950/30"
                                >
                                    <IconUserPlus size={18} />
                                    Tambah Baru
                                </button>
                            </div>
                            {isLoadingCustomers ? (
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Memuat pelanggan...
                                </p>
                            ) : null}
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {filteredCustomers.length > 0 ? (
                                <ul className="p-3">
                                    {filteredCustomers.map((customer) => (
                                        <li key={customer.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelect(customer)}
                                                className={`mb-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                                                    selected?.id === customer.id
                                                        ? "border-primary-200 bg-primary-50 dark:border-primary-900/60 dark:bg-primary-950/30"
                                                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                                                }`}
                                            >
                                                <div
                                                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                                                        selected?.id === customer.id
                                                            ? "bg-primary-500 text-white"
                                                            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                                                    }`}
                                                >
                                                    {selected?.id === customer.id ? (
                                                        <IconCheck size={16} />
                                                    ) : (
                                                        <span className="text-sm font-medium">
                                                            {customer.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {customer.name}
                                                    </p>
                                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {customer.is_walk_in
                                                            ? "Tanpa customer terdaftar"
                                                            : customer.no_telp || "-"}
                                                    </p>
                                                    <p className="truncate text-[11px] text-primary-500 dark:text-primary-300">
                                                        {customer.is_walk_in
                                                            ? "Umum / Walk-in"
                                                            : customer.is_loyalty_member
                                                            ? `${customer.loyalty_tier} • ${customer.loyalty_points || 0} poin`
                                                            : "Non-member"}
                                                    </p>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="py-10 text-center text-slate-400 dark:text-slate-500">
                                    <IconUser
                                        size={28}
                                        className="mx-auto mb-2 opacity-50"
                                    />
                                    <p className="text-sm">Pelanggan tidak ditemukan</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPickerOpen(false);
                                            setShowAddModal(true);
                                        }}
                                        className="mt-2 text-sm font-medium text-primary-500 hover:text-primary-600"
                                    >
                                        + Tambah pelanggan baru
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Customer Modal */}
            <AddCustomerModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleAddCustomerSuccess}
                tierOptions={tierOptions}
            />
        </>
    );
}
