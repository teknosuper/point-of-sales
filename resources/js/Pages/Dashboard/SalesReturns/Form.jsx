import React, { useEffect, useMemo } from "react";
import { Head, Link, router, useForm } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Button from "@/Components/Dashboard/Button";
import { IconArrowLeft, IconCheck, IconDeviceFloppy } from "@/Utils/icons";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(new Date(value))
        : "-";

const formatInertiaErrorBag = (errors, fallbackMessage) => {
    if (!errors || typeof errors !== "object") {
        return fallbackMessage;
    }

    const messages = Object.values(errors)
        .flatMap((value) =>
            Array.isArray(value) ? value : value ? [value] : []
        )
        .filter(Boolean);

    if (messages.length === 0) {
        return fallbackMessage;
    }

    return messages.join("\n");
};

export default function SalesReturnForm({
    title,
    transaction,
    salesReturn = null,
    submitRoute,
    submitMethod = "post",
    canEdit = true,
    canComplete = false,
    completeRoute = null,
}) {
    const isWalkInTransaction = !transaction.customer;
    const itemDefaults = useMemo(
        () =>
            transaction.details.map((detail) => ({
                transaction_detail_id: detail.id,
                qty_return: detail.draft_item?.qty_return ?? 0,
                return_reason: detail.draft_item?.return_reason ?? "",
                restock_to_inventory:
                    detail.draft_item?.restock_to_inventory ?? true,
            })),
        [transaction.details]
    );

    const form = useForm({
        return_type:
            salesReturn?.return_type && transaction.customer
                ? salesReturn.return_type
                : "refund_cash",
        notes: salesReturn?.notes ?? "",
        items: itemDefaults,
    });

    useEffect(() => {
        form.setData({
            return_type:
                salesReturn?.return_type && transaction.customer
                    ? salesReturn.return_type
                    : "refund_cash",
            notes: salesReturn?.notes ?? "",
            items: itemDefaults,
        });
    }, [salesReturn, itemDefaults]);

    const itemStates = useMemo(() => {
        const itemMap = new Map(
            form.data.items.map((item) => [item.transaction_detail_id, item])
        );

        return transaction.details.map((detail) => {
            const current = itemMap.get(detail.id) ?? {
                qty_return: 0,
                return_reason: "",
                restock_to_inventory: true,
            };
            const qtyReturn = Number(current.qty_return || 0);
            const subtotal = qtyReturn * Number(detail.price || 0);

            return {
                ...detail,
                qty_return: qtyReturn,
                return_reason: current.return_reason || "",
                restock_to_inventory: Boolean(current.restock_to_inventory),
                subtotal,
            };
        });
    }, [form.data.items, transaction.details]);

    const summary = useMemo(() => {
        const selectedItems = itemStates.filter((item) => item.qty_return > 0);
        const totalItems = selectedItems.reduce(
            (carry, item) => carry + item.qty_return,
            0
        );
        const totalAmount = selectedItems.reduce(
            (carry, item) => carry + item.subtotal,
            0
        );
        const restockQty = selectedItems.reduce(
            (carry, item) =>
                carry + (item.restock_to_inventory ? item.qty_return : 0),
            0
        );

        let receivableAfter = null;
        let settlementAmount = 0;

        if (
            transaction.payment_method === "pay_later" &&
            transaction.receivable
        ) {
            receivableAfter = Math.max(
                0,
                Number(transaction.receivable.total || 0) - totalAmount
            );
            settlementAmount = Math.max(
                0,
                Number(transaction.receivable.paid || 0) - receivableAfter
            );
        } else if (transaction.payment_status === "paid") {
            settlementAmount = totalAmount;
        }

        const effectiveReturnType =
            !transaction.customer && form.data.return_type === "store_credit"
                ? "refund_cash"
                : form.data.return_type;

        return {
            selectedItemsCount: selectedItems.length,
            totalItems,
            totalAmount,
            restockQty,
            receivableAfter,
            refundAmount:
                effectiveReturnType === "refund_cash" ? settlementAmount : 0,
            creditedAmount:
                effectiveReturnType === "store_credit" ? settlementAmount : 0,
            hasSelectedItems: selectedItems.length > 0,
        };
    }, [
        itemStates,
        form.data.return_type,
        transaction.customer,
        transaction.payment_method,
        transaction.payment_status,
        transaction.receivable,
    ]);

    const updateItem = (transactionDetailId, key, value) => {
        form.setData(
            "items",
            form.data.items.map((item) =>
                item.transaction_detail_id === transactionDetailId
                    ? { ...item, [key]: value }
                    : item
            )
        );
    };

    const submit = async (event) => {
        event.preventDefault();

        const result = await Swal.fire({
            title: salesReturn ? "Perbarui draft retur?" : "Buat draft retur?",
            html: `
                <div style="text-align:left;display:grid;gap:8px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Invoice</span><strong>${transaction.invoice}</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Produk dipilih</span><strong>${summary.selectedItemsCount} produk</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Total qty retur</span><strong>${summary.totalItems} item</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Nominal retur</span><strong>${formatCurrency(summary.totalAmount)}</strong></div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: salesReturn ? "Ya, Perbarui Draft" : "Ya, Buat Draft",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        form[submitMethod](submitRoute, {
            preserveScroll: true,
            onSuccess: () =>
                toast.success(
                    salesReturn ? "Draft retur diperbarui" : "Draft retur dibuat"
                ),
            onError: (errors) =>
                toast.error(
                    formatInertiaErrorBag(
                        errors,
                        "Gagal menyimpan draft retur"
                    )
                ),
        });
    };

    const complete = async () => {
        const result = await Swal.fire({
            title: "Selesaikan retur penjualan?",
            html: `
                <div style="text-align:left;display:grid;gap:8px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Invoice</span><strong>${transaction.invoice}</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Produk dipilih</span><strong>${summary.selectedItemsCount} produk</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Total qty retur</span><strong>${summary.totalItems} item</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Stok kembali</span><strong>${summary.restockQty} item</strong></div>
                    <div style="display:flex;justify-content:space-between;gap:12px;"><span>Nominal retur</span><strong>${formatCurrency(summary.totalAmount)}</strong></div>
                </div>
                <p style="margin-top:16px;">Aksi ini akan memproses retur, menyesuaikan stok, dan memperbarui dampak ke settlement terkait.</p>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Selesaikan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            cancelButtonColor: "#64748b",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        router.post(
            completeRoute,
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Retur penjualan diselesaikan"),
                onError: (errors) =>
                    toast.error(
                        formatInertiaErrorBag(
                            errors,
                            "Gagal menyelesaikan retur"
                        )
                    ),
            }
        );
    };

    return (
        <>
            <Head title={title} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <Link
                            href={
                                salesReturn
                                    ? route("sales-returns.index")
                                    : route("transactions.history")
                            }
                            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600"
                        >
                            <IconArrowLeft size={16} />
                            {salesReturn
                                ? "Kembali ke daftar retur"
                                : "Kembali ke riwayat transaksi"}
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {title}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Invoice {transaction.invoice} •{" "}
                            {formatDateTime(transaction.created_at)}
                        </p>
                    </div>

                    {salesReturn && (
                        <div className="flex items-center gap-2">
                            <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                    salesReturn.status === "completed"
                                        ? "bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400"
                                        : "bg-warning-100 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400"
                                }`}
                            >
                                {salesReturn.status === "completed"
                                    ? "Completed"
                                    : "Draft"}
                            </span>
                            {salesReturn.completed_at && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDateTime(salesReturn.completed_at)}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard
                        label="Pelanggan"
                        value={transaction.customer?.name || "Umum / Walk-in"}
                    />
                    <InfoCard
                        label="Metode Bayar"
                        value={transaction.payment_method
                            ?.replaceAll("_", " ")
                            .toUpperCase()}
                    />
                    <InfoCard
                        label="Total Transaksi"
                        value={formatCurrency(transaction.grand_total)}
                    />
                    <InfoCard
                        label="Nominal Retur"
                        value={formatCurrency(summary.totalAmount)}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="grid gap-6 xl:grid-cols-[1.7fr_1fr]"
                >
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Item Retur
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Pilih item yang dibatalkan, isi jumlah retur,
                                    alasan, lalu tentukan apakah stok kembali ke
                                    inventory.
                                </p>
                                {canComplete && (
                                    <div className="mt-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-900/60 dark:bg-warning-950/20 dark:text-warning-300">
                                        Draft retur belum diproses final. Setelah
                                        data benar, gunakan tombol{" "}
                                        <span className="font-semibold">
                                            Selesaikan Retur
                                        </span>{" "}
                                        di panel kanan untuk memproses refund,
                                        stok, dan dampak settlement.
                                    </div>
                                )}
                            </div>
                            {canEdit && (
                                <Button
                                    type="submit"
                                    icon={<IconDeviceFloppy size={18} />}
                                    className="bg-primary-500 text-white hover:bg-primary-600 lg:self-start"
                                    label={
                                        salesReturn
                                            ? "Perbarui Draft"
                                            : "Buat Draft"
                                    }
                                    disabled={form.processing}
                                />
                            )}
                        </div>

                        <div className="space-y-4">
                            {itemStates.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                                >
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-100 px-2 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Item transaksi
                                                    </span>
                                                </div>
                                                <p className="text-base font-semibold text-slate-900 dark:text-white">
                                                    {item.product?.title || "-"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {item.product?.barcode ||
                                                        item.product?.sku ||
                                                        "-"}
                                                </p>
                                            </div>

                                            <div className="grid gap-2 sm:grid-cols-3">
                                                <MiniStat
                                                    label="Qty Beli"
                                                    value={item.qty}
                                                />
                                                <MiniStat
                                                    label="Sudah Retur"
                                                    value={item.returned_completed_qty}
                                                />
                                                <MiniStat
                                                    label="Sisa Bisa Diretur"
                                                    value={item.remaining_returnable_qty}
                                                    accent
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left xl:min-w-52 xl:text-right dark:border-slate-700 dark:bg-slate-900">
                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Subtotal Retur
                                            </p>
                                            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                                {formatCurrency(item.subtotal)}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Harga satuan{" "}
                                                {formatCurrency(item.price)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-4 lg:grid-cols-[180px_1fr]">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Qty Retur
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.remaining_returnable_qty}
                                                value={item.qty_return}
                                                disabled={!canEdit}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "qty_return",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            />
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Maksimal {item.remaining_returnable_qty} item
                                            </p>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Alasan Retur
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={item.return_reason}
                                                disabled={!canEdit}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "return_reason",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Contoh: salah input, item rusak, pesanan dibatalkan customer"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                    </div>

                                    <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                        <input
                                            type="checkbox"
                                            checked={item.restock_to_inventory}
                                            disabled={!canEdit}
                                            onChange={(event) =>
                                                updateItem(
                                                    item.id,
                                                    "restock_to_inventory",
                                                    event.target.checked
                                                )
                                            }
                                            className="mt-0.5 h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span>
                                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                                                Kembalikan stok ke inventory
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                Nonaktifkan jika item retur tidak
                                                layak jual atau tidak masuk kembali
                                                ke stok.
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            ))}
                        </div>

                        {form.errors.items && (
                            <p className="mt-3 text-sm text-danger-600">
                                {form.errors.items}
                            </p>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                                Penyelesaian Retur
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Metode Penyelesaian
                                    </label>
                                    <select
                                        value={form.data.return_type}
                                        disabled={!canEdit || isWalkInTransaction}
                                        onChange={(event) =>
                                            form.setData(
                                                "return_type",
                                                event.target.value
                                            )
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="refund_cash">
                                            Refund Tunai
                                        </option>
                                        {!isWalkInTransaction && (
                                            <option value="store_credit">
                                                Saldo Toko / Credit
                                            </option>
                                        )}
                                    </select>
                                    {isWalkInTransaction && (
                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                            Transaksi umum hanya dapat memakai
                                            refund tunai karena tidak ada profil
                                            customer untuk menerima saldo toko.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Catatan
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={form.data.notes}
                                        disabled={!canEdit}
                                        onChange={(event) =>
                                            form.setData(
                                                "notes",
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="Catatan retur"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                                Preview Dampak
                            </h2>

                            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                <PreviewRow
                                    label="Item dipilih"
                                    value={`${summary.selectedItemsCount} produk`}
                                />
                                <PreviewRow
                                    label="Total qty retur"
                                    value={`${summary.totalItems} item`}
                                />
                                <PreviewRow
                                    label="Stok kembali"
                                    value={`${summary.restockQty} item`}
                                />
                                <PreviewRow
                                    label="Refund"
                                    value={formatCurrency(summary.refundAmount)}
                                />
                                <PreviewRow
                                    label="Saldo toko"
                                    value={formatCurrency(
                                        summary.creditedAmount
                                    )}
                                />
                                {transaction.receivable && (
                                    <>
                                        <PreviewRow
                                            label="Piutang saat ini"
                                            value={formatCurrency(
                                                transaction.receivable.total
                                            )}
                                        />
                                        <PreviewRow
                                            label="Piutang setelah retur"
                                            value={formatCurrency(
                                                summary.receivableAfter ?? 0
                                            )}
                                        />
                                    </>
                                )}
                                <PreviewRow
                                    label="Nominal retur"
                                    value={formatCurrency(summary.totalAmount)}
                                    strong
                                />
                            </div>

                            {canComplete && (
                                <div className="mt-5">
                                    <Button
                                        type="button"
                                        icon={<IconCheck size={18} />}
                                        className="w-full bg-success-500 text-white hover:bg-success-600 disabled:opacity-50"
                                        label="Selesaikan Retur"
                                        onClick={complete}
                                        disabled={
                                            !summary.hasSelectedItems ||
                                            form.processing ||
                                            form.isDirty
                                        }
                                    />
                                    {form.isDirty && (
                                        <p className="mt-2 text-xs text-warning-600">
                                            Simpan draft terlebih dulu sebelum
                                            menyelesaikan retur.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

function InfoCard({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {value}
            </p>
        </div>
    );
}

function PreviewRow({ label, value, strong = false }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span
                className={
                    strong
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "font-medium text-slate-800 dark:text-slate-200"
                }
            >
                {value}
            </span>
        </div>
    );
}

function MiniStat({ label, value, accent = false }) {
    return (
        <div
            className={`rounded-2xl border px-3 py-3 ${
                accent
                    ? "border-primary-200 bg-primary-50/80 dark:border-primary-900 dark:bg-primary-950/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            }`}
        >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {value}
            </p>
        </div>
    );
}

SalesReturnForm.layout = (page) => <DashboardLayout children={page} />;
