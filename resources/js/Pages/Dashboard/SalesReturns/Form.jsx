import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router, useForm } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Button from "@/Components/Dashboard/Button";
import NumpadModal from "@/Components/POS/NumpadModal";
import {
    IconArrowLeft,
    IconCheck,
    IconDeviceFloppy,
    IconEdit,
    IconKeyboard,
    IconMinus,
    IconPlus,
} from "@/Utils/icons";
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

const QUICK_RETURN_REASONS = [
    "Pesanan dibatalkan customer",
    "Salah input kasir",
    "Item rusak / cacat",
    "Item tidak sesuai pesanan",
];

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
    const [isEditingDraft, setIsEditingDraft] = useState(!salesReturn);
    const [numpadState, setNumpadState] = useState({
        open: false,
        itemId: null,
        initialValue: 0,
        maxValue: 0,
    });
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

    const isEditable = canEdit && (!salesReturn || isEditingDraft);

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
            const savedDraftQty = Number(detail.draft_item?.qty_return || 0);
            const remainingAfterDraft = Math.max(
                0,
                Number(detail.remaining_returnable_qty || 0) - qtyReturn
            );

            return {
                ...detail,
                qty_return: qtyReturn,
                return_reason: current.return_reason || "",
                restock_to_inventory: Boolean(current.restock_to_inventory),
                subtotal,
                saved_draft_qty: savedDraftQty,
                remaining_after_draft_qty: remainingAfterDraft,
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
    const selectedProgressPercent = useMemo(() => {
        if (transaction.details.length === 0) {
            return 0;
        }

        return Math.min(
            100,
            Math.round(
                (summary.selectedItemsCount / transaction.details.length) * 100
            )
        );
    }, [summary.selectedItemsCount, transaction.details.length]);

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

    const adjustQty = (transactionDetailId, nextValue) => {
        const targetItem = itemStates.find((item) => item.id === transactionDetailId);

        if (!targetItem) {
            return;
        }

        const normalized = Math.max(
            0,
            Math.min(targetItem.remaining_returnable_qty, Number(nextValue || 0))
        );

        updateItem(transactionDetailId, "qty_return", normalized);
    };

    const openQtyNumpad = (item) => {
        setNumpadState({
            open: true,
            itemId: item.id,
            initialValue: item.qty_return,
            maxValue: item.remaining_returnable_qty,
        });
    };

    const submit = async (event) => {
        event.preventDefault();

        if (!summary.hasSelectedItems) {
            toast.error("Pilih minimal satu item retur terlebih dulu.");
            return;
        }

        const invalidItem = itemStates.find(
            (item) =>
                item.qty_return < 0 ||
                item.qty_return > Number(item.remaining_returnable_qty || 0)
        );

        if (invalidItem) {
            toast.error(
                `Qty retur untuk ${invalidItem.product?.title || "item terpilih"} melebihi sisa yang bisa diretur.`
            );
            return;
        }

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
            focusCancel: true,
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

    const handleSaveDraftClick = () =>
        submit({
            preventDefault: () => {},
        });

    const startEditDraft = () => {
        form.setData({
            return_type:
                salesReturn?.return_type && transaction.customer
                    ? salesReturn.return_type
                    : "refund_cash",
            notes: salesReturn?.notes ?? "",
            items: itemDefaults,
        });
        setIsEditingDraft(true);
    };

    const cancelEditDraft = () => {
        form.setData({
            return_type:
                salesReturn?.return_type && transaction.customer
                    ? salesReturn.return_type
                    : "refund_cash",
            notes: salesReturn?.notes ?? "",
            items: itemDefaults,
        });
        setIsEditingDraft(false);
    };

    const complete = async () => {
        if (!summary.hasSelectedItems) {
            toast.error("Pilih minimal satu item retur terlebih dulu.");
            return;
        }

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
            focusCancel: true,
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

                <div className="rounded-3xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-amber-50 p-5 dark:border-primary-900/40 dark:from-primary-950/20 dark:via-slate-900 dark:to-amber-950/10">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-700 dark:text-primary-300">
                                Alur Retur
                            </p>
                            <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                Pilih item, isi qty retur, lalu simpan draft setelah total sudah sesuai.
                            </h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Untuk mobile dan tablet, kerjakan item satu per satu. Item yang sudah dipilih akan diberi penanda warna agar mudah dibedakan.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Progress Pilihan
                            </p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                                {summary.selectedItemsCount}/{transaction.details.length}
                            </p>
                            <div className="mt-3 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className="h-2.5 rounded-full bg-primary-500 transition-all"
                                    style={{ width: `${selectedProgressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <form
                    onSubmit={submit}
                    className="grid gap-6 pb-28 xl:grid-cols-[1.7fr_1fr] xl:pb-0"
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
                            <div className="hidden flex-wrap gap-2 lg:self-start xl:flex">
                                {salesReturn && canEdit && !isEditingDraft ? (
                                    <Button
                                        type="button"
                                        icon={<IconEdit size={18} />}
                                        className="bg-primary-500 text-white hover:bg-primary-600"
                                        label="Edit Draft"
                                        onClick={startEditDraft}
                                    />
                                ) : null}
                                {salesReturn && isEditable ? (
                                    <Button
                                        type="button"
                                        className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        label="Batal Edit"
                                        onClick={cancelEditDraft}
                                        disabled={form.processing}
                                    />
                                ) : null}
                                {isEditable ? (
                                    <Button
                                        type="submit"
                                        icon={<IconDeviceFloppy size={18} />}
                                        className="bg-primary-500 text-white hover:bg-primary-600"
                                        label={
                                            salesReturn
                                                ? "Perbarui Draft"
                                                : "Buat Draft"
                                        }
                                        disabled={form.processing}
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {itemStates.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`rounded-3xl border p-4 transition sm:p-5 ${
                                        item.qty_return > 0
                                            ? "border-primary-300 bg-primary-50/60 shadow-sm dark:border-primary-800 dark:bg-primary-950/15"
                                            : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40"
                                    }`}
                                >
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-100 px-2 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        Item transaksi
                                                    </span>
                                                    {item.qty_return > 0 ? (
                                                        <span className="inline-flex rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                                            Dipilih {item.qty_return}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            Belum dipilih
                                                        </span>
                                                    )}
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

                                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                                <MiniStat
                                                    label="Qty Beli"
                                                    value={item.qty}
                                                />
                                                <MiniStat
                                                    label="Sudah Retur"
                                                    value={item.returned_completed_qty}
                                                />
                                                <MiniStat
                                                    label="Di Draft"
                                                    value={item.saved_draft_qty}
                                                />
                                                <MiniStat
                                                    label="Sisa Setelah Draft"
                                                    value={item.remaining_after_draft_qty}
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

                                    <div className="mt-4 grid gap-4 xl:grid-cols-[240px_1fr]">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Qty Retur
                                            </label>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                                    <button
                                                        type="button"
                                                        disabled={!isEditable || item.qty_return <= 0}
                                                        onClick={() =>
                                                            adjustQty(
                                                                item.id,
                                                                item.qty_return - 1
                                                            )
                                                        }
                                                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        <IconMinus size={18} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!isEditable}
                                                        onClick={() => openQtyNumpad(item)}
                                                        className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-xl bg-slate-50 px-4 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700"
                                                    >
                                                        <span className="text-xl font-semibold text-slate-900 dark:text-white">
                                                            {item.qty_return}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            <IconKeyboard size={14} />
                                                            Keypad
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            !isEditable ||
                                                            item.qty_return >=
                                                                item.remaining_returnable_qty
                                                        }
                                                        onClick={() =>
                                                            adjustQty(
                                                                item.id,
                                                                item.qty_return + 1
                                                            )
                                                        }
                                                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        <IconPlus size={18} />
                                                    </button>
                                                </div>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.remaining_returnable_qty}
                                                    value={item.qty_return}
                                                    disabled={!isEditable}
                                                    onChange={(event) =>
                                                        adjustQty(
                                                            item.id,
                                                            event.target.value
                                                        )
                                                    }
                                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Maksimal {item.remaining_returnable_qty} item
                                                {item.qty_return > 0
                                                    ? ` • sisa setelah draft ${item.remaining_after_draft_qty} item`
                                                    : ""}
                                            </p>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Alasan Retur
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={item.return_reason}
                                                disabled={!isEditable}
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
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {QUICK_RETURN_REASONS.map((reason) => (
                                                    <button
                                                        key={reason}
                                                        type="button"
                                                        disabled={!isEditable}
                                                        onClick={() =>
                                                            updateItem(
                                                                item.id,
                                                                "return_reason",
                                                                reason
                                                            )
                                                        }
                                                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                                            item.return_reason === reason
                                                                ? "bg-primary-500 text-white"
                                                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                        }`}
                                                    >
                                                        {reason}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                        <input
                                            type="checkbox"
                                            checked={item.restock_to_inventory}
                                            disabled={!isEditable}
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
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-24">
                            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                                    Aksi Utama
                                </p>
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                    Simpan draft setelah item terisi. Jika draft sudah final, baru lanjut selesaikan retur.
                                </p>
                                <div className="mt-4 hidden gap-2 xl:flex xl:flex-col">
                                    {salesReturn && canEdit && !isEditingDraft ? (
                                        <Button
                                            type="button"
                                            icon={<IconEdit size={18} />}
                                            className="bg-primary-500 text-white hover:bg-primary-600"
                                            label="Edit Draft"
                                            onClick={startEditDraft}
                                        />
                                    ) : null}
                                    {salesReturn && isEditable ? (
                                        <Button
                                            type="button"
                                            className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            label="Batal Edit"
                                            onClick={cancelEditDraft}
                                            disabled={form.processing}
                                        />
                                    ) : null}
                                    {isEditable ? (
                                        <Button
                                            type="submit"
                                            icon={<IconDeviceFloppy size={18} />}
                                            className="bg-primary-500 text-white hover:bg-primary-600"
                                            label={
                                                salesReturn
                                                    ? "Perbarui Draft"
                                                    : "Buat Draft"
                                            }
                                            disabled={
                                                !summary.hasSelectedItems ||
                                                form.processing
                                            }
                                        />
                                    ) : null}
                                </div>
                            </div>
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
                                        disabled={!isEditable || isWalkInTransaction}
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
                                        disabled={!isEditable}
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

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 xl:hidden">
                <div className="mx-auto grid max-w-7xl gap-3">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Progress
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {summary.selectedItemsCount} produk • {summary.totalItems} item
                            </p>
                        </div>
                        <div className="min-w-0 text-right">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Nominal Retur
                            </p>
                            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(summary.totalAmount)}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {isEditable ? (
                            <button
                                type="button"
                                onClick={handleSaveDraftClick}
                                disabled={!summary.hasSelectedItems || form.processing}
                                className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {salesReturn ? "Perbarui Draft" : "Buat Draft"}
                            </button>
                        ) : null}
                        {canComplete ? (
                            <button
                                type="button"
                                onClick={complete}
                                disabled={
                                    !summary.hasSelectedItems ||
                                    form.processing ||
                                    form.isDirty
                                }
                                className="inline-flex h-12 items-center justify-center rounded-2xl bg-success-500 px-4 text-sm font-semibold text-white transition hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Selesaikan Retur
                            </button>
                        ) : null}
                        {salesReturn && canEdit && !isEditingDraft ? (
                            <button
                                type="button"
                                onClick={startEditDraft}
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Edit Draft
                            </button>
                        ) : null}
                        {salesReturn && isEditable ? (
                            <button
                                type="button"
                                onClick={cancelEditDraft}
                                disabled={form.processing}
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Batal Edit
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            <NumpadModal
                isOpen={numpadState.open}
                onClose={() =>
                    setNumpadState({
                        open: false,
                        itemId: null,
                        initialValue: 0,
                        maxValue: 0,
                    })
                }
                onConfirm={(value) => {
                    if (numpadState.itemId !== null) {
                        adjustQty(numpadState.itemId, value);
                    }
                }}
                title="Qty Retur"
                initialValue={numpadState.initialValue}
                minValue={0}
                maxValue={numpadState.maxValue}
                isCurrency={false}
            />
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
