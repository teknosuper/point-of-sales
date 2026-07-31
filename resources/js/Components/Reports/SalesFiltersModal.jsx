// Modal filter laporan penjualan (sebelumnya inline di Reports/Sales.jsx).
import InputSelect from "@/Components/Dashboard/InputSelect";
import { IconCalendar, IconX, IconSearch } from "@/Utils/icons";

export default function SalesFiltersModal({
    open,
    onClose,
    filterData,
    handleChange,
    hasActiveFilters,
    resetFilters,
    datePresets,
    applyDatePreset,
    applyFilters,
    cashiers,
    selectedCashier,
    handleSelectCashier,
    customerOptions,
    selectedCustomer,
    handleSelectCustomer,
    isTenantWorkspace,
    tenantOutlets,
    reportTimezone,
    reportTimezoneLabel,
}) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-6xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <IconCalendar size={20} className="text-slate-400" />
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                Filter Laporan
                            </h3>
                            {hasActiveFilters && (
                                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-400">
                                    Aktif
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Semua tanggal dan waktu mengikuti {reportTimezone} ({reportTimezoneLabel}).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {datePresets.map((preset) => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => applyDatePreset(preset.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <IconX size={14} />
                                Reset
                            </button>
                        )}
                    </div>

                    <form onSubmit={applyFilters}>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Tanggal Mulai
                        </label>
                        <input
                            type="date"
                            value={filterData.start_date}
                            onChange={(e) =>
                                handleChange(
                                    "start_date",
                                    e.target.value
                                )
                            }
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        />
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Tanggal lokal {reportTimezoneLabel}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Tanggal Akhir
                        </label>
                        <input
                            type="date"
                            value={filterData.end_date}
                            onChange={(e) =>
                                handleChange(
                                    "end_date",
                                    e.target.value
                                )
                            }
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        />
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Tanggal lokal {reportTimezoneLabel}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Invoice
                        </label>
                        <input
                            type="text"
                            placeholder="TRX-..."
                            value={filterData.invoice}
                            onChange={(e) =>
                                handleChange(
                                    "invoice",
                                    e.target.value
                                )
                            }
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        />
                    </div>
                    <InputSelect
                        label="Kasir"
                        data={cashiers}
                        selected={selectedCashier}
                        setSelected={handleSelectCashier}
                        placeholder="Semua kasir"
                        searchable
                    />
                    <InputSelect
                        label="Pelanggan"
                        data={customerOptions}
                        selected={selectedCustomer}
                        setSelected={handleSelectCustomer}
                        placeholder="Semua pelanggan / umum"
                        searchable
                    />
                    {!isTenantWorkspace ? (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Tenant
                            </label>
                            <select
                                value={filterData.tenant_outlet_id}
                                onChange={(e) =>
                                    handleChange(
                                        "tenant_outlet_id",
                                        e.target.value
                                    )
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">Semua tenant</option>
                                {tenantOutlets.map((tenant) => (
                                    <option
                                        key={tenant.id}
                                        value={tenant.id}
                                    >
                                        {tenant.name}
                                        {tenant.code
                                            ? ` (${tenant.code})`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Status Settlement
                        </label>
                        <select
                            value={filterData.settlement_status}
                            onChange={(e) =>
                                handleChange(
                                    "settlement_status",
                                    e.target.value
                                )
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-800 transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="">Semua status</option>
                            <option value="outstanding">
                                Outstanding
                            </option>
                            <option value="settled">
                                Settled
                            </option>
                        </select>
                    </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Tutup
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
                            >
                                <IconSearch size={18} />
                                Terapkan Filter
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
