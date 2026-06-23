import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import useFlashToast from "@/Hooks/useFlashToast";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import {
    IconCoin,
    IconDeviceFloppy,
    IconEdit,
    IconFilter,
    IconPlus,
    IconReceipt2,
    IconSearch,
    IconTrash,
    IconWallet,
    IconX,
} from "@/Utils/icons";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value || 0));

const defaultForm = {
    expense_date: "",
    category: "",
    description: "",
    amount: "",
    payment_method: "cash",
    status: "paid",
    notes: "",
};

const defaultFilters = {
    q: "",
    start_date: "",
    end_date: "",
    status: "",
    category: "",
};

export default function Expenses({
    expenses,
    filters,
    summary,
    categories = [],
    statusOptions = [],
    paymentMethodOptions = [],
}) {
    useFlashToast();
    const { activeOutlet } = usePage().props;
    const [editingExpense, setEditingExpense] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...filters,
    });
    const { data, setData, post, put, processing, errors } = useForm(
        defaultForm
    );

    useEffect(() => {
        if (!editingExpense) {
            setData(defaultForm);
            return;
        }

        setData({
            expense_date: editingExpense.expense_date ?? "",
            category: editingExpense.category ?? "",
            description: editingExpense.description ?? "",
            amount: editingExpense.amount ?? "",
            payment_method: editingExpense.payment_method ?? "cash",
            status: editingExpense.status ?? "paid",
            notes: editingExpense.notes ?? "",
        });
    }, [editingExpense, setData]);

    const rows = expenses?.data ?? [];
    const links = expenses?.links ?? [];
    const title = editingExpense ? "Edit Pengeluaran" : "Tambah Pengeluaran";
    const submit = (event) => {
        event.preventDefault();

        if (editingExpense) {
            put(route("settings.expenses.update", editingExpense.id), {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingExpense(null);
                    setData(defaultForm);
                },
            });

            return;
        }

        post(route("settings.expenses.store"), {
            preserveScroll: true,
            onSuccess: () => setData(defaultForm),
        });
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route("settings.expenses.index"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route("settings.expenses.index"), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const summaryCards = useMemo(
        () => [
            {
                title: "Total Pengeluaran",
                value: formatCurrency(summary?.expense_total ?? 0),
                description: `${summary?.total_count ?? 0} catatan`,
                icon: <IconReceipt2 size={18} />,
            },
            {
                title: "Sudah Dibayar",
                value: formatCurrency(summary?.paid_total ?? 0),
                description: "Mengurangi kas langsung",
                icon: <IconWallet size={18} />,
            },
            {
                title: "Belum Dibayar",
                value: formatCurrency(summary?.unpaid_total ?? 0),
                description: "Masih jadi kewajiban",
                icon: <IconCoin size={18} />,
            },
        ],
        [summary]
    );

    return (
        <>
            <Head title="Pengeluaran Operasional" />

            <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Expense Manager
                            </p>
                            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Pengeluaran Operasional
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Catat biaya seperti listrik, gaji, sampah, internet, dan pengeluaran lain agar laporan profit bisa menghitung laba bersih dan sisa uang aktual.
                            </p>
                            {activeOutlet?.name ? (
                                <div className="mt-4 inline-flex max-w-full rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-left text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300">
                                    {activeOutlet.code} - {activeOutlet.name}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilters((current) => !current)}
                            className="inline-flex w-full items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                            <IconFilter size={18} />
                            {showFilters ? "Sembunyikan Filter" : "Buka Filter"}
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {summaryCards.map((card) => (
                        <div
                            key={card.title}
                            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {card.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        {card.title}
                                    </p>
                                    <p className="mt-1 break-words text-xl font-bold text-slate-900 dark:text-white">
                                        {card.value}
                                    </p>
                                    <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                                        {card.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {showFilters ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <form onSubmit={applyFilters} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Cari
                                    </label>
                                    <div className="relative">
                                        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={filterData.q}
                                            onChange={(event) =>
                                                setFilterData((prev) => ({
                                                    ...prev,
                                                    q: event.target.value,
                                                }))
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            placeholder="Kategori / deskripsi"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Dari Tanggal
                                    </label>
                                    <input
                                        type="date"
                                        value={filterData.start_date}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                start_date: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Sampai Tanggal
                                    </label>
                                    <input
                                        type="date"
                                        value={filterData.end_date}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                end_date: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status
                                    </label>
                                    <select
                                        value={filterData.status}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                status: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua status</option>
                                        {statusOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Kategori
                                    </label>
                                    <select
                                        value={filterData.category}
                                        onChange={(event) =>
                                            setFilterData((prev) => ({
                                                ...prev,
                                                category: event.target.value,
                                            }))
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="">Semua kategori</option>
                                        {categories.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <IconX size={16} />
                                    Reset
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white"
                                >
                                    <IconSearch size={16} />
                                    Terapkan
                                </button>
                            </div>
                        </form>
                    </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {title}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Simpan expense operasional untuk dipakai di laporan profit.
                                </p>
                            </div>
                            {editingExpense ? (
                                <button
                                    type="button"
                                    onClick={() => setEditingExpense(null)}
                                    className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <IconX size={16} />
                                    Batal
                                </button>
                            ) : null}
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tanggal
                                    </label>
                                    <input
                                        type="date"
                                        value={data.expense_date}
                                        onChange={(event) =>
                                            setData("expense_date", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    />
                                    {errors.expense_date ? <p className="mt-1 text-xs text-rose-500">{errors.expense_date}</p> : null}
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Kategori
                                    </label>
                                    <input
                                        list="expense-categories"
                                        value={data.category}
                                        onChange={(event) =>
                                            setData("category", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="Listrik / Gaji / Sampah"
                                    />
                                    <datalist id="expense-categories">
                                        {[
                                            "Listrik",
                                            "Gaji",
                                            "Uang Sampah",
                                            "Internet",
                                            "Sewa",
                                            "Transport",
                                            "Operasional Lainnya",
                                            ...categories,
                                        ].map((category) => (
                                            <option key={category} value={category} />
                                        ))}
                                    </datalist>
                                    {errors.category ? <p className="mt-1 text-xs text-rose-500">{errors.category}</p> : null}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Deskripsi
                                </label>
                                <input
                                    value={data.description}
                                    onChange={(event) =>
                                        setData("description", event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="Contoh: Bayar listrik bulan ini"
                                />
                                {errors.description ? <p className="mt-1 text-xs text-rose-500">{errors.description}</p> : null}
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Nominal
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.amount}
                                        onChange={(event) =>
                                            setData("amount", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="0"
                                    />
                                    {errors.amount ? <p className="mt-1 text-xs text-rose-500">{errors.amount}</p> : null}
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Metode Bayar
                                    </label>
                                    <select
                                        value={data.payment_method}
                                        onChange={(event) =>
                                            setData("payment_method", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {paymentMethodOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status
                                    </label>
                                    <select
                                        value={data.status}
                                        onChange={(event) =>
                                            setData("status", event.target.value)
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {statusOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Catatan
                                </label>
                                <textarea
                                    value={data.notes}
                                    onChange={(event) => setData("notes", event.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="Catatan tambahan"
                                />
                                {errors.notes ? <p className="mt-1 text-xs text-rose-500">{errors.notes}</p> : null}
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {editingExpense ? <IconDeviceFloppy size={16} /> : <IconPlus size={16} />}
                                {editingExpense ? "Simpan Perubahan" : "Tambah Pengeluaran"}
                            </button>
                        </form>
                    </div>

                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 min-w-0">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Daftar Pengeluaran
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Semua expense operasional pada outlet aktif.
                            </p>
                        </div>

                        {rows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Tanggal</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Kategori</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Deskripsi</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Nominal</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {rows.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                    {row.expense_date}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                                                    {row.category}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                    <div>{row.description}</div>
                                                    {row.notes ? (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {row.notes}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(row.amount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span
                                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                                            row.status === "paid"
                                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                                        }`}
                                                    >
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingExpense(row)}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                                                        >
                                                            <IconEdit size={14} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm("Hapus pengeluaran ini?")) {
                                                                    router.delete(route("settings.expenses.destroy", row.id), {
                                                                        preserveScroll: true,
                                                                    });
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-900/40 dark:text-rose-300"
                                                        >
                                                            <IconTrash size={14} />
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                                Belum ada pengeluaran untuk filter ini.
                            </div>
                        )}

                        {links.length > 3 ? <div className="mt-4"><Pagination links={links} /></div> : null}
                    </div>
                </div>
            </div>
        </>
    );
}

Expenses.layout = (page) => <DashboardLayout children={page} />;
