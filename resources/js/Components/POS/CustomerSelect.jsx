import React, { useState, useRef, useEffect } from "react";
import { router } from "@inertiajs/react";
import axios from "axios";
import {
    IconCrown,
    IconUser,
    IconSearch,
    IconCheck,
    IconChevronDown,
    IconUserPlus,
} from "@tabler/icons-react";
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
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Filter customers by search
    const filteredCustomers = [
        WALK_IN_CUSTOMER,
        ...customers.filter(
            (customer) =>
                customer.name.toLowerCase().includes(search.toLowerCase()) ||
                customer.no_telp?.toLowerCase().includes(search.toLowerCase()) ||
                customer.member_code?.toLowerCase().includes(search.toLowerCase())
        ),
    ].filter((customer) =>
        customer.is_walk_in
            ? customer.name.toLowerCase().includes(search.toLowerCase()) ||
              "umum".includes(search.toLowerCase()) ||
              "walk-in".includes(search.toLowerCase()) ||
              "walk in".includes(search.toLowerCase())
            : true
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search on open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (customer) => {
        onSelect(customer);
        setIsOpen(false);
        setSearch("");
    };

    const handleAddCustomerSuccess = (newCustomer) => {
        setShowAddModal(false);
        // Reload page data to get updated customer list
        router.reload({ only: ["customers"] });
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
                router.reload({ only: ["customers"] });
            }
        } catch (error) {
            console.error("Upgrade member error:", error);
        }
    };

    return (
        <>
            <div ref={containerRef} className="relative">
                {/* Label */}
                {label && (
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {label}
                    </label>
                )}

                {/* Select Button with History and Add */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`
                            flex-1 h-12 px-4 rounded-xl text-left
                            flex items-center gap-3
                            border-2 transition-all duration-200
                            ${
                                isOpen
                                    ? "border-primary-500 ring-4 ring-primary-500/20"
                                    : error
                                    ? "border-danger-500"
                                    : "border-slate-200 dark:border-slate-700"
                            }
                            bg-white dark:bg-slate-900
                        `}
                    >
                        <div
                            className={`
                            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                            ${
                                selected
                                    ? "bg-primary-100 dark:bg-primary-900/50"
                                    : "bg-slate-100 dark:bg-slate-800"
                            }
                        `}
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
                        <div className="flex-1 min-w-0">
                            {selected ? (
                                <>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {selected.name}
                                    </p>
                                    {!selected.is_walk_in && selected.no_telp && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {selected.no_telp}
                                        </p>
                                    )}
                                    {!selected.is_walk_in && selected.member_code ? (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {selected.member_code}
                                        </p>
                                    ) : null}
                                    <p className="text-[11px] text-primary-500 dark:text-primary-300 truncate">
                                        {selected.is_walk_in
                                            ? "Transaksi umum tanpa customer terdaftar"
                                            : selected.is_loyalty_member
                                            ? `${selected.loyalty_tier} • ${selected.loyalty_points || 0} poin`
                                            : "Non-member"}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400 dark:text-slate-500">
                                    {placeholder}
                                </p>
                            )}
                        </div>
                        <IconChevronDown
                            size={18}
                            className={`text-slate-400 transition-transform ${
                                isOpen ? "rotate-180" : ""
                            }`}
                        />
                    </button>

                    {/* History Button - Show when customer is selected */}
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
                            className="h-12 px-3 rounded-xl border border-primary-200 bg-primary-50 text-primary-600 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300"
                            title="Upgrade pelanggan menjadi member"
                        >
                            <span className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold">
                                <IconCrown size={16} />
                                Upgrade
                            </span>
                            <span className="inline-flex sm:hidden">
                                <IconCrown size={18} />
                            </span>
                        </button>
                    ) : null}

                    {/* Add Customer Button */}
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="h-12 w-12 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700
                            text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/30
                            flex items-center justify-center transition-colors"
                        title="Tambah pelanggan baru"
                    >
                        <IconUserPlus size={20} />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <p className="mt-1 text-xs text-danger-500">{error}</p>
                )}

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-50 animate-slide-up overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <IconSearch
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama/telepon/nomor anggota..."
                                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Customer List */}
                        <div className="max-h-60 overflow-y-auto scrollbar-thin">
                            {filteredCustomers.length > 0 ? (
                                <ul>
                                    {filteredCustomers.map((customer) => (
                                        <li key={customer.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleSelect(customer)
                                                }
                                                className={`
                                                    w-full flex items-center gap-3 px-4 py-3 text-left
                                                    transition-colors
                                                    ${
                                                        selected?.id ===
                                                        customer.id
                                                            ? "bg-primary-50 dark:bg-primary-950/30"
                                                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    }
                                                `}
                                            >
                                                <div
                                                    className={`
                                                    w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                                                    ${
                                                        selected?.id ===
                                                        customer.id
                                                            ? "bg-primary-500 text-white"
                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                    }
                                                `}
                                                >
                                                    {selected?.id ===
                                                    customer.id ? (
                                                        <IconCheck size={16} />
                                                    ) : (
                                                        <span className="text-sm font-medium">
                                                            {customer.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                                        {customer.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                        {customer.is_walk_in
                                                            ? "Tanpa customer terdaftar"
                                                            : customer.no_telp ||
                                                              "-"}
                                                    </p>
                                                    {!customer.is_walk_in && customer.member_code ? (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                            {customer.member_code}
                                                        </p>
                                                    ) : null}
                                                    <p className="text-[11px] text-primary-500 dark:text-primary-300 truncate">
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
                                <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                                    <IconUser
                                        size={24}
                                        className="mx-auto mb-2 opacity-50"
                                    />
                                    <p className="text-sm">
                                        Pelanggan tidak ditemukan
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            setShowAddModal(true);
                                        }}
                                        className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                        + Tambah pelanggan baru
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
